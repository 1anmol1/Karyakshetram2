// Live data API: feasibility + source catalogue for all 30 categories (Trust Center), sync status,
// manual refresh, registry / platform feed upload, what-if closures.
import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth, validate } from '../middleware/index.js';
import { asyncH, bad, notFound } from '../utils/index.js';
import { Poi, LiveSync } from '../models/index.js';
import { catByKey, CATEGORIES } from '../data/categories.js';
import { LIVE, LIVE_KEYS, catalogueOf } from '../data/liveSources.js';
import { syncCategory, syncAll, setCompetitorStatus, connectorStatus } from '../services/liveData.js';

const r = Router();
r.use(optionalAuth);

async function statusOf(key, detail) {
  const cat = catalogueOf(key);
  const base = { key, name: catByKey[key]?.name, icon: catByKey[key]?.icon, group: catByKey[key]?.group, live: !!LIVE[key], feasibility: cat?.feasibility ?? null };
  const lastOk = LIVE[key] ? await LiveSync.findOne({ category: key, ok: true }).sort({ createdAt: -1 }).select('createdAt open').lean() : null;
  base.mode = lastOk ? 'live' : 'simulated';
  base.lastSuccessAt = lastOk?.createdAt || null;
  base.liveOutlets = lastOk?.open ?? null;
  if (!detail) return base;

  const [last, bySource, closed] = await Promise.all([
    LiveSync.findOne({ category: key }).sort({ createdAt: -1 }).lean(),
    Poi.aggregate([{ $match: { category: key, status: { $ne: 'closed' } } }, { $unwind: { path: '$sources', preserveNullAndEmptyArrays: true } }, { $group: { _id: { $ifNull: ['$sources', '$source'] }, n: { $sum: 1 } } }]),
    Poi.aggregate([{ $match: { category: key, status: 'closed' } }, { $group: { _id: '$closedReason', n: { $sum: 1 } } }]),
  ]);
  const counts = Object.fromEntries(bySource.map((x) => [x._id || 'simulated', x.n]));
  const conn = LIVE[key] ? connectorStatus(key) : {};
  const connectorFor = (s) => (['osm', 'gplaces', 'ocm'].includes(s.id) ? s.id : s.type === 'govt' ? 'registry' : 'platform');
  return {
    ...base, parts: cat.parts, note: cat.note, brands: cat.brands,
    sources: cat.sources.map((s) => {
      const c = connectorFor(s);
      const connected = !!LIVE[key] && !!conn[c];
      return { ...s, connector: c, connected, records: connected ? counts[c] || 0 : 0 };
    }),
    counts: { ...counts, closed: Object.fromEntries(closed.map((x) => [x._id || 'UNKNOWN', x.n])) },
    lastSync: last ? { at: last.createdAt, ok: last.ok, error: last.error, warnings: last.warnings, added: last.added, closed: last.closed, reopened: last.reopened, nameCoverage: last.nameCoverage, bySource: last.bySource } : null,
  };
}

// ?category=key → full detail for one; otherwise a summary for all 30
r.get('/status', asyncH(async (req, res) => {
  const k = req.query.category && catByKey[req.query.category] ? String(req.query.category) : null;
  const categories = await Promise.all((k ? [k] : CATEGORIES.map((c) => c.key)).map((key) => statusOf(key, !!k)));
  res.json({ categories, liveKeys: LIVE_KEYS });
}));

r.post('/refresh', requireAuth, asyncH(async (req, res) => {
  const k = req.query.category ? String(req.query.category) : null;
  if (k && !LIVE[k]) throw bad(`${k} has no automatic live source yet`, 'category');
  res.json({ results: k ? [await syncCategory(k)] : await syncAll() });
}));

const rowSchema = z.object({ name: z.string().min(1), lat: z.coerce.number(), lon: z.coerce.number(), regNo: z.string().optional(), status: z.string().optional(), platform: z.string().optional(), id: z.union([z.string(), z.number()]).optional() });
const rowsSchema = z.object({ rows: z.array(rowSchema).min(1).max(5000) });
// government registrations (FSSAI, FDA, RBI, PESO, BIS, NABL, GST, Shop Act …)
r.post('/registry/:category', requireAuth, validate(rowsSchema), asyncH(async (req, res) => {
  if (!LIVE[req.params.category]) throw bad(`${req.params.category} has no live source yet`, 'category');
  res.json({ result: await syncCategory(req.params.category, { extraRegistry: req.body.rows }) });
}));
// industry platforms & brand locators (Swiggy, Zomato, Blinkit, Practo, Cult.fit, OEM locators …)
r.post('/platform/:category', requireAuth, validate(rowsSchema), asyncH(async (req, res) => {
  if (!LIVE[req.params.category]) throw bad(`${req.params.category} has no live source yet`, 'category');
  res.json({ result: await syncCategory(req.params.category, { extraPlatform: req.body.rows }) });
}));

// What-if: "this competitor does not exist" → every score, hexagon and recommendation recomputes
const stSchema = z.object({ status: z.enum(['open', 'closed']), reason: z.enum(['WHAT_IF', 'USER_REPORTED']).default('WHAT_IF') });
r.post('/competitors/:id/status', requireAuth, validate(stSchema), asyncH(async (req, res) => {
  const p = await setCompetitorStatus(req.params.id, req.body.status, req.body.reason);
  if (!p) throw notFound('Competitor not found');
  res.json({ competitor: { id: String(p._id), name: p.name, category: p.category, status: p.status, closedReason: p.closedReason } });
}));

r.get('/competitors/closed', asyncH(async (req, res) => {
  const q = { status: 'closed', ...(req.query.category ? { category: String(req.query.category) } : {}) };
  const list = await Poi.find(q).sort({ statusChangedAt: -1 }).limit(100).lean();
  res.json({ competitors: list.map((p) => ({ id: String(p._id), name: p.name, category: p.category, locality: p.locality, closedReason: p.closedReason, at: p.statusChangedAt, source: p.source })) });
}));

export default r;
