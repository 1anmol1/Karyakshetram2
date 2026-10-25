/**
 * Narrative layer (FR-09). The language model only verbalises a structured evidence record.
 * - buildEvidence(): the evidence record (every number shown in a narrative must come from here)
 * - template*(): deterministic narratives (always available; used when the LLM is off or fails)
 * - validate(): rejects any number or site ID that is not present in the evidence record
 * - narrate(): tries the optional LLM provider (LLM_URL) at temperature 0, falls back to template
 */
import { config } from '../config/index.js';
import { inr, pct, round } from '../utils/index.js';

const km = (v) => `${round(v, 1)} km`;
const n = (v) => Math.round(v).toLocaleString('en-IN');

export function buildEvidence(s, cann) {
  const ev = [];
  const add = (key, label, value, text) => { const id = `ev-${String(ev.length + 1).padStart(2, '0')}`; ev.push({ id, key, label, value, text }); return id; };
  add('households_catchment', `Households within ${s.catchment.km} km`, s.catchment.households, n(s.catchment.households));
  add('pop_change', 'Population change 2015–2020', s.popChange, pct(s.popChange));
  add('competitors_catchment', 'Competitors in catchment', s.catchment.competitors, String(s.catchment.competitors));
  add('nearest_competitor', 'Nearest competitor', s.catchment.nearestCompetitorKm, Number.isFinite(s.catchment.nearestCompetitorKm) ? km(s.catchment.nearestCompetitorKm) : 'none');
  add('anchors', `Complementary anchors (${s.catchment.anchorKey})`, s.catchment.anchors, String(Math.round(s.catchment.anchors)));
  add('revenue_p10', 'Revenue P10', s.revenue.p10, inr(s.revenue.p10));
  add('revenue_p50', 'Revenue P50', s.revenue.p50, inr(s.revenue.p50));
  add('revenue_p90', 'Revenue P90', s.revenue.p90, inr(s.revenue.p90));
  add('profit_exp', 'Expected profit per year', s.profit.exp, inr(s.profit.exp));
  add('profit_p10', 'Downside (P10) profit per year', s.profit.p10, inr(s.profit.p10));
  add('rent', 'Rent per sq ft per month', s.rent, `₹${Math.round(s.rent)}`);
  add('breakeven_rent', 'Break-even rent per sq ft per month', s.breakevenRent, `₹${Math.round(s.breakevenRent)}`);
  add('tier', 'Viability tier', s.tier, s.tier);
  add('confidence', 'Confidence', s.confidence, s.confidence);
  add('coverage', 'Data coverage score', s.coverage, round(s.coverage, 2).toFixed(2));
  for (const [k, t] of Object.entries(s.stress)) if (k !== 'passes') add(`stress.${k}`, t.label, t.exp, `${inr(t.exp)} (Tier ${t.tier})`);
  add('stress.passes', 'Stress tests passed', s.stress.passes, `${s.stress.passes} of 4`);
  if (cann) {
    add('cann.taken', 'Revenue taken from own stores', cann.takenRs, inr(cann.takenRs));
    add('cann.net_profit', 'Net network profit', cann.netNetworkProfit, inr(cann.netNetworkProfit));
    add('cann.affected', 'Own stores affected', cann.affected, String(cann.affected));
  }
  return { cell: s.cell, category: s.category, locality: s.locality, items: ev };
}

const get = (evd, key) => evd.items.find((i) => i.key === key);
const T = (evd, key) => get(evd, key)?.text;
const ids = (evd, keys) => keys.map((k) => get(evd, k)?.id).filter(Boolean);

export function templateSummary(evd, name) {
  const tier = T(evd, 'tier');
  const verdict = tier === 'A' ? 'stays profitable even in a weak year' : tier === 'B' ? 'is profitable on average but can lose money in a weak year' : 'is not expected to cover its costs';
  const s1 = `${name} ${verdict} (Tier ${tier}, ${T(evd, 'confidence').toLowerCase()} confidence): expected profit ${T(evd, 'profit_exp')} a year with a downside of ${T(evd, 'profit_p10')}.`;
  const s2 = `Demand comes from ${T(evd, 'households_catchment')} households within the catchment (population change ${T(evd, 'pop_change')}), against ${T(evd, 'competitors_catchment')} competitors.`;
  const s3 = `Break-even rent is ${T(evd, 'breakeven_rent')} per sq ft against ${T(evd, 'rent')} assumed; ${T(evd, 'stress.passes')} stress tests pass.`;
  const s4 = get(evd, 'cann.taken') ? ` It would take ${T(evd, 'cann.taken')} a year from ${T(evd, 'cann.affected')} of your stores; net network profit ${T(evd, 'cann.net_profit')}.` : '';
  return { text: `${s1} ${s2} ${s3}${s4}`, claims: [{ text: s1, evidence: ids(evd, ['tier', 'confidence', 'profit_exp', 'profit_p10']) }, { text: s2, evidence: ids(evd, ['households_catchment', 'pop_change', 'competitors_catchment']) }, { text: s3, evidence: ids(evd, ['breakeven_rent', 'rent', 'stress.passes']) }, ...(s4 ? [{ text: s4.trim(), evidence: ids(evd, ['cann.taken', 'cann.affected', 'cann.net_profit']) }] : [])] };
}

