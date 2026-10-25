/**
 * PLACEHOLDER ENGINE — stands in for the FastAPI ML service until the real models are linked.
 * It is deliberately simple and deterministic (no training, no learned parameters): it reads the
 * precomputed cell features and category profiles and applies transparent formulas so every
 * screen, constraint, edge case and API contract can be exercised end to end.
 * Replace by setting ML_SERVICE_URL; the adapter (../adapter.js) then forwards every call.
 */
import { state, caches, distKm } from './state.js';
import { noise2 } from '../../utils/index.js';

const ANCHOR_KEY = {
  pharmacy: 'hospitals', diagnostics: 'hospitals', pet: 'parks', cafe: 'offices', qsr: 'offices', coworking: 'offices', restaurant: 'offices',
  coaching: 'schools', bakery: 'schools', footwear: 'schools', mobile: 'transit', grocery: 'transit', convenience: 'transit', dairy: 'transit',
};
const HUFF = { alpha: 1.0, lambda: 1.8, floorKm: 0.3, originKm: 5 };

export function profile(category) {
  const p = state.profiles.get(category);
  if (!p) { const e = new Error(`Unknown category ${category}`); e.status = 400; throw e; }
  return p;
}

function median(a) { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 0; }
function quantile(a, q) { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))] || 0; }

// Catchment aggregates per category (households, competitors, anchors within the catchment radius)
export function catchment(category) {
  const key = `catch:${category}`;
  if (caches.has(key)) return caches.get(key);
  const p = profile(category);
  const r = p.catchmentKm, cells = state.cells, comps = state.pois.get(category) || [];
  const anchorKey = ANCHOR_KEY[category] || 'transit';
  const out = new Map();
  for (const c of cells) {
    let hh = 0, anchors = 0, n = 0;
    for (const o of cells) {
      if (Math.abs(o.lat - c.lat) > r / 100 || Math.abs(o.lon - c.lon) > r / 95) continue;
      if (distKm(c.lat, c.lon, o.lat, o.lon) <= r) { hh += o.features.households; anchors += o.features.anchors[anchorKey] || 0; n++; }
    }
    let comp = 0, nearestComp = Infinity;
    for (const q of comps) { const d = distKm(c.lat, c.lon, q.lat, q.lon); if (d <= r) comp++; if (d < nearestComp) nearestComp = d; }
    out.set(c._id, { hh, anchors, comp, nearestCompKm: nearestComp, cellsInCatchment: n });
  }
  const hhs = [...out.values()].map((v) => v.hh), cps = [...out.values()].map((v) => v.comp);
  const res = { map: out, anchorRef: median([...out.values()].map((v) => v.anchors)), hhRef: median(hhs) || 1, compRef: median(cps), hhP03: quantile(hhs, 0.03), hhP97: quantile(hhs, 0.97), anchorKey };
  caches.set(key, res);
  return res;
}

export function tierOf(exp, p10) { return p10 > 0 ? 'A' : exp > 0 ? 'B' : 'C'; }

