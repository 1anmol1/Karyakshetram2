/**
 * ML adapter — the ONLY place the API talks to the ML layer.
 *   ML_SERVICE_URL set  → POST {ML_SERVICE_URL}/ml/<op> with X-Internal-Key (FastAPI service, PRD 6.8)
 *   ML_SERVICE_URL empty → placeholder engine (./placeholder/engine.js)
 * If the remote service is cold or failing, the adapter falls back to the placeholder and marks
 * the response `source: "placeholder-fallback"` so the UI can show the "cached results" badge.
 * Your team integrates the real models by implementing these endpoints with the same JSON shapes.
 */
import { config } from '../config/index.js';
import * as engine from './placeholder/engine.js';
import { state } from './placeholder/state.js';

let lastRemote = { ok: null, at: null, error: null };

async function remote(op, body) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), config.mlTimeoutMs);
  try {
    const r = await fetch(`${config.mlServiceUrl.replace(/\/$/, '')}/ml/${op}`, {
      method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', 'X-Internal-Key': config.mlInternalKey }, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`ML ${op} → HTTP ${r.status}`);
    lastRemote = { ok: true, at: new Date(), error: null };
    return { ...(await r.json()), source: 'ml' };
  } catch (e) {
    lastRemote = { ok: false, at: new Date(), error: String(e.message || e) };
    throw e;
  } finally { clearTimeout(t); }
}

async function call(op, body, local) {
  if (!config.mlServiceUrl) return { ...(await local()), source: 'placeholder' };
  try { return await remote(op, body); } catch { return { ...(await local()), source: 'placeholder-fallback' }; }
}

export const ml = {
  score: (b) => call('score', b, () => ({ result: engine.scoreCell(state.byId.get(b.cell), b.category, b.assumptions) })),
  scoreAll: (b) => call('cells', b, () => ({ results: engine.scoreAll(b.category, b.assumptions) })),
  recommend: (b) => call('recommend', b, () => engine.recommend(b)),
  stress: (b) => call('stress', b, () => ({ stress: engine.scoreCell(state.byId.get(b.cell), b.category, b.assumptions).stress })),
  cannibalisation: (b) => call('cannibalisation', b, () => engine.cannibalisation(b.site, b.own, b.category)),
  nearestSuitable: (b) => call('alternatives', b, () => ({ alternatives: engine.nearestSuitable(state.byId.get(b.cell), b.category, 3, b.assumptions) })),
  portfolio: (b) => call('portfolio', b, () => engine.portfolio(b)),
  recalibrate: (b) => call('recalibrate', b, () => engine.recalibrate(b.category, b.outcomes)),
  health: () => ({ mode: config.mlServiceUrl ? 'remote' : 'placeholder', remote: lastRemote, cells: state.cells.length, loadedAt: state.loadedAt }),
};
