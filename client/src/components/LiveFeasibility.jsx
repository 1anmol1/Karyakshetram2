// Trust Center: real-time data feasibility for all 30 categories (big %), and for the selected category
// every source (map, public API, government registration, industry platform, brand locator) with its
// own real-time score and connection status, plus last sync and removed competitors.
import { useMemo, useState } from 'react';
import { useApi, useAuth } from '../lib/state.jsx';
import { api } from '../lib/api.js';
import { Icon, Skel } from './ui.jsx';

const PART_LABEL = { mapCoverage: 'Map coverage', registry: 'Govt registration', freshness: 'Freshness', platformSignal: 'Platform & brand signal' };
const TYPE = {
  map: ['Map', 'map-2-line'], api: ['Public API', 'code-s-slash-line'], govt: ['Govt registration', 'government-line'],
  platform: ['Industry platform', 'apps-line'], brand: ['Brand locator', 'store-2-line'],
};
const INTEG = { integrated: ['Auto-fetched', 'ok'], import: ['Feed import ready', 'info'], planned: ['Planned', ''] };
const ago = (d) => {
  if (!d) return 'never';
  const m = Math.round((Date.now() - new Date(d)) / 60000);
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const tone = (p) => (p >= 80 ? 'var(--ok)' : p >= 65 ? 'var(--accent)' : 'var(--warn, #c98a00)');

export default function LiveFeasibility({ selected, onSelect }) {
  const { user } = useAuth();
  const all = useApi('/live/status', []);
  const det = useApi(`/live/status?category=${selected}`, [selected]);
  const closed = useApi(`/live/competitors/closed?category=${selected}`, [selected]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [filter, setFilter] = useState('all');
  const cats = useMemo(() => {
    const list = [...(all.data?.categories || [])].sort((a, b) => (b.live - a.live) || (b.feasibility - a.feasibility));
    return filter === 'live' ? list.filter((c) => c.live) : list;
  }, [all.data, filter]);
  const cur = det.data?.categories?.[0];
  const liveCount = (all.data?.categories || []).filter((c) => c.live).length;

  const refetchAll = () => { all.refetch(); det.refetch(); closed.refetch(); };
  const refresh = async (key) => {
    setBusy(key); setMsg(null);
    try {
      const { results } = await api(`/live/refresh?category=${key}`, { method: 'POST', timeout: 180000 });
      const r = results[0];
      setMsg(r.ok === false ? `Live fetch failed: ${r.error}. Previous data kept.` : `Synced: ${r.open} open · +${r.added} new · ${r.closed} closed${r.warnings?.length ? ` · ${r.warnings.join('; ')}` : ''}`);
      refetchAll();
    } catch (e) { setMsg(e.message); } finally { setBusy(null); }
  };
  const restore = async (id) => {
    setBusy(id);
    try { await api(`/live/competitors/${id}/status`, { method: 'POST', body: { status: 'open', reason: 'WHAT_IF' } }); refetchAll(); setMsg('Restored · scores recomputed'); } catch (e) { setMsg(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="card pad20 col g16 shadow" style={{ background: 'var(--bg)' }}>
      <div className="row sb ac wrap g8">
        <div className="col g4" style={{ maxWidth: 760 }}>
          <div className="h4 row g6 ac"><Icon n="broadcast-line" s={18} c="var(--accent)" /> Real-time data feasibility</div>
          <span className="s13 muted">How much of the real market we can see with refreshable data: maps, public APIs (Google Places, Open Charge Map), government registrations (FSSAI, FDA, RBI, PESO, BIS, GST…) and industry platforms (Swiggy, Zomato, Blinkit, Practo, brand locators). Competitors that close drop out automatically and every score recomputes.</span>
        </div>
        <div className="row g6 ac">
          <button type="button" className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>All 30</button>
          <button type="button" className={`chip ${filter === 'live' ? 'on' : ''}`} onClick={() => setFilter('live')}>{liveCount} live</button>
        </div>
      </div>

      {!all.data ? <Skel h={180} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(138px, 1fr))', gap: 10, maxHeight: 430, overflowY: 'auto', paddingRight: 4 }}>
          {cats.map((c) => (
            <button key={c.key} type="button" onClick={() => onSelect?.(c.key)} className="card pad12 col g4"
              style={{ textAlign: 'left', cursor: 'pointer', border: c.key === selected ? '2px solid var(--accent)' : '1px solid var(--line)', background: 'var(--surface, var(--bg))', minWidth: 0 }}>
              <span className="s11 muted row g4 ac" style={{ minHeight: 30 }}><Icon n={c.icon} s={13} /> {c.name}</span>
              <span className="num b" style={{ fontSize: 40, lineHeight: 1.05, color: tone(c.feasibility) }}>{c.feasibility}%</span>
              <span className={`tag ${c.mode === 'live' ? 'ok' : c.live ? 'info' : ''}`} style={{ alignSelf: 'flex-start', fontSize: 10 }}>
                {c.mode === 'live' ? `Live · ${c.liveOutlets ?? ''} · ${ago(c.lastSuccessAt)}` : c.live ? 'Live · awaiting sync' : 'Simulated · sources mapped'}
              </span>
            </button>
          ))}
        </div>
      )}

      {!cur ? <Skel h={220} /> : (
        <div className="col g14" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <div className="row g16 as stack-md">
            <div className="col g6" style={{ width: 300, maxWidth: '100%' }}>
              <span className="s12 muted">{cur.name}</span>
              <span className="num b" style={{ fontSize: 64, lineHeight: 1, color: tone(cur.feasibility) }}>{cur.feasibility}%</span>
              <span className="s12 muted">real-time data feasibility</span>
              {Object.entries(cur.parts).map(([k, v]) => (
                <div key={k} className="row g8 ac s12">
                  <span style={{ width: 128 }} className="muted">{PART_LABEL[k]}</span>
                  <div className="f1" style={{ height: 8, background: 'var(--line)', borderRadius: 4 }}><div style={{ width: `${v}%`, height: 8, borderRadius: 4, background: tone(v) }} /></div>
                  <span className="num" style={{ width: 34, textAlign: 'right' }}>{v}%</span>
                </div>
              ))}
              <span className="s11 faint">40% map + 25% registration + 20% freshness + 15% platform signal. Assessed estimate for Pune.</span>
              <span className="s12 muted" style={{ lineHeight: 1.5 }}>{cur.note}</span>
            </div>

            <div className="col g8 f1" style={{ minWidth: 0 }}>
              <b className="s13">Sources for {cur.name}</b>
              <div style={{ overflowX: 'auto' }}>
                <table className="t" style={{ minWidth: 560 }}>
                  <thead><tr><th>Source</th><th>Type</th><th>Access</th><th>Real-time</th><th>Status</th></tr></thead>
                  <tbody>
                    {cur.sources.map((s) => (
                      <tr key={s.id}>
                        <td><span className="b s12">{s.name}</span><div className="s11 muted">{s.note} · {s.refresh}</div></td>
                        <td><span className="row g4 ac s12"><Icon n={TYPE[s.type][1]} s={13} c="var(--accent)" />{TYPE[s.type][0]}</span></td>
                        <td className="s11 muted">{s.access}</td>
                        <td><span className="num b" style={{ color: tone(s.realtime) }}>{s.realtime}%</span></td>
                        <td>
                          {s.connected ? <span className="tag ok" style={{ fontSize: 10 }}>Connected{s.records ? ` · ${s.records}` : ''}</span>
                            : <span className={`tag ${INTEG[s.integration][1]}`} style={{ fontSize: 10 }}>{INTEG[s.integration][0]}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {cur.live && (
            <div className="row g16 as stack-md s12 muted">
              <div className="col g4 f1">
                <span>Removed (no longer exist): {Object.values(cur.counts?.closed || {}).reduce((a, b) => a + b, 0)}
                  {Object.keys(cur.counts?.closed || {}).length > 0 && ` (${Object.entries(cur.counts.closed).map(([k, v]) => `${k.replace(/_/g, ' ').toLowerCase()}: ${v}`).join(', ')})`}</span>
                {cur.lastSync && <span>Last sync {ago(cur.lastSync.at)} · {cur.lastSync.ok ? `+${cur.lastSync.added || 0} new, ${cur.lastSync.closed || 0} closed, ${cur.lastSync.nameCoverage ?? '—'}% named` : `failed: ${cur.lastSync.error}`}{cur.lastSync.warnings?.length ? ` · ${cur.lastSync.warnings.join('; ')}` : ''}</span>}
                {user && <button type="button" className="btn out sm" style={{ alignSelf: 'flex-start' }} disabled={!!busy} onClick={() => refresh(cur.key)}><Icon n="refresh-line" s={14} /> {busy === cur.key ? 'Fetching live data…' : 'Refresh now'}</button>}
                {msg && <span className="s12" style={{ color: 'var(--text)' }}>{msg}</span>}
              </div>
              {(closed.data?.competitors || []).length > 0 && (
                <div className="col g4 f1">
                  <b className="s12" style={{ color: 'var(--text)' }}>Removed competitors (closed / what-if)</b>
                  {closed.data.competitors.slice(0, 6).map((p) => (
                    <div key={p.id} className="row g8 ac">
                      <span className="f1">{p.name} · {p.locality} · {(p.closedReason || '').replace(/_/g, ' ').toLowerCase()}</span>
                      {user && ['WHAT_IF', 'USER_REPORTED'].includes(p.closedReason) && <button type="button" className="btn ghost sm" disabled={!!busy} onClick={() => restore(p.id)}>Restore</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {!cur.live && <span className="s12 muted">This category still runs on the simulated layer. Its sources are mapped above; switching it to live needs an OSM tag + Google Places type entry in <code>liveSources.js</code> and, optionally, registry/platform feeds.</span>}
        </div>
      )}
    </div>
  );
}