/** Score one cell. `a` = assumptions overrides {areaSqft, margin, opex, capex, rent} */
export function scoreCell(cell, category, a = {}) {
  const p = profile(category);
  const C = catchment(category);
  const k = C.map.get(cell._id);
  const area = a.areaSqft || p.areaSqft, m = a.margin ?? p.margin, opex = a.opex ?? p.opex;
  const rentTyp = 100 * p.rentFactor;
  const base = ((rentTyp * area * 12 + opex) / m) * 1.18;
  const f = cell.features;
  const demandF = Math.pow(Math.max(k.hh, 1) / C.hhRef, 0.38);
  const afflF = 1 + 0.4 * (f.affluence - 0.5);
  const anchorF = 1 + 0.08 * Math.log1p(k.anchors);
  const compF = (1 + 0.12 * C.compRef) / (1 + 0.12 * k.comp);
  const accessF = 1 - Math.min(0.25, f.roadDistM / 2000);
  const jitter = 0.95 + 0.1 * noise2(cell.lat * 100, cell.lon * 100, category.length);
  const mult = Math.max(0.4, Math.min(1.9, demandF * afflF * anchorF * compF * accessF / (1 + 0.08 * Math.log1p(C.anchorRef || 0))));
  const p50 = base * mult * jitter;
  const rent = a.rent ?? Math.round(f.rentIndex * p.rentFactor);
  const calib = state.calib.get(category) || 1;
  const w = (0.13 + 0.22 * (1 - cell.coverage)) * calib;
  const revenue = { p10: p50 * (1 - w), p50, p90: p50 * (1 + w * 1.15) };
  const rentCost = rent * area * 12;
  const profit = { exp: p50 * m - rentCost - opex, p10: revenue.p10 * m - rentCost - opex };
  const tier = tierOf(profit.exp, profit.p10);
  const breakevenRent = (p50 * m - opex) / (area * 12);
  const extrap = k.hh > C.hhP97 || k.hh < C.hhP03;
  const confidence = cell.coverage >= 0.7 && !extrap ? 'High' : cell.coverage >= 0.45 ? 'Medium' : 'Low';
  const flags = [];
  if (k.comp === 0 && k.hh < p.householdsMin) flags.push('EMPTY_MARKET');
  if (cell.coverage < 0.4) flags.push('LOW_COVERAGE');
  if (extrap) flags.push('EXTRAPOLATION');
  const run = (rev, mm, rr) => { const e = rev.p50 * mm - rr * area * 12 - opex, d = rev.p10 * mm - rr * area * 12 - opex; return { exp: e, p10: d, tier: tierOf(e, d), pass: e > 0 }; };
  const scale = (s) => ({ p10: revenue.p10 * s, p50: revenue.p50 * s });
  const stress = {
    competitor500m: { label: 'Dominant competitor opens 500 m away', ...run(scale(0.78), m, rent) },
    rentUp25: { label: 'Rent +25%', ...run(revenue, m, rent * 1.25) },
    demandDown15: { label: 'Demand −15%', ...run(scale(0.85), m, rent) },
    marginDown2: { label: 'Margin −2 pp', ...run(revenue, m - 0.02, rent) },
  };
  stress.passes = Object.values(stress).filter((s) => s.pass).length;
  const popChange = f.pop2015 ? (f.pop2020 - f.pop2015) / f.pop2015 : 0;
  // placeholder attribution (log-additive decomposition, aggregated to the 5 PRD factor groups)
  const baseProfit = base * m - rentTyp * area * 12 - opex;
  const logs = { Demand: Math.log(demandF * afflF), Access: Math.log(accessF * anchorF / (1 + 0.08 * Math.log1p(C.anchorRef || 0))), Competition: Math.log(compF), Noise: Math.log(jitter * mult / (demandF * afflF * anchorF * compF * accessF / (1 + 0.08 * Math.log1p(C.anchorRef || 0)))) };
  const sumLog = Object.values(logs).reduce((s, v) => s + v, 0) || 1e-9;
  const revDelta = (p50 - base) * m;
  const shap = { Demand: revDelta * logs.Demand / sumLog, Access: revDelta * logs.Access / sumLog, Competition: revDelta * logs.Competition / sumLog, Cost: (rentTyp - rent) * area * 12, Network: 0 };
  shap.Demand += revDelta * logs.Noise / sumLog; // fold residual into demand so attributions stay additive
  return {
    cell: cell._id, category, locality: cell.locality, lat: cell.lat, lon: cell.lon, revenue, profit, tier, breakevenRent, rent, area, margin: m, opex,
    capex: a.capex ?? p.capex, confidence, flags, stress, popChange, coverage: cell.coverage, eligible: cell.eligible?.[category] || { ok: true, reasons: [] },
    catchment: { km: p.catchmentKm, households: k.hh, competitors: k.comp, nearestCompetitorKm: k.nearestCompKm, anchors: k.anchors, anchorKey: C.anchorKey },
    demandSupply: k.hh / (k.comp + 1), shap, baseProfit,
  };
}

