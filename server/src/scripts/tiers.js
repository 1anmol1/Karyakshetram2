import mongoose from 'mongoose';
import { loadState } from '../ml/placeholder/state.js';
import { scoreAll } from '../ml/placeholder/engine.js';
await mongoose.connect('mongodb://127.0.0.1:27017/karyakshetram'); await loadState();
for (const k of ['grocery','pharmacy','cafe','mall','ev','warehouse','jewellery','coworking']) {
  const r = scoreAll(k).filter(s=>s.eligible.ok); const t={A:0,B:0,C:0}; r.forEach(s=>t[s.tier]++);
  const p50=r.map(s=>s.revenue.p50).sort((a,b)=>a-b);
  console.log(k, r.length, JSON.stringify(t), 'p50 min/med/max Cr', (p50[0]/1e7).toFixed(2), (p50[p50.length>>1]/1e7).toFixed(2), (p50.at(-1)/1e7).toFixed(2), 'conf', JSON.stringify(r.reduce((a,s)=>(a[s.confidence]=(a[s.confidence]||0)+1,a),{})));
}
process.exit(0);
