import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, fieldErrors } from '../lib/api.js';
import { useApp } from '../lib/state.jsx';
import { inr, km, parseNum } from '../lib/format.js';
import { Header, Footer, SystemBanners } from '../components/Layout.jsx';
import { Icon, Field, Seg, Tier, Conf, Kv, Banner, Skel } from '../components/ui.jsx';
import HexMap from '../components/HexMap.jsx';

export default function Check() {
  const { category, catInfo, categories, setCategory } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [mode, setMode] = useState('pin');
  const [v, setV] = useState({ lat: sp.get('lat') || '', lon: sp.get('lon') || '', rent: '', area: catInfo?.areaSqft && catInfo.areaSqft <= 20000 ? String(catInfo.areaSqft) : '', q: '' });
  const [errs, setErrs] = useState({});
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState([]);
  useEffect(() => { if (catInfo && !v.area) setV((x) => ({ ...x, area: catInfo.areaSqft <= 20000 ? String(catInfo.areaSqft) : '' })); }, [catInfo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sp.get('lat') && sp.get('lon')) run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mode !== 'address' || !v.q.trim()) { setSugg([]); return undefined; } const t = setTimeout(() => api(`/search?q=${encodeURIComponent(v.q)}`).then((r) => setSugg(r.results)).catch(() => {}), 200); return () => clearTimeout(t); }, [v.q, mode]);

  async function run() {
    const lat = parseNum(v.lat), lon = parseNum(v.lon), rent = parseNum(v.rent), area = parseNum(v.area);
    const e = {};
    if (!Number.isFinite(lat)) e.lat = mode === 'pin' ? 'Click the map to drop a pin' : 'Latitude must be a number';
    if (!Number.isFinite(lon)) e.lon = 'Longitude must be a number';
    if (rent != null && (!Number.isFinite(rent) || rent < 10 || rent > 1000)) e.rent = 'Allowed range ₹10 – ₹1,000. Did you enter monthly total rent?';
    if (area != null && (!Number.isFinite(area) || area < 200 || area > 20000)) e.area = 'Allowed 200 – 20,000 sq ft';
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true); setRes(null);
    try { setRes(await api('/check', { method: 'POST', body: { category, lat, lon, ...(rent != null ? { rent } : {}), ...(area != null ? { area } : {}) } })); }
    catch (er) { const fe = fieldErrors(er); setErrs(Object.keys(fe).length ? fe : { form: er.message }); }
    finally { setBusy(false); }
  }
  const pin = Number.isFinite(parseNum(v.lat)) && Number.isFinite(parseNum(v.lon)) ? { lat: parseNum(v.lat), lon: parseNum(v.lon), n: res ? (res.eligible ? '' : '!') : '', color: res ? (res.eligible ? 'var(--ok)' : 'var(--bad)') : undefined, label: 'Your pin' } : null;
  const alts = res && !res.eligible ? res.alternatives.map((a, i) => ({ lat: a.lat, lon: a.lon, n: i + 1, color: 'var(--ok)', onClick: () => nav(`/location/${a.cell}`) })) : [];
  const site = res?.site;

  return (
    <div className="page">
      <Header back />
      <SystemBanners />
      <div className="wrapx col g20" style={{ padding: '24px 28px' }}>
        <div className="col g4"><h1 className="h2">Check a location</h1><span className="muted s14">Have a specific address or quoted rent? Get a verdict in about 2 seconds.</span></div>
        <div className="row as g20 stack-md">
          <form className="card pad24 col g16" style={{ width: 420, maxWidth: '100%' }} onSubmit={(e) => { e.preventDefault(); run(); }} noValidate>
            <Seg value={mode} onChange={setMode} items={[{ value: 'pin', label: 'Drop pin', icon: 'map-pin-line' }, { value: 'address', label: 'Locality', icon: 'road-map-line' }, { value: 'latlon', label: 'Lat / lon', icon: 'global-line' }]} />
            {mode === 'pin' && <Banner tone="info" icon="cursor-line">Click anywhere on the map to drop a pin.</Banner>}
            {mode === 'address' && <div className="col g6" style={{ position: 'relative' }}><Field label="Locality" icon="search-line" value={v.q} onChange={(x) => setV({ ...v, q: x })} placeholder="e.g. Kothrud" />
              {sugg.length > 0 && <div className="popover" style={{ top: 72, left: 0, right: 0 }}>{sugg.map((s) => <button type="button" key={s.name} onClick={() => { setV({ ...v, q: s.name, lat: s.lat.toFixed(5), lon: s.lon.toFixed(5) }); setSugg([]); }}><Icon n="map-pin-line" s={16} c="var(--muted)" />{s.name}</button>)}</div>}</div>}
            <div className="row g10"><div className="f1"><Field label="Latitude" value={v.lat} onChange={(x) => setV({ ...v, lat: x })} error={errs.lat} disabled={mode === 'pin'} /></div><div className="f1"><Field label="Longitude" value={v.lon} onChange={(x) => setV({ ...v, lon: x })} error={errs.lon} disabled={mode === 'pin'} /></div></div>
            <Field label="Quoted rent (optional)" value={v.rent} onChange={(x) => setV({ ...v, rent: x })} suffix="₹/sq ft/month" error={errs.rent} help="Leave empty to use the locality benchmark rent index" />
            <Field label="Store area" value={v.area} onChange={(x) => setV({ ...v, area: x })} suffix="sq ft" error={errs.area} help="Allowed 200 – 20,000" />
            <Field label="Category" value={category} onChange={(k) => { setCategory(k); setRes(null); }} options={categories.map((c) => ({ value: c.key, label: c.name }))} />
            {errs.form && <Banner tone="bad" icon="error-warning-line">{errs.form}</Banner>}
            <button className="btn ink lg" disabled={busy}>{busy ? <Icon n="loader-4-line" className="spin" /> : <Icon n="crosshair-2-line" s={18} />}Check this location</button>
            <div className="s12 muted">Pins outside Pune &amp; PCMC are rejected with a field message.</div>
          </form>
          <div className="col g16 f1" style={{ minWidth: 0 }}>
            <div style={{ height: 320 }}><HexMap features={null} pin={pin} picks={alts} center={pin ? [pin.lat, pin.lon] : [18.555, 73.85]} zoom={pin ? 14 : 11} legend={false} onMapClick={mode === 'pin' ? (p) => { setV((x) => ({ ...x, lat: p.lat.toFixed(5), lon: p.lon.toFixed(5) })); setRes(null); setErrs({}); } : undefined} /></div>
            {busy && <Skel h={180} style={{ borderRadius: 16 }} />}
            {!res && !busy && <div className="card pad20 s13 muted">Drop a pin or enter coordinates, then press Check. A pass shows tier, P10–P90 profit, break-even rent and stress tests; a fail shows the rule it breaks and the three nearest suitable cells.</div>}
            {res && !res.eligible && <div className="card pad20 col g12" style={{ borderColor: 'var(--bad)' }}>
              <div className="row sb wrap g8"><span className="row g8 h4"><Icon n="close-circle-fill" s={20} c="var(--bad)" />Not suitable for {catInfo?.name.toLowerCase()}</span><span className="tag">{res.locality}</span></div>
              <div className="col g8">{res.reasons.map((r) => <div key={r.code} className="row g10 s13 panel pad12 wrap"><span className="tag bad">{r.code}</span><span>{r.message}</span></div>)}</div>
              <div className="b s13">3 nearest suitable cells</div>
              {res.alternatives.map((a, i) => <button key={a.cell} className="row g10 s13" style={{ textAlign: 'left' }} onClick={() => nav(`/location/${a.cell}`)}><span className="tier A" style={{ background: 'var(--okSoft)', color: 'var(--ok)' }}>{i + 1}</span><span className="f1 b">{a.locality}</span><span className="muted">{km(a.distKm)}</span><Tier t={a.tier} /><span className="b num">{inr(a.profit.exp)}</span><Icon n="arrow-right-s-line" s={16} /></button>)}
            </div>}
            {site && <div className="card pad20 col g12">
              <div className="row sb wrap g8"><span className="row g8 h4"><Icon n={site.tier === 'C' ? 'error-warning-fill' : 'checkbox-circle-fill'} s={20} c={site.tier === 'C' ? 'var(--warn)' : 'var(--ok)'} />Tier {site.tier} · {site.tier === 'A' ? 'suitable and profitable in a weak year' : site.tier === 'B' ? 'suitable, profitable on average' : 'passes rules but not profitable'}</span><span className="tag">{res.locality}</span></div>
              {res.insufficient && <Banner tone="warn" icon="database-2-line">Low data coverage ({site.coverage.toFixed(2)}): treat this verdict with caution; try a nearby denser cell.</Banner>}
              {site.flags.includes('EMPTY_MARKET') && <Banner tone="bad" icon="user-unfollow-line">Empty market: no competitors, but households are below the category minimum. Not recommended.</Banner>}
              <div className="grid4"><Kv k="Profit P10 – exp" v={`${inr(site.profit.p10)} – ${inr(site.profit.exp)}`} /><Kv k="Break-even rent" v={`₹${Math.round(site.breakevenRent)}`} sub={`vs ₹${site.rent} quoted/assumed`} /><Kv k="Revenue P50" v={inr(site.revenue.p50)} /><Kv k="Stress tests" v={`${site.stress.passes} of 4`} /></div>
              <div className="row g8 wrap"><Conf c={site.confidence} />{site.cannibalisation && <span className="tag info">Takes {inr(site.cannibalisation.takenRs)} from your stores</span>}</div>
              <button className="btn out sm" style={{ alignSelf: 'flex-start' }} onClick={() => nav(`/location/${site.cell}`)}>Open full location page <Icon n="arrow-right-line" s={14} /></button>
            </div>}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