export function scoreAll(category, a = {}) {
  return state.cells.map((c) => scoreCell(c, category, a));
}

// ---------------- Huff cannibalisation (placeholder: fixed α, λ — the real values are fitted by the ML service)
function huffLoss(candidate, facilities, own) {
  const origins = state.cells.filter((o) => distKm(o.lat, o.lon, candidate.lat, candidate.lon) <= HUFF.originKm + 1);
  const attr = (f, o) => Math.pow(f.area, HUFF.alpha) * Math.pow(Math.max(HUFF.floorKm, distKm(o.lat, o.lon, f.lat, f.lon)), -HUFF.lambda);
  const lossByStore = new Map(own.map((s) => [s.id, 0]));
  let candidateCaptured = 0;
  for (const o of origins) {
    const s = o.features.households;
    let denom = 0; const a = [];
    for (const f of facilities) { const v = distKm(o.lat, o.lon, f.lat, f.lon) <= HUFF.originKm + 3 ? attr(f, o) : 0; a.push(v); denom += v; }
    const ac = attr(candidate, o);
    if (denom === 0) { candidateCaptured += s; continue; }
    candidateCaptured += s * ac / (denom + ac);
    facilities.forEach((f, i) => { if (f.own && a[i] > 0) lossByStore.set(f.id, lossByStore.get(f.id) + s * (a[i] / denom - a[i] / (denom + ac))); });
  }
  // captured demand of each own store before (over its own origin set)
  const res = [];
  for (const st of own) {
    const so = state.cells.filter((o) => distKm(o.lat, o.lon, st.lat, st.lon) <= HUFF.originKm);
    let before = 0;
    for (const o of so) {
      let denom = 0, mine = 0;
      for (const f of facilities) { if (distKm(o.lat, o.lon, f.lat, f.lon) > HUFF.originKm + 3) continue; const v = attr(f, o); denom += v; if (f.id === st.id) mine = v; }
      if (denom > 0) before += o.features.households * mine / denom;
    }
    const lossPct = before > 0 ? Math.min(0.95, lossByStore.get(st.id) / before) : 0;
    res.push({ ...st, lossPct, lossRs: lossPct * st.revenue });
  }
  return { stores: res, candidateCaptured };
}

/** own: [{id, name, lat, lon, revenue, area, estimated}] for the SAME category */
export function cannibalisation(site, own, category, extraFacilities = []) {
  const p = profile(category);
  const comps = (state.pois.get(category) || []).filter((q) => distKm(q.lat, q.lon, site.lat, site.lon) <= 9)
    .map((q) => ({ id: String(q._id), lat: q.lat, lon: q.lon, area: q.areaSqft || p.areaSqft, own: false }));
  const ownNear = own.filter((s) => distKm(s.lat, s.lon, site.lat, site.lon) <= 10);
  const ownFar = own.filter((s) => !ownNear.includes(s));
  const facilities = [...comps, ...ownNear.map((s) => ({ ...s, area: s.area || p.areaSqft, own: true })), ...extraFacilities.map((s) => ({ ...s, own: true }))];
  const { stores } = huffLoss({ lat: site.lat, lon: site.lon, area: site.area || p.areaSqft }, facilities, [...ownNear, ...extraFacilities]);
  const all = [
    ...stores.map((s) => ({ ...s, distKm: distKm(s.lat, s.lon, site.lat, site.lon) })),
    ...ownFar.map((s) => ({ ...s, lossPct: 0, lossRs: 0, distKm: distKm(s.lat, s.lon, site.lat, site.lon) })),
  ].sort((x, y) => y.lossRs - x.lossRs || x.distKm - y.distKm);
  const taken = all.reduce((t, s) => t + s.lossRs, 0);
  const lostMargin = taken * (site.margin ?? p.margin);
  return {
    stores: all, takenRs: taken, lostMargin, ratio: site.revenue ? taken / site.revenue.p50 : 0,
    netNetworkRevenue: (site.revenue?.p50 || 0) - taken, netNetworkProfit: (site.profit?.exp || 0) - lostMargin,
    affected: all.filter((s) => s.lossPct > 0.001).length, model: { ...HUFF, source: 'placeholder' },
  };
}

