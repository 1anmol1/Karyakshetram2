import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { requireAuth, validate } from '../middleware/index.js';
import { Store } from '../models/index.js';
import { asyncH, bad, insideCity, notFound } from '../utils/index.js';
import { snap } from '../services/context.js';
import { catByKey } from '../data/categories.js';
import { state } from '../ml/placeholder/state.js';
import { scoreCell } from '../ml/placeholder/engine.js';
import { clearUserCaches } from '../services/cache.js';

const r = Router();
r.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

const estimate = (cell, category) => Math.round(scoreCell(cell, category).revenue.p50);

r.get('/', asyncH(async (req, res) => {
  const stores = await Store.find({ owner: req.user._id, chain: 'own' }).sort({ name: 1 }).lean();
  res.json({ stores, count: stores.length });
}));

const one = z.object({
  name: z.string().trim().min(1, 'Store name is required').max(80),
  lat: z.number({ invalid_type_error: 'Latitude must be a number' }).min(-90).max(90),
  lon: z.number({ invalid_type_error: 'Longitude must be a number' }).min(-180).max(180),
  annualRevenue: z.number().positive('Revenue must be more than 0').optional().nullable(),
  category: z.string().optional(),
});

r.post('/', validate(one), asyncH(async (req, res) => {
  const { name, lat, lon, annualRevenue } = req.body;
  const category = req.body.category || req.user.profile.category;
  if (!catByKey[category]) throw bad('Choose a business category first', 'category');
  if (!insideCity(lat, lon)) throw bad('Location is outside Pune & PCMC', 'lat');
  const cell = snap(lat, lon);
  if (!cell) throw bad('Location is outside the scored grid', 'lat');
  if (await Store.exists({ owner: req.user._id, chain: 'own', h3: cell._id, name })) throw bad('A store with this name already exists in this cell', 'name', 'DUPLICATE');
  const s = await Store.create({ owner: req.user._id, name, category, loc: { type: 'Point', coordinates: [lon, lat] }, h3: cell._id, annualRevenue: annualRevenue || estimate(cell, category), revenueEstimated: !annualRevenue, chain: 'own' });
  if (!req.user.profile.hasStores) { req.user.profile.hasStores = true; await req.user.save(); }
  clearUserCaches(String(req.user._id));
  res.status(201).json({ store: s });
}));

r.delete('/:id', asyncH(async (req, res) => {
  const d = await Store.findOneAndDelete({ _id: req.params.id, owner: req.user._id, chain: 'own' });
  if (!d) throw notFound('Store not found');
  clearUserCaches(String(req.user._id));
  res.json({ deleted: true });
}));

// CSV import: name, lat, lon, annual_revenue (optional) · ≤ 500 rows · ≤ 1 MB (FR-18 limits)
r.post('/upload', upload.single('file'), asyncH(async (req, res) => {
  if (!req.file) throw bad('Attach a CSV file', 'file');
  if (!/\.csv$/i.test(req.file.originalname) && req.file.mimetype !== 'text/csv') throw bad('File must be a .csv', 'file');
  const category = req.body.category || req.user.profile.category;
  if (!catByKey[category]) throw bad('Choose a business category first', 'category');
  let rows;
  try { rows = parse(req.file.buffer.toString('utf8'), { columns: (h) => h.map((x) => x.trim().toLowerCase()), skip_empty_lines: true, trim: true, bom: true }); }
  catch (e) { throw bad(`Could not read CSV: ${e.message}`, 'file'); }
  if (!rows.length) throw bad('The file has no rows', 'file');
  if (rows.length > 500) throw bad(`File has ${rows.length} rows; the limit is 500. Nothing was imported.`, 'file', 'TOO_MANY_ROWS');
  const cols = Object.keys(rows[0]);
  for (const c of ['lat', 'lon']) if (!cols.includes(c)) throw bad(`Missing column “${c}”. Expected: name, lat, lon, annual_revenue`, 'file', 'MISSING_COLUMN');
  const replace = req.body.mode !== 'append';
  const existing = replace ? [] : await Store.find({ owner: req.user._id, chain: 'own' }).lean();
  const seen = new Set(existing.map((s) => `${s.h3}|${(s.name || '').toLowerCase()}`));
  const report = []; const docs = [];
  rows.forEach((row, i) => {
    const line = i + 2;
    const name = row.name || `Store ${i + 1}`;
    const lat = Number(row.lat), lon = Number(row.lon);
    const revRaw = row.annual_revenue ?? row.revenue ?? '';
    const rev = revRaw === '' ? null : Number(String(revRaw).replace(/[,₹\s]/g, ''));
    const base = { line, name, lat: row.lat, lon: row.lon, annualRevenue: rev };
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return report.push({ ...base, status: 'excluded', reason: 'Latitude / longitude is not a number' });
    if (!insideCity(lat, lon)) return report.push({ ...base, status: 'excluded', reason: 'Outside Pune polygon' });
    const cell = snap(lat, lon);
    if (!cell) return report.push({ ...base, status: 'excluded', reason: 'Outside the scored grid' });
    const key = `${cell._id}|${name.toLowerCase()}`;
    if (seen.has(key)) return report.push({ ...base, status: 'excluded', reason: 'Duplicate (same cell and name)' });
    seen.add(key);
    if (rev !== null && (!Number.isFinite(rev) || rev <= 0)) return report.push({ ...base, status: 'excluded', reason: 'Revenue must be a positive number' });
    const est = rev === null;
    docs.push({ owner: req.user._id, name, category, loc: { type: 'Point', coordinates: [lon, lat] }, h3: cell._id, annualRevenue: est ? estimate(cell, category) : rev, revenueEstimated: est, chain: 'own' });
    report.push({ ...base, status: est ? 'imputed' : 'valid', reason: est ? 'No revenue · simulated estimate used' : '' });
  });
  if (!docs.length) return res.status(400).json({ error: { code: 'NO_VALID_ROWS', message: '0 valid rows. Fix the errors and upload again.', field: 'file' }, report });
  if (replace) await Store.deleteMany({ owner: req.user._id, chain: 'own' });
  await Store.insertMany(docs);
  req.user.profile.hasStores = true; await req.user.save();
  clearUserCaches(String(req.user._id));
  const count = (s) => report.filter((x) => x.status === s).length;
  res.json({ summary: { rows: rows.length, valid: count('valid'), imputed: count('imputed'), excluded: count('excluded') }, report, cellsLoaded: state.cells.length });
}));

export default r;
