import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validate } from '../middleware/index.js';
import { Saved, Feedback, Outcome, SiteVisit, MlModel } from '../models/index.js';
import { asyncH, bad, notFound, ApiError } from '../utils/index.js';
import { catByKey } from '../data/categories.js';
import { state } from '../ml/placeholder/state.js';
import { ml } from '../ml/adapter.js';
import { assumptionsFor } from '../services/context.js';
import { config } from '../config/index.js';
import { clearCategory } from '../services/cache.js';

const r = Router();
const cat = z.string().refine((k) => !!catByKey[k] || k === 'all', 'Unknown business category');
const cellId = z.string().refine((id) => state.byId.has(id), 'Unknown location');
const SAVE_LIMIT = 50;

// ---------------- saved locations / shortlist
r.get('/saved', requireAuth, asyncH(async (req, res) => {
  const saved = await Saved.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ saved, limit: SAVE_LIMIT });
}));
r.post('/saved', requireAuth, validate(z.object({ cellId, category: cat, name: z.string().max(120).optional(), list: z.string().trim().max(40).optional(), note: z.string().max(500).optional() })), asyncH(async (req, res) => {
  const count = await Saved.countDocuments({ user: req.user._id });
  if (count >= SAVE_LIMIT) throw new ApiError(409, 'SAVE_LIMIT', `Shortlist is full (${SAVE_LIMIT}). Remove one to save more.`);
  const c = state.byId.get(req.body.cellId);
  const catKey = req.body.category === 'all' ? 'grocery' : req.body.category;
  const { result } = await ml.score({ cell: c._id, category: catKey, assumptions: assumptionsFor(req.user, catKey) });
  const doc = await Saved.findOneAndUpdate(
    { user: req.user._id, cell: c._id, category: catKey },
    { $set: { name: req.body.name || c.locality, list: req.body.list || 'Shortlist', note: req.body.note, snapshot: { tier: result.tier, exp: result.profit.exp, p10: result.profit.p10, p50: result.revenue.p50, rent: result.rent, locality: c.locality, lat: c.lat, lon: c.lon, confidence: result.confidence, modelVersion: config.modelVersion } } },
    { upsert: true, new: true },
  );
  res.status(201).json({ saved: doc });
}));
r.delete('/saved/:id', requireAuth, asyncH(async (req, res) => {
  const d = await Saved.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!d) throw notFound('Saved location not found');
  res.json({ deleted: true, saved: d });
}));

// ---------------- feedback (FR-13): thumbs + reason code; audits rules, never changes predictions
r.post('/feedback', requireAuth, validate(z.object({
  cellId, category: cat, rating: z.enum(['up', 'down']),
  reasonCode: z.enum(['wrong_land_use', 'rent_unrealistic', 'competitor_missing', 'other']).optional(), comment: z.string().max(500).optional(),
}).refine((b) => b.rating === 'up' || !!b.reasonCode, { message: 'Pick what was wrong', path: ['reasonCode'] })), asyncH(async (req, res) => {
  await Feedback.create({ user: req.user._id, cell: req.body.cellId, category: req.body.category, rating: req.body.rating, reasonCode: req.body.reasonCode, comment: req.body.comment });
  res.status(201).json({ stored: true });
}));

// ---------------- outcomes: "we opened here" → recalibration
r.post('/outcomes', requireAuth, validate(z.object({
  cellId, category: cat, openedOn: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid opening date' }) }),
  actualMonthlyRevenue: z.number({ invalid_type_error: 'Enter a number' }).positive('Revenue must be more than 0'),
})), asyncH(async (req, res) => {
  if (req.body.openedOn > new Date()) throw bad('Opening date cannot be in the future', 'openedOn');
  const { result } = await ml.score({ cell: req.body.cellId, category: req.body.category, assumptions: assumptionsFor(req.user, req.body.category) });
  const annual = req.body.actualMonthlyRevenue * 12;
  const inside = annual >= result.revenue.p10 && annual <= result.revenue.p90;
  await Outcome.create({ user: req.user._id, cell: req.body.cellId, category: req.body.category, openedOn: req.body.openedOn, actualMonthlyRevenue: req.body.actualMonthlyRevenue, predicted: result.revenue, insideInterval: inside, modelVersionAtPrediction: config.modelVersion });
  const outcomes = await Outcome.find({ category: req.body.category }).lean();
  const t0 = Date.now();
  const rc = await ml.recalibrate({ category: req.body.category, outcomes });
  await MlModel.updateOne({ version: config.modelVersion, category: req.body.category }, { $set: { calibrationScale: rc.calibrationScale } });
  clearCategory(req.body.category);
  res.status(201).json({ stored: true, insideInterval: inside, predicted: result.revenue, actualAnnual: annual, new_calibration_scale: rc.calibrationScale, coverage: rc.coverage, recalibrationMs: Date.now() - t0 });
}));

// ---------------- site-visit observations (FR-16): quoted rent replaces simulated rent
r.get('/visits', requireAuth, asyncH(async (req, res) => {
  const q = { user: req.user._id }; if (req.query.cellId) q.cell = String(req.query.cellId);
  res.json({ visits: await SiteVisit.find(q).sort({ createdAt: -1 }).limit(50).lean() });
}));
r.post('/visits', requireAuth, validate(z.object({
  cellId, category: cat, quotedRent: z.number().min(10, 'Rent must be between ₹10 and ₹1,000').max(1000, 'Rent must be between ₹10 and ₹1,000').optional(),
  footfall: z.number().int().min(0).max(100000).optional(), notes: z.string().max(2000).optional(),
})), asyncH(async (req, res) => {
  const v = await SiteVisit.create({ user: req.user._id, author: req.user.name, cell: req.body.cellId, category: req.body.category, quotedRent: req.body.quotedRent, footfall: req.body.footfall, notes: req.body.notes });
  clearCategory(req.body.category);
  res.status(201).json({ visit: v });
}));

export default r;
