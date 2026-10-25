import { Store, SiteVisit } from '../models/index.js';
import { catByKey } from '../data/categories.js';
import { state } from '../ml/placeholder/state.js';
import { latLngToCell } from 'h3-js';
import { distKm } from '../ml/placeholder/state.js';

export function resolveCategory(req, explicit) {
  const k = explicit || req.user?.profile?.category || 'grocery';
  if (k === 'all') return 'grocery';
  return catByKey[k] ? k : 'grocery';
}

// User assumptions (onboarding step 4) apply only when the request is for the user's own category
export function assumptionsFor(user, category, overrides = {}) {
  const f = user?.profile?.category === category ? user.profile.format || {} : {};
  const a = {};
  for (const k of ['areaSqft', 'margin', 'opex', 'capex']) { const v = overrides[k] ?? f[k]; if (v != null) a[k] = v; }
  if (overrides.rent != null) a.rent = overrides.rent;
  return a;
}

export async function ownStores(user, category) {
  if (!user) return { all: [], same: [], mappedAll: [] };
  const all = await Store.find({ owner: user._id, chain: 'own' }).lean();
  const same = all.filter((s) => s.category === category).map((s) => ({
    id: String(s._id), name: s.name, lat: s.loc.coordinates[1], lon: s.loc.coordinates[0], revenue: s.annualRevenue, area: undefined, estimated: s.revenueEstimated, category: s.category,
  }));
  const mappedAll = all.map((s) => ({
    id: String(s._id), name: s.name, lat: s.loc.coordinates[1], lon: s.loc.coordinates[0], revenue: s.annualRevenue || 12000000, area: undefined, estimated: s.revenueEstimated, category: s.category,
  }));
  return { all, same, mappedAll };
}

export async function latestVisit(cell, category) {
  return SiteVisit.findOne({ cell, category }).sort({ createdAt: -1 }).lean();
}

export function snap(lat, lon) {
  const id = latLngToCell(lat, lon, 8);
  if (state.byId.has(id)) return state.byId.get(id);
  let best = null, bd = Infinity;
  for (const c of state.cells) { const d = distKm(lat, lon, c.lat, c.lon); if (d < bd) { bd = d; best = c; } }
  return bd <= 1.2 ? best : null;
}

export function siteName(s) { return s?.locality || 'Location'; }
