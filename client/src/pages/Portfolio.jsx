import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fieldErrors } from '../lib/api.js';
import { useApp, useAuth } from '../lib/state.jsx';
import { inr, parseNum, inrPlain } from '../lib/format.js';
import { Header, Footer, SystemBanners } from '../components/Layout.jsx';
import { Icon, Field, Kv, Banner, EmptyState, Skel, ErrorBox } from '../components/ui.jsx';
import HexMap from '../components/HexMap.jsx';

export default function Portfolio() {
  const { user } = useAuth();
  const { category, catInfo } = useApp();
  const nav = useNavigate();
  const g = user.profile?.category === category ? user.profile.goals || {} : {};
  const capex = (user.profile?.category === category ? user.profile.format?.capex : null) || catInfo?.capex || 0;
  const [v, setV] = useState({ k: String(g.k || 5), spacing: String(g.minSpacingKm || 1.5), budget: String(g.budget || capex * 5 || '') });
  const [errs, setErrs] = useState({});
  const [d, setD] = useState({});
  const run = async () => {
    const k = parseNum(v.k), s = parseNum(v.spacing), b = parseNum(v.budget);
    const e = {}; if (!Number.isInteger(k) || k < 1 || k > 20) e.k = '1 – 20 sites'; if (!Number.isFinite(s) || s < 0.5 || s > 10) e.spacingKm = '0.5 – 10 km'; if (b != null && (!Number.isFinite(b) || b <= 0)) e.budget = 'Budget must be more than 0'; else if (b != null && b < capex) e.budget = `Below one store’s capex (${inr(capex)})`;
    setErrs(e); if (Object.keys(e).length) return;
    setD({ loading: true });
    try { setD({ data: await api('/portfolio', { method: 'POST', body: { category, k, spacingKm: s, ...(b ? { budget: b } : {}) }, timeout: 90000 }) }); }
    catch (er) { setErrs(fieldErrors(er)); setD({ error: er }); }
  };
  const r = d.data;
  return (
    <div className="page">
      <Header back />
      <SystemBanners />
      <div className="wrapx col g20" style={{ padding: '24px 28px' }}>
        <div className="row sb wrap g8"><div className="col g4"><h1 className="h2">Portfolio planner</h1><span className="muted s14">Pick k sites that maximise total network profit, not just the top-k individually.</span></div><span className="tag info">P1 feature</span></div>
        <form className="card pad16 row g16 wrap as" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <div style={{ width: 150 }}><Field label="Sites (k)" value={v.k} onChange={(x) => setV({ ...v, k: x })} error={errs.k} /></div>
          <div style={{ width: 180 }}><Field label="Min spacing" value={v.spacing} onChange={(x) => setV({ ...v, spacing: x })} suffix="km" error={errs.spacingKm} /></div>
          <div style={{ width: 240 }}><Field label="Budget" value={inrPlain(parseNum(v.budget)) || v.budget} onChange={(x) => setV({ ...v, budget: x })} suffix="₹" error={errs.budget} help={`${inr(parseNum(v.budget))} · capex ${inr(capex)} per site`} /></div>
          <button className="btn ink" style={{ marginTop: 22 }} disabled={d.loading}>{d.loading ? <Icon n="loader-4-line" className="spin" /> : <Icon n="play-line" s={16} />}Plan network</button>
          <span className="s12 muted" style={{ marginTop: 32 }}>Huff shares recomputed after every pick</span>
        </form>
        {!r && !d.loading && !d.error && <div className="card"><EmptyState icon="node-tree" title="Plan your next k stores together" text="Greedy marginal-gain selection: each step adds the site that raises total network profit most after recomputing shares for your existing and selected stores, then compares with simply taking the top-k." /></div>}
        {d.loading && <div className="row g20 stack-md"><Skel h={460} style={{ flex: 1, borderRadius: 18 }} /><Skel h={460} style={{ flex: 1, borderRadius: 16 }} /></div>}
        {d.error && !Object.keys(errs).length && <div className="card"><ErrorBox error={d.error} onRetry={run} /></div>}
        {r && (r.selected.length === 0 ? <div className="card"><EmptyState icon="filter-off-line" title="No site adds network profit" text="Every candidate takes more from your stores than it earns, or the budget covers no store. Lower spacing or raise the budget." /></div> : <div className="row as g20 stack-md">
          <div style={{ flex: 1.2, height: 460 }}><HexMap features={null} picks={r.selected.map((s, i) => ({ lat: s.lat, lon: s.lon, n: i + 1, onClick: () => nav(`/location/${s.cell}`) }))} fit="markers" legend={false} /></div>
          <div className="col g12 f1">
            <div className="row g12 stack-md"><div className="panel pad16 f1"><Kv k="Network profit · planned" v={`${r.networkProfit >= 0 ? '+' : ''}${inr(r.networkProfit)}`} /></div><div className="panel pad16 f1"><Kv k={`Naive top-${r.naive_comparison.selected.length}`} v={`${r.naive_comparison.networkProfit >= 0 ? '+' : ''}${inr(r.naive_comparison.networkProfit)}`} /></div>
              <div className="panel pad16 f1" style={{ background: r.naive_comparison.upliftPct >= 0.05 ? 'var(--okSoft)' : 'var(--surface)' }}><Kv k="Uplift" v={`${r.naive_comparison.upliftPct >= 0 ? '+' : ''}${(r.naive_comparison.upliftPct * 100).toFixed(1)}%`} sub="target ≥ 5%" /></div></div>
            <div className="card" style={{ overflowX: 'auto' }}><table className="t"><thead><tr><th>#</th><th>Site</th><th>Marginal gain</th><th>From network</th><th>Capex</th></tr></thead><tbody>
              {r.selected.map((s, i) => <tr key={s.cell} className="click" onClick={() => nav(`/location/${s.cell}`)}><td><span className="tier" style={{ background: 'var(--accent)', color: '#fff' }}>{i + 1}</span></td><td className="b">{s.locality}</td><td className="num okc b">+{inr(s.marginalGain)}</td><td className="num">{inr(s.takenFromNetwork)}</td><td className="num">{inr(r.capexPerSite)}</td></tr>)}</tbody></table></div>
            {r.droppedFromNaive.length > 0 && <Banner tone="info" icon="information-line">Dropped from the naive list because of overlap: {r.droppedFromNaive.join(', ')}.</Banner>}
            <Banner tone="info" icon="wallet-3-line">Budget used {inr(r.budgetUsed)}{r.budget ? ` of ${inr(r.budget)}` : ''}. {r.maxSites < r.k ? `Budget allows ${r.maxSites} of the ${r.k} sites requested.` : ''}{r.ownStores ? ` Your ${r.ownStores} existing stores were included.` : ' No existing stores loaded.'}</Banner>
          </div>
        </div>)}
      </div>
      <Footer />
    </div>
  );
}
