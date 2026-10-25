/**
 * Seed = the JavaScript stand-in for the offline pipeline's data, feature and suitability stages
 * (PRD 6.2 steps 1–3). It synthesises a reproducible city (fixed seed → identical data):
 *   H3 res-8 grid over Pune & PCMC, ~30 features per cell, land use, coverage score,
 *   buildable mask + per-category hard rules with reason codes, competitor/anchor POIs,
 *   simulated chains, category profiles, model registry rows (metrics pending), a demo user.
 * When the real Python pipeline exists it bulk-upserts the same collections and this script is not needed.
 * Usage: npm run seed  (add --keep-users to preserve accounts)
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { polygonToCells, cellToLatLng, cellToParent } from 'h3-js';
import { config } from '../config/index.js';
import { CITY, LOCALITIES, ZONES } from '../data/city.js';
import { CATEGORIES, BRANDS } from '../data/categories.js';
import { Cell, Poi, CategoryProfile, MlModel, Store, User, SearchLog, Score, Saved, Feedback, Outcome } from '../models/index.js';
import { rng, noise2 } from '../utils/index.js';
import { loadState, distKm } from '../ml/placeholder/state.js';
import { scoreCell } from '../ml/placeholder/engine.js';

const SEED = 20261024;
const R = rng(SEED);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const bump = (lat, lon, zones) => zones.reduce((s, [zl, zo, r]) => s + Math.exp(-((distKm(lat, lon, zl, zo) / r) ** 2)), 0);
const RIVER = [[18.535, 73.76], [18.53, 73.81], [18.528, 73.85], [18.545, 73.88], [18.553, 73.91], [18.56, 73.95], [18.565, 73.99]];
const riverDist = (lat, lon) => Math.min(...RIVER.map(([a, b]) => distKm(lat, lon, a, b)));

function nearestLocality(lat, lon) {
  let best = null, bd = Infinity;
  for (const l of LOCALITIES) { const d = distKm(lat, lon, l.lat, l.lon); if (d < bd) { bd = d; best = l.name; } }
  return best;
}

async function main() {
  const keepUsers = process.argv.includes('--keep-users');
  await mongoose.connect(config.mongoUri);
  console.log('Connected', config.mongoUri);
  await Promise.all([Cell.deleteMany({}), Poi.deleteMany({ $or: [{ source: 'simulated' }, { source: { $exists: false } }] }), CategoryProfile.deleteMany({}), MlModel.deleteMany({}), Score.deleteMany({}), SearchLog.deleteMany({}), Store.deleteMany({ chain: 'sim' })]);
  if (!keepUsers) await Promise.all([User.deleteMany({}), Store.deleteMany({}), Saved.deleteMany({}), Feedback.deleteMany({}), Outcome.deleteMany({})]);

  // ---------- 1. grid + features
  const ids = polygonToCells(CITY.polygon, 8);
  const raw = ids.map((id) => {
    const [lat, lon] = cellToLatLng(id);
    const n1 = noise2(lat * 300, lon * 300, 1), n2 = noise2(lat * 211, lon * 177, 2), n3 = noise2(lat * 97, lon * 151, 3);
    const density = clamp(bump(lat, lon, ZONES.core) * 0.75 + 0.08 * n1, 0, 1.3);
    const growth = 0.03 + 0.24 * clamp(bump(lat, lon, ZONES.growth)) + 0.04 * n2;
    const pop2020 = Math.round(2500 + 36000 * Math.min(1, density) + 4000 * n3);
    const pop2015 = Math.round(pop2020 / (1 + growth));
    const ind = clamp(0.7 * bump(lat, lon, ZONES.industrial) + 0.05 * n2 - 0.02);
    const green = clamp(0.6 * bump(lat, lon, ZONES.green) + 0.06 * n3);
    const water = clamp(0.4 * Math.exp(-((riverDist(lat, lon) / 0.45) ** 2)));
    const com = clamp(0.06 + 0.42 * Math.min(1, density) + 0.1 * n1 - 0.4 * ind);
    const res = clamp(1 - ind - green - water - com);
    const affluence = clamp(0.3 + 0.45 * bump(lat, lon, [[18.555, 73.8, 3], [18.54, 73.895, 2.2], [18.51, 73.83, 2]]) + 0.15 * n2);
    const fringe = clamp(bump(lat, lon, [[18.675, 73.865, 3], [18.585, 73.985, 2.5], [18.455, 73.93, 2]]));
    const coverage = Math.round(clamp(0.5 + 0.45 * Math.min(1, density) + 0.12 * n3 - 0.55 * fringe, 0.12, 0.99) * 100) / 100;
    const roadDistM = Math.round(25 + 520 * n1 ** 3 * (1.2 - Math.min(1, density) * 0.6));
    const trunkDistM = Math.round(80 + 2400 * n2 ** 2);
    const landfillKm = Math.round(distKm(lat, lon, 18.47, 73.975) * 10) / 10;
    const rentIndex = Math.round(45 + 175 * clamp(Math.min(1, density) * 0.65 + affluence * 0.45) + 12 * (n3 - 0.5));
    return {
      _id: id, lat, lon, locality: nearestLocality(lat, lon), block: cellToParent(id, 6),
      landuse: { res: +res.toFixed(3), com: +com.toFixed(3), ind: +ind.toFixed(3), green: +green.toFixed(3), water: +water.toFixed(3) }, coverage,
      features: {
        pop2015, pop2020, households: Math.round(pop2020 / 4.1), affluence: +affluence.toFixed(3), roadDistM, trunkDistM, landfillKm, rentIndex,
        anchors: {
          schools: Math.round(pop2020 / 8000 + 2 * n1), offices: Math.round(14 * com * Math.min(1, density) + 3 * n2), hospitals: Math.round(3 * Math.min(1, density) * n3 + (n1 > 0.85 ? 1 : 0)),
          transit: Math.round(1 + 6 * Math.min(1, density) * n2), parks: Math.round(5 * green + n3),
        },
        intersections: Math.round(20 + 80 * Math.min(1, density) * n1), poiDiversity: +(0.3 + 0.6 * Math.min(1, density) * n2).toFixed(2),
        pollutionProxy: +clamp(ind * 0.7 + (trunkDistM < 400 ? 0.2 : 0) + (landfillKm < 1 ? 0.3 : 0)).toFixed(2),
      },
      simFlags: ['rentIndex', 'affluence'],
    };
  });
  // households within radius, used by hard rules
  const hhWithin = (c, km) => raw.reduce((s, o) => (Math.abs(o.lat - c.lat) < km / 100 && distKm(c.lat, c.lon, o.lat, o.lon) <= km ? s + o.features.households : s), 0);
  const anchorWithin = (c, key, km) => raw.reduce((s, o) => (distKm(c.lat, c.lon, o.lat, o.lon) <= km ? s + (o.features.anchors[key] || 0) : s), 0);

  // ---------- 2. suitability: buildable mask + category hard rules → reason codes
  const hhCache = new Map();
  for (const c of raw) {
    const L = c.landuse, F = c.features;
    const mask = [];
    if (L.res + L.com + L.ind < 0.3) mask.push('MASK_LOW_BUILTUP');
    if (L.green + L.water > 0.5) mask.push('MASK_WATER_GREEN_GT_50');
    if (F.roadDistM > 300) mask.push('MASK_ROAD_GT_300M');
    c.eligible = {};
    for (const cat of CATEGORIES) {
      const reasons = [...mask];
      for (const r of cat.rules) {
        const [a1, a2, a3] = r.args;
        if (r.kind === 'ind_max' && L.ind > a1) reasons.push(`IND_SHARE_GT_${Math.round(a1 * 100)}`);
        if (r.kind === 'com_min' && L.com < a1) reasons.push(`COM_SHARE_LT_${Math.round(a1 * 100)}`);
        if (r.kind === 'res_min' && L.res < a1) reasons.push(`RES_SHARE_LT_${Math.round(a1 * 100)}`);
        if (r.kind === 'res_max' && L.res > a1) reasons.push(`RES_SHARE_GT_${Math.round(a1 * 100)}`);
        if (r.kind === 'road_max' && F.roadDistM > a1) reasons.push(`ROAD_GT_${a1}M`);
        if (r.kind === 'hh_min') { const k = `${c._id}:${a1}`; if (!hhCache.has(k)) hhCache.set(k, hhWithin(c, a1)); if (hhCache.get(k) < a2) reasons.push('HH_BELOW_MIN'); }
        if (r.kind === 'anchor_or_hh') { const k = `${c._id}:${a2}`; if (!hhCache.has(k)) hhCache.set(k, hhWithin(c, a2)); if (anchorWithin(c, a1, a2) < 1 && hhCache.get(k) < a3) reasons.push(`NO_${String(a1).toUpperCase().replace(/S$/, '')}_${a2}KM`); }
      }
      c.eligible[cat.key] = { ok: reasons.length === 0, reasons };
    }
  }
  await Cell.insertMany(raw.map(({ lat, lon, ...c }) => ({ ...c, centroid: { type: 'Point', coordinates: [lon, lat] } })));
  console.log('cells', raw.length);

  // ---------- 3. competitor / anchor POIs (simulated OSM extract)
  const COUNT = { grocery: 70, pharmacy: 90, cafe: 70, qsr: 60, restaurant: 70, bakery: 50, mobile: 60, salon: 55, fashion: 45, footwear: 40, jewellery: 35, convenience: 60, mall: 8, warehouse: 10, auto: 22, fuel: 28, ev: 18, coworking: 20 };
  const weights = raw.map((c) => c.features.households * (c.landuse.com + 0.15));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const pick = () => { let x = R() * wsum; for (let i = 0; i < raw.length; i++) { x -= weights[i]; if (x <= 0) return raw[i]; } return raw[raw.length - 1]; };
  const pois = [];
  const liveCats = new Set(await Poi.distinct('category', { source: { $exists: true, $ne: 'simulated' } }));
  for (const cat of CATEGORIES) {
    if (liveCats.has(cat.key)) continue; // real data already ingested for this category
    const n = COUNT[cat.key] || 30;
    const brands = BRANDS[cat.key] || ['Local'];
    for (let i = 0; i < n; i++) {
      const c = pick();
      const lat = c.lat + (R() - 0.5) * 0.006, lon = c.lon + (R() - 0.5) * 0.006;
      let brandClass = 'standard', area = cat.areaSqft * (0.6 + R() * 1.0);
      if (cat.key === 'grocery') { const t = R(); brandClass = t < 0.12 ? 'hypermarket' : t < 0.55 ? 'supermarket' : 'convenience'; area = { hypermarket: 25000, supermarket: 6000, convenience: 1500 }[brandClass]; }
      pois.push({ osmId: `sim/${cat.key}/${i}`, name: `${brands[i % brands.length]} ${c.locality}`, category: cat.key, brandClass, areaSqft: Math.round(area), loc: { type: 'Point', coordinates: [lon, lat] }, h3: c._id, locality: c.locality });
    }
  }
  await Poi.insertMany(pois);
  console.log('pois', pois.length);

  // ---------- 4. profiles + model registry (metrics are written later by the ML pipeline)
  await CategoryProfile.insertMany(CATEGORIES);
  await MlModel.insertMany(CATEGORIES.map((c) => ({
    version: config.modelVersion, category: c.key, calibrationScale: 1, source: 'placeholder', manifestHash: 'seed-' + SEED,
    featureList: ['households_catchment', 'pop_change', 'competitors', 'anchors', 'road_dist', 'landuse', 'rent_index', 'coverage'],
    metrics: { status: 'pending', note: 'Populated from metrics.json when the ML pipeline runs `make train`.' },
  })));

  // ---------- 5. simulated chains (training stores for the ML pipeline) + demo user
  await loadState();
  const eligibleFor = (k) => raw.filter((c) => c.eligible[k].ok);
  const chainStores = [];
  for (const [k, n] of [['grocery', 80], ['pharmacy', 60]]) {
    const pool = eligibleFor(k).sort(() => R() - 0.5);
    const chosen = [];
    for (const c of pool) { if (chosen.length >= n) break; if (chosen.every((q) => distKm(q.lat, q.lon, c.lat, c.lon) > 1.2)) chosen.push(c); }
    for (const c of chosen) {
      const s = scoreCell({ ...c }, k);
      chainStores.push({ name: `Sim ${k} ${c.locality}`, category: k, loc: { type: 'Point', coordinates: [c.lon, c.lat] }, h3: c._id, annualRevenue: Math.round(s.revenue.p50 * Math.exp((R() - 0.5) * 0.3)), chain: 'sim' });
    }
  }
  await Store.insertMany(chainStores);
  console.log('sim chain stores', chainStores.length);

  if (!keepUsers) {
    const demo = await User.create({
      name: 'Demo Expansion Manager', email: 'demo@karyakshetram.in', passwordHash: await bcrypt.hash('Demo@1234', 10),
      profile: {
        businessName: 'FreshMart Retail Pvt Ltd', role: 'expansion_manager', category: 'grocery', city: 'pune', focusAreas: [], grid: 'res8', hasStores: true,
        competitorBrands: ['FreshBasket', 'DailyMart'],
        format: { areaSqft: 4000, margin: 0.22, opex: 4200000, capex: 6000000, staff: 12, extras: { format: 'Supermarket', sku: 8000, parking: 8, delivery: 18, fresh: true }, drivers: { households: 80, affluence: 60, transit: 40, offices: 20 } },
        goals: { budget: 30000000, maxRent: 160, minSpacingKm: 1.5, minP10Profit: 0, k: 5, risk: 'balanced', excludeLowConfidence: true },
        onboardingStep: 5, completed: true,
      },
    });
    const ownAt = ['Aundh', 'Pashan', 'Sus', 'Wakad', 'Kothrud', 'Shivajinagar', 'Viman Nagar', 'Hadapsar', 'Pimpri', 'Nigdi', 'Kondhwa', 'Warje'];
    const own = [];
    ownAt.forEach((loc, i) => {
      const l = LOCALITIES.find((x) => x.name === loc);
      const c = raw.filter((x) => x.eligible.grocery.ok).sort((a, b) => distKm(a.lat, a.lon, l.lat, l.lon) - distKm(b.lat, b.lon, l.lat, l.lon))[0];
      const s = scoreCell({ ...c }, 'grocery');
      const est = i === 2 || i === 10;
      own.push({ owner: demo._id, name: `Store #${String(i + 1).padStart(2, '0')} · ${loc}`, category: 'grocery', loc: { type: 'Point', coordinates: [c.lon, c.lat] }, h3: c._id, annualRevenue: Math.round(s.revenue.p50 * (0.9 + R() * 0.2)), revenueEstimated: est, chain: 'own' });
    });
    await Store.insertMany(own);
    console.log('demo user: demo@karyakshetram.in / Demo@1234 ·', own.length, 'own stores');

    await User.create({
      name: 'Karyakshetram User', email: 'userkaryakshetram@gmail.com', passwordHash: await bcrypt.hash('user@123', 10),
      profile: {
        businessName: 'FreshMart Retail Pvt Ltd', role: 'expansion_manager', category: 'grocery', city: 'pune', focusAreas: [], grid: 'res8', hasStores: true,
        competitorBrands: ['FreshBasket', 'DailyMart'],
        format: { areaSqft: 4000, margin: 0.22, opex: 4200000, capex: 6000000, staff: 12, extras: { format: 'Supermarket', sku: 8000, parking: 8, delivery: 18, fresh: true }, drivers: { households: 80, affluence: 60, transit: 40, offices: 20 } },
        goals: { budget: 30000000, maxRent: 160, minSpacingKm: 1.5, minP10Profit: 0, k: 5, risk: 'balanced', excludeLowConfidence: true },
        onboardingStep: 5, completed: true,
      },
    });
    console.log('sample user: userkaryakshetram@gmail.com / user@123');
  }

  // ---------- 6. search activity for "Trending" (last 7 days)
  const logs = [];
  const growthLoc = new Map();
  for (const c of raw) { const g = (c.features.pop2020 - c.features.pop2015) / c.features.pop2015; growthLoc.set(c.locality, Math.max(growthLoc.get(c.locality) || 0, g)); }
  for (let i = 0; i < 1500; i++) {
    const l = LOCALITIES[Math.floor(R() * LOCALITIES.length)];
    if (R() > 0.25 + (growthLoc.get(l.name) || 0) * 3) continue;
    const cat = R() < 0.45 ? 'grocery' : CATEGORIES[Math.floor(R() * CATEGORIES.length)].key;
    logs.push({ locality: l.name, category: cat, q: l.name, createdAt: new Date(Date.now() - R() * 14 * 864e5) });
  }
  await SearchLog.insertMany(logs);
  console.log('search logs', logs.length);
  await mongoose.disconnect();
  console.log('Seed complete.');
}

main().catch((e) => { console.error(e); process.exit(1); });
