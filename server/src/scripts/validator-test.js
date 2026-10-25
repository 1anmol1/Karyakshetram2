// Checks that template narratives pass the numeric validator (KPI-10) for many sites.
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { loadState, state } from '../ml/placeholder/state.js';
import { scoreCell } from '../ml/placeholder/engine.js';
import { buildEvidence, templateSummary, templateCompare, validate } from '../llm/index.js';
await mongoose.connect(config.mongoUri); await loadState();
let ok = 0, bad = 0;
const cells = state.cells.filter((c) => c.eligible.grocery.ok).slice(0, 50);
for (let i = 0; i < cells.length; i++) {
  const s = scoreCell(cells[i], 'grocery'); const e = buildEvidence(s, { takenRs: 1234567, netNetworkProfit: -234567, affected: 3 });
  const v = validate(templateSummary(e, s.locality).text, [e]);
  const o = scoreCell(cells[(i + 1) % cells.length], 'grocery'); const oe = buildEvidence(o);
  const v2 = validate(templateCompare(e, oe, s.locality, o.locality).text, [e, oe]);
  const v3 = validate('Profit is ₹99.9 Cr here', [e]);
  if (v.ok && v2.ok && !v3.ok) ok++; else { bad++; console.log(v.rejected, v2.rejected); }
}
console.log(`validator: ${ok} sites ok, ${bad} failed (an invented number is rejected each time)`);
process.exit(bad ? 1 : 0);
