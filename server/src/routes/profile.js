import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validate } from '../middleware/index.js';
import { asyncH, bad } from '../utils/index.js';
import { catByKey } from '../data/categories.js';
import { LOCALITIES } from '../data/city.js';
import { clearUserCaches } from '../services/cache.js';
import { Store, Saved, Feedback, SiteVisit, Outcome, User } from '../models/index.js';

const r = Router();
r.use(requireAuth);

const LOCS = LOCALITIES.map((l) => l.name);
const patch = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  profile: z.object({
    businessName: z.string().trim().max(120).optional(),
    businessActivity: z.string().trim().max(300).optional(),
    businessType: z.string().trim().max(300).optional(),
    categories: z.array(z.string()).optional(),
    challengesNote: z.string().trim().max(500).optional(),
    challenges: z.array(z.string()).optional(),
    role: z.enum(['expansion_manager', 'finance_analyst', 'regional_head', 'independent_owner']).optional(),
    category: z.string().optional(),
    city: z.literal('pune', { errorMap: () => ({ message: 'Only Pune & PCMC is live. Kolhapur, Nashik and Nagpur are coming soon.' }) }).optional(),
    focusAreas: z.array(z.string().refine((l) => LOCS.includes(l), 'Unknown locality')).max(40).optional(),
    grid: z.enum(['res8', 'res7']).optional(),
    hasStores: z.boolean().optional(),
    competitorBrands: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    format: z.object({
      areaSqft: z.number({ invalid_type_error: 'Enter a number' }).min(200, 'Area must be at least 200 sq ft').max(500000, 'Area is too large').optional(),
      margin: z.number().min(0.01, 'Margin must be between 1% and 80%').max(0.8, 'Margin must be between 1% and 80%').optional(),
      opex: z.number().positive('Operating cost must be more than 0').optional(),
      capex: z.number().positive('Capex must be more than 0').optional(),
      staff: z.number().int().min(0).max(5000).optional(),
      extras: z.record(z.any()).optional(),
      drivers: z.record(z.number().min(0).max(100)).optional(),
    }).optional(),
    goals: z.object({
      budget: z.number().positive('Budget must be more than 0').optional(),
      maxRent: z.number().min(10, 'Rent must be between ₹10 and ₹1,000 per sq ft per month').max(1000, 'Rent must be between ₹10 and ₹1,000 per sq ft per month').optional(),
      minSpacingKm: z.number().min(0.5, 'Spacing must be 0.5 – 10 km').max(10, 'Spacing must be 0.5 – 10 km').optional(),
      minP10Profit: z.number().min(0, 'Must be 0 or more').optional(),
      k: z.number().int().min(1).max(20).optional(),
      risk: z.enum(['conservative', 'balanced', 'aggressive']).optional(),
      excludeLowConfidence: z.boolean().optional(),
    }).optional(),
    onboardingStep: z.number().int().min(1).max(5).optional(),
    completed: z.boolean().optional(),
  }).optional(),
  resetForCategory: z.boolean().optional(),
});

export function defaultsFor(key) {
  const c = catByKey[key] || catByKey.grocery;
  return {
    format: { areaSqft: c.areaSqft, margin: c.margin, opex: c.opex, capex: c.capex, staff: 10, extras: Object.fromEntries(c.fields.map((f) => [f.key, f.default])), drivers: {} },
    goals: { budget: c.capex * 5, maxRent: Math.min(1000, Math.round(220 * c.rentFactor)), minSpacingKm: Math.min(10, Math.max(1.5, c.catchmentKm * 0.75)), minP10Profit: 0, k: 5, risk: 'balanced', excludeLowConfidence: true },
  };
}

r.get('/', (req, res) => res.json({ user: req.user }));

r.patch('/', validate(patch), asyncH(async (req, res) => {
  const u = req.user, b = req.body, p = b.profile || {};
  if (b.name) u.name = b.name;
  if (!p.category && p.categories?.length) {
    p.category = p.categories[0];
  }
  const prevCat = u.profile.category;
  for (const k of ['businessName', 'businessActivity', 'businessType', 'categories', 'challengesNote', 'challenges', 'role', 'category', 'city', 'focusAreas', 'grid', 'hasStores', 'competitorBrands', 'onboardingStep', 'completed']) {
    if (p[k] !== undefined) u.profile[k] = p[k];
  }
  const activeCat = u.profile.category || 'grocery';
  if ((p.category && (p.category !== prevCat)) || !u.profile.format?.areaSqft || p.completed) {
    if (!u.profile.format?.areaSqft || b.resetForCategory) {
      const d = defaultsFor(activeCat);
      u.profile.format = d.format;
      u.profile.goals = d.goals;
    }
  }
  if (p.format) { u.profile.format = { ...(u.profile.format?.toObject?.() || u.profile.format || {}), ...p.format }; }
  if (p.goals) { u.profile.goals = { ...(u.profile.goals?.toObject?.() || u.profile.goals || {}), ...p.goals }; }
  if (p.completed && !u.profile.category) {
    u.profile.category = 'grocery';
  }
  u.markModified('profile');
  await u.save();
  clearUserCaches(String(u._id));
  res.json({ user: u, rescored: !!(p.format || p.goals || p.category) });
}));

r.delete('/', asyncH(async (req, res) => {
  const id = req.user._id;
  await Promise.all([Store.deleteMany({ owner: id }), Saved.deleteMany({ user: id }), Feedback.deleteMany({ user: id }), SiteVisit.deleteMany({ user: id }), Outcome.updateMany({ user: id }, { $unset: { user: 1 } })]);
  await User.deleteOne({ _id: id });
  res.json({ deleted: true });
}));

r.get('/defaults/:category', (req, res) => {
  if (!catByKey[req.params.category]) throw bad('Unknown category', 'category');
  res.json(defaultsFor(req.params.category));
});

export default r;