// ---------------- recommendation set (FR-08)
export function recommend({ category, constraints = {}, assumptions = {}, focusAreas = [], excludeLow = true, own = [], grid = 'res8' }) {
  const p = profile(category);
  const all = scoreAll(category, assumptions);
  const areaSet = focusAreas?.length ? new Set(focusAreas) : null;
  const inArea = all.filter((s) => !areaSet || areaSet.has(s.locality));
  const lowCov = inArea.filter((s) => s.coverage < 0.4).length / Math.max(1, inArea.length);
  // coarse grid (res 7) pools sparse cells, so the insufficient-data gate is relaxed and low-coverage cells stay eligible
  const coverage_status = grid === 'res7' ? 'ok' : lowCov > 0.4 ? 'insufficient' : 'ok';
  const eligible = inArea.filter((s) => s.eligible.ok);
  let pool = eligible.filter((s) => (constraints.maxRent ? s.rent <= constraints.maxRent : true));
  if (excludeLow) pool = pool.filter((s) => (grid === 'res7' || s.confidence !== 'Low') && !s.flags.includes('EMPTY_MARKET'));
  const minP10 = constraints.minP10Profit ?? -Infinity;
  const spacing = constraints.minSpacingKm ?? 1.5;
  const picked = [];
  const far = (s) => picked.every((q) => distKm(q.lat, q.lon, s.lat, s.lon) >= spacing);
  const choose = (label, icon, rule, filter, key, dir = -1) => {
    const cands = pool.filter((s) => filter(s) && far(s) && !picked.some((q) => q.cell === s.cell)).sort((x, y) => dir * (key(x) - key(y)));
    const s = cands[0];
    if (!s) return { label, icon, rule, empty: true, reason: `No site meets the “${label}” rule with current constraints` };
    picked.push(s);
    return { label, icon, rule, ...s };
  };
  const picks = [
    choose('Best overall', 'trophy-line', 'Highest expected profit', (s) => s.profit.p10 >= minP10, (s) => s.profit.exp),
    choose('Lowest risk', 'shield-check-line', 'Highest downside (P10) profit', (s) => s.profit.p10 >= minP10, (s) => s.profit.p10),
    choose('Lowest investment', 'money-rupee-circle-line', 'Lowest rent among Tier A', (s) => s.tier === 'A' && s.profit.p10 >= minP10, (s) => s.rent, 1),
    choose('Growth', 'line-chart-line', 'Fastest 2015–2020 population growth among Tier A/B', (s) => s.tier !== 'C', (s) => s.popChange),
    choose('Under-served', 'focus-3-line', 'Highest demand-to-supply ratio', (s) => s.tier !== 'C', (s) => s.demandSupply),
  ];
  if (own.length) for (const pk of picks) if (!pk.empty) {
    const cn = cannibalisation(pk, own, category);
    pk.cannibalisation = { takenRs: cn.takenRs, ratio: cn.ratio, netNetworkProfit: cn.netNetworkProfit, affected: cn.affected };
    if (cn.netNetworkProfit < 0) pk.flags = [...pk.flags, 'HEAVY_CANNIBALISATION'];
  }
  const missing = coverage_status === 'insufficient' ? ['buildings', 'shops', 'land use'] : [];
  const allLocations = pool.slice(0, 30).map((s) => ({
    ...s,
    label: s.tier === 'A' ? 'Top Tier' : 'Viable Location',
    icon: 'map-pin-2-line',
  }));
  return {
    category, picks, allLocations, coverage_status, missingLayers: missing, grid,
    stats: { scored: inArea.length, eligible: eligible.length, afterConstraints: pool.length, lowCoverageShare: lowCov },
    profile: { name: p.name, catchmentKm: p.catchmentKm },
  };
}