export function templateCompare(a, b, nameA, nameB) {
  const pa = get(a, 'profit_exp').value, pb = get(b, 'profit_exp').value;
  const [hi, lo, nh, nl] = pa >= pb ? [a, b, nameA, nameB] : [b, a, nameB, nameA];
  const safer = get(a, 'profit_p10').value >= get(b, 'profit_p10').value ? [a, nameA, b] : [b, nameB, a];
  let text = `${nh} ranks above ${nl} on expected profit (${T(hi, 'profit_exp')} vs ${T(lo, 'profit_exp')}), with ${T(hi, 'households_catchment')} households in its catchment against ${T(lo, 'households_catchment')}.`;
  if (safer[1] !== nh) text += ` ${safer[1]} is safer: its downside profit is ${T(safer[0], 'profit_p10')} vs ${T(safer[2], 'profit_p10')} and it passes ${T(safer[0], 'stress.passes')} stress tests. Choose it if the downside matters more than the upside.`;
  else text += ` It is also the safer choice, with downside profit ${T(hi, 'profit_p10')} vs ${T(lo, 'profit_p10')}.`;
  return { text, evidence: [...ids(hi, ['profit_exp', 'households_catchment', 'profit_p10']), ...ids(lo, ['profit_exp'])] };
}

// --------- numeric validator: every number token in the narrative must appear in the evidence
function tokens(text) {
  const out = [];
  const re = /(₹|rs\.?|inr)?\s*([−-]?\d[\d,]*(?:\.\d+)?)\s*(cr|crore|l|lakh|%|km|pp)?/gi;
  let m;
  while ((m = re.exec(text))) {
    let v = Number(m[2].replace(/,/g, '').replace('−', '-'));
    const u = (m[3] || '').toLowerCase();
    if (u === 'cr' || u === 'crore') v *= 1e7; else if (u === 'l' || u === 'lakh') v *= 1e5; else if (u === '%') v /= 100;
    out.push({ raw: m[0].trim(), v: Math.abs(v), money: !!m[1] || ['cr', 'crore', 'l', 'lakh'].includes(u) });
  }
  return out;
}
export function validate(text, evidences) {
  const allowed = [];
  for (const e of evidences) for (const it of e.items) { allowed.push(...tokens(it.text).map((t) => t.v)); allowed.push(...tokens(it.label).map((t) => t.v)); }
  const bad = tokens(text).filter((t) => !allowed.some((a) => Math.abs(a - t.v) <= Math.max(1e-6, Math.abs(a) * 0.006)));
  const badIds = (text.match(/\b8[0-9a-f]{14}\b/g) || []).filter((id) => !evidences.some((e) => e.cell === id));
  return { ok: bad.length === 0 && badIds.length === 0, rejected: [...bad.map((b) => b.raw), ...badIds] };
}

export async function narrate(kind, evidences, fallback) {
  if (!config.llmUrl) return { narrative: fallback.text, claims: fallback.claims || [], narrative_source: 'template' };
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(config.llmUrl, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(config.llmApiKey ? { Authorization: `Bearer ${config.llmApiKey}` } : {}) },
      body: JSON.stringify({ kind, temperature: 0, evidence: evidences, instructions: 'Write a short plain-language narrative using only numbers present in the evidence. Return {narrative, claims:[{text, evidence:[ids]}]}.' }),
    });
    clearTimeout(t);
    if (!r.ok) throw new Error(`LLM ${r.status}`);
    const j = await r.json();
    const v = validate(j.narrative || '', evidences);
    if (!v.ok) return { narrative: fallback.text, claims: fallback.claims || [], narrative_source: 'template', rejected: v.rejected };
    return { narrative: j.narrative, claims: j.claims || [], narrative_source: 'llm' };
  } catch (e) {
    return { narrative: fallback.text, claims: fallback.claims || [], narrative_source: 'template', llmError: String(e.message || e) };
  }
}