// ---------------- check a location (J2)
export function nearestSuitable(cell, category, n = 3, a = {}) {
  return state.cells.filter((c) => c._id !== cell._id && c.eligible?.[category]?.ok)
    .map((c) => ({ c, d: distKm(c.lat, c.lon, cell.lat, cell.lon) })).sort((x, y) => x.d - y.d).slice(0, n)
    .map(({ c, d }) => ({ ...scoreCell(c, category, a), distKm: d }));
}

// ---------------- portfolio planner (FR-15, greedy marginal gain)
export function portfolio({ category, k = 5, spacingKm = 1.5, budget, assumptions = {}, own = [] }) {
  const p = profile(category);
  const capex = assumptions.capex ?? p.capex;
  const maxSites = budget ? Math.min(k, Math.floor(budget / capex)) : k;
  const all = scoreAll(category, assumptions).filter((s) => s.eligible.ok && s.confidence !== 'Low' && !s.flags.includes('EMPTY_MARKET'))
    .sort((x, y) => y.profit.exp - x.profit.exp);
  const cands = [];
  for (const s of all) { if (cands.length >= 40) break; if (cands.every((q) => distKm(q.lat, q.lon, s.lat, s.lon) >= spacingKm * 0.7)) cands.push(s); }
  const asStore = (s) => ({ id: s.cell, name: s.locality, lat: s.lat, lon: s.lon, revenue: s.revenue.p50, area: s.area });
  const evaluate = (seq) => {
    let total = 0; const steps = []; const net = [...own];
    for (const s of seq) {
      const cn = cannibalisation(s, net, category);
      const gain = s.profit.exp - cn.lostMargin;
      steps.push({ ...s, marginalGain: gain, takenFromNetwork: cn.takenRs, lostMargin: cn.lostMargin });
      total += gain; net.push(asStore(s));
    }
    return { total, steps };
  };
  // greedy
  const selected = []; const net = [...own];
  while (selected.length < maxSites) {
    let best = null;
    for (const c of cands) {
      if (selected.some((q) => q.cell === c.cell)) continue;
      if (!selected.every((q) => distKm(q.lat, q.lon, c.lat, c.lon) >= spacingKm)) continue;
      const cn = cannibalisation(c, net, category);
      const gain = c.profit.exp - cn.lostMargin;
      if (!best || gain > best.gain) best = { c, gain };
    }
    if (!best || best.gain <= 0) break;
    selected.push(best.c); net.push(asStore(best.c));
  }
  const naive = [];
  for (const s of cands) { if (naive.length >= maxSites) break; if (naive.every((q) => distKm(q.lat, q.lon, s.lat, s.lon) >= spacingKm)) naive.push(s); }
  const planned = evaluate(selected), naiveRes = evaluate(naive);
  const dropped = naive.filter((n) => !selected.some((s) => s.cell === n.cell)).map((s) => s.locality);
  return {
    category, k, maxSites, budget, capexPerSite: capex, budgetUsed: selected.length * capex,
    selected: planned.steps, networkProfit: planned.total,
    naive_comparison: { selected: naiveRes.steps.map((s) => ({ cell: s.cell, locality: s.locality, marginalGain: s.marginalGain })), networkProfit: naiveRes.total, upliftPct: naiveRes.total ? (planned.total - naiveRes.total) / Math.abs(naiveRes.total) : 0 },
    droppedFromNaive: dropped,
  };
}

// ---------------- conformal recalibration (placeholder ratio update)
export function recalibrate(category, outcomes) {
  const cur = state.calib.get(category) || 1;
  if (!outcomes.length) return { category, calibrationScale: cur, coverage: null };
  const inside = outcomes.filter((o) => o.insideInterval).length / outcomes.length;
  const next = Math.max(0.6, Math.min(2.5, cur * (inside < 0.8 ? 1 + (0.8 - inside) * 0.5 : 1 - (inside - 0.8) * 0.25)));
  state.calib.set(category, next);
  return { category, calibrationScale: next, previous: cur, coverage: inside };
}
