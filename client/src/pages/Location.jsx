import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, fieldErrors } from '../lib/api.js';
import { useApp, useAuth, useToast, useApi } from '../lib/state.jsx';
import { inr, pct, km, n, parseNum, cleanAiText } from '../lib/format.js';
import { Header, Footer, SystemBanners } from '../components/Layout.jsx';
import { Icon, Tier, Conf, Sim, Kv, RangeBar, Tabs, Field, Modal, Skel, ErrorBox, Photo, Banner, AiStreamingText } from '../components/ui.jsx';
import { SimilarRow } from '../components/Cards.jsx';
import HexMap from '../components/HexMap.jsx';
import CompetitorAnalysisModal from '../components/CompetitorModal.jsx';

const STRESS_ORDER = ['competitor500m', 'rentUp25', 'demandDown15', 'marginDown2'];
const LANDUSE = [['res', 'Residential'], ['com', 'Commercial'], ['ind', 'Industrial'], ['green', 'Green'], ['water', 'Water']];

const locationExplainCache = new Map();

function getCachedExplain(cellId, category) {
  if (!cellId) return null;
  const key = `loc_ex_${cellId}_${category}`;
  if (locationExplainCache.has(key)) return locationExplainCache.get(key);
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      locationExplainCache.set(key, parsed);
      return parsed;
    }
  } catch {}
  return null;
}

function setCachedExplain(cellId, category, val) {
  if (!cellId || !val) return;
  const key = `loc_ex_${cellId}_${category}`;
  locationExplainCache.set(key, val);
  try { sessionStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export default function Location() {
  const { cellId } = useParams();
  const [searchParams] = useSearchParams();
  const hParam = searchParams.get('h');
  const { category, catInfo, picks, setPicks, locality, setLocality, compare, setCompare } = useApp();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const d = useApi(`/cells/${cellId}?category=${category}`, [category, cellId]);
  const hex = useApi(`/cells?category=${category}`, [category]);
  const [ex, setEx] = useState(() => getCachedExplain(cellId, category));
  const [tab, setTab] = useState('Summary');
  const [ai, setAi] = useState(false);
  const [simFilter, setSimFilter] = useState('all');
  const sim = useApi(`/cells/${cellId}/similar?category=${category}&filter=${simFilter}`, [category, simFilter, cellId]);
  const [savedId, setSavedId] = useState(null);
  const [modal, setModal] = useState(null);
  const [rent, setRent] = useState(null);
  const [selectedComp, setSelectedComp] = useState(null);

  // When locality changes from the header picker or anywhere, update immediately to H1 in that location
  const prevLocalityRef = useRef(locality?.name);
  useEffect(() => {
    if (prevLocalityRef.current !== undefined && prevLocalityRef.current !== locality?.name) {
      prevLocalityRef.current = locality?.name;
      const body = { category: category || 'all', k: 8 };
      if (locality?.lat && locality?.lon) {
        body.lat = locality.lat;
        body.lon = locality.lon;
      }
      api('/recommend', { method: 'POST', body })
        .then((r) => {
          if (r.picks?.length > 0) {
            setPicks(r.picks);
            nav(`/location/${r.picks[0].cell}?h=1`);
          }
        })
        .catch(() => {});
    } else {
      prevLocalityRef.current = locality?.name;
    }
  }, [locality?.name, category, nav, setPicks]);

  // Ensure picks are loaded for the sequence navigation
  useEffect(() => {
    const siteObj = d.data?.site;
    if (!siteObj) return;
    if (!picks || picks.length === 0) {
      const body = { category: category || 'all', k: 8 };
      if (siteObj.lat && siteObj.lon) {
        body.lat = siteObj.lat;
        body.lon = siteObj.lon;
      } else if (locality?.lat && locality?.lon) {
        body.lat = locality.lat;
        body.lon = locality.lon;
      }
      api('/recommend', { method: 'POST', body })
        .then((r) => { if (r.picks?.length > 0) setPicks(r.picks); })
        .catch(() => {});
    }
  }, [d.data?.site?.cell, category, locality]);

  useEffect(() => {
    const cached = getCachedExplain(cellId, category);
    if (cached) {
      setEx(cached);
      return;
    }
    setEx(null);
    api('/explain', { method: 'POST', body: { cellId, category } })
      .then((r) => {
        setCachedExplain(cellId, category, r);
        setEx(r);
      })
      .catch((e) => setEx({ error: e }));
  }, [cellId, category]);
  useEffect(() => { api('/saved').then((r) => setSavedId(r.saved.find((x) => x.cell === cellId && x.category === category)?._id || null)).catch(() => {}); }, [cellId, category]);
  useEffect(() => { setRent(null); setTab('Summary'); }, [cellId]);

  const site = d.data?.site;
  const pick = picks.find((p) => p.cell === cellId);

  // Compute all cells in this locality sorted by ML expected profit descending
  const localityCells = useMemo(() => {
    if (!hex.data?.features || !site?.locality) return [];
    const loc = site.locality.trim().toLowerCase();
    const matching = hex.data.features.filter((f) => {
      const fLoc = (f.properties?.locality || '').trim().toLowerCase();
      return fLoc === loc;
    });
    return matching.sort((a, b) => {
      if (a.properties?.eligible !== b.properties?.eligible) {
        return a.properties?.eligible ? -1 : 1;
      }
      return (b.properties?.exp || 0) - (a.properties?.exp || 0);
    });
  }, [hex.data?.features, site?.locality]);

  const localityIndex = localityCells.findIndex((f) => f.properties?.id === cellId);

  let currentIndex = 0;
  if (localityIndex !== -1) {
    currentIndex = localityIndex;
  } else if (hParam && !isNaN(Number(hParam))) {
    currentIndex = Math.max(0, Number(hParam) - 1);
  } else if (site?.rank) {
    currentIndex = Math.max(0, site.rank - 1);
  } else {
    const pickIndexInList = picks.findIndex((p) => p.cell === cellId);
    if (pickIndexInList !== -1) currentIndex = pickIndexInList;
  }

  const hexIndex = currentIndex + 1;
  const hexLabel = `H${hexIndex}`;
  const hexLocationName = `${hexLabel} in ${site?.locality || 'Location'}`;

  // Forward and backward sequence states strictly based on real locality ML cells
  const totalCount = localityCells.length > 0 ? localityCells.length : (picks.length > 0 ? picks.length : 1);
  const isPrevDisabled = currentIndex <= 0;
  const isNextDisabled = currentIndex >= totalCount - 1;

  const handlePrevLocation = () => {
    if (isPrevDisabled) return;
    const prevIdx = currentIndex - 1;
    if (localityCells[prevIdx]?.properties?.id) {
      nav(`/location/${localityCells[prevIdx].properties.id}?h=${prevIdx + 1}`);
    } else if (picks[prevIdx]?.cell) {
      nav(`/location/${picks[prevIdx].cell}?h=${prevIdx + 1}`);
    }
  };

  const handleNextLocation = () => {
    if (isNextDisabled) return;
    const nextIdx = currentIndex + 1;
    if (localityCells[nextIdx]?.properties?.id) {
      nav(`/location/${localityCells[nextIdx].properties.id}?h=${nextIdx + 1}`);
    } else if (picks[nextIdx]?.cell) {
      nav(`/location/${picks[nextIdx].cell}?h=${nextIdx + 1}`);
    }
  };

  const shareUrl = window.location.href;
  const share = async () => {
    try { if (navigator.share) await navigator.share({ title: `Karyakshetram · ${hexLocationName}`, url: shareUrl }); else { await navigator.clipboard.writeText(shareUrl); toast('Link copied', { icon: 'link' }); } }
    catch { /* cancelled */ }
  };
  const toggleSave = async () => {
    try {
      if (savedId) { await api(`/saved/${savedId}`, { method: 'DELETE' }); setSavedId(null); toast('Removed from saved', { icon: 'bookmark-line', tone: 'info' }); }
      else { const r = await api('/saved', { method: 'POST', body: { cellId, category, name: hexLocationName } }); setSavedId(r.saved._id); toast('Saved to Shortlist', { icon: 'bookmark-fill', tone: 'acc' }); }
    } catch (e) { toast(e.message, { tone: 'bad', icon: 'error-warning-line' }); }
  };

  const handleLocationCompare = () => {
    if (compare.includes(cellId)) {
      setCompare(compare.filter((c) => c !== cellId));
      toast(`Removed ${hexLocationName} from comparison`, { tone: 'info', icon: 'delete-bin-line' });
      return;
    }
    if (compare.length === 0) {
      setCompare([cellId]);
      toast(`Added ${hexLocationName} to compare (1 of 3)`, { tone: 'ok', icon: 'scales-3-line' });
      return;
    }
    nav(`/compare?add=${cellId}&name=${encodeURIComponent(hexLocationName)}`);
  };

  if (d.error) return <div className="page page-full"><Header back /><div className="wrapx" style={{ padding: 40 }}><div className="card"><ErrorBox error={d.error} onRetry={d.refetch} /></div></div></div>;
  if (!site) return <div className="page page-full"><Header back /><div className="wrapx col g16" style={{ padding: '20px 28px' }}><Skel h={420} style={{ borderRadius: 18 }} /><Skel h={34} w="50%" /><Skel h={140} style={{ borderRadius: 16 }} /></div></div>;

  const eligible = site.eligible.ok;
  const cn = site.cannibalisation;
  const comps = d.data.competitors || [];
  const whatIf = rent != null ? (() => { const r = Number(rent); const e = site.revenue.p50 * site.margin - r * site.area * 12 - site.opex; const p10 = site.revenue.p10 * site.margin - r * site.area * 12 - site.opex; return { e, p10, tier: p10 > 0 ? 'A' : e > 0 ? 'B' : 'C' }; })() : null;

  return (
    <div className="page page-full">
      <Header back />
      <SystemBanners />
      <div className="row as wrapx stack-md" style={{ padding: '20px clamp(16px, 2.5vw, 36px) 48px', gap: 28, width: '100%', boxSizing: 'border-box' }}>
        <div className="col g16 f1" style={{ minWidth: 0 }}>
          {/* Forward and backward sequence navigation above map */}
          <div className="row sb ac wrap g8" style={{ padding: '2px 0 4px' }}>
            <div className="row g8 ac">
              <button
                type="button"
                className="btn out sm"
                disabled={isPrevDisabled}
                onClick={handlePrevLocation}
                style={{
                  opacity: isPrevDisabled ? 0.45 : 1,
                  cursor: isPrevDisabled ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  gap: 6,
                }}
                aria-label="Previous location in sequence"
              >
                <Icon n="arrow-left-s-line" s={16} />
                <span>Previous{currentIndex > 0 ? ` (H${currentIndex})` : ''}</span>
              </button>
              <button
                type="button"
                className="btn out sm"
                disabled={isNextDisabled}
                onClick={handleNextLocation}
                style={{
                  opacity: isNextDisabled ? 0.45 : 1,
                  cursor: isNextDisabled ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  gap: 6,
                }}
                aria-label="Next location in sequence"
              >
                <span>Next{currentIndex < totalCount - 1 ? ` (H${currentIndex + 2})` : ''}</span>
                <Icon n="arrow-right-s-line" s={16} />
              </button>
            </div>
            <div className="row g8 ac">
              <span className="tag acc" style={{ fontWeight: 700, fontSize: 13, padding: '4px 10px', borderRadius: 999 }}>
                {hexLabel} in {site?.locality || 'Location'}
              </span>
              {totalCount > 1 && (
                <span className="s12 muted">
                  Sequence {currentIndex + 1} of {totalCount}
                </span>
              )}
            </div>
          </div>

          <div style={{ height: 420, position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
            <HexMap
              features={hex.data?.features.filter((f) => {
                const [lo, la] = f.geometry.coordinates[0][0];
                return Math.abs(la - site.lat) < 0.04 && Math.abs(lo - site.lon) < 0.045;
              })}
              selected={cellId}
              picks={[{ lat: site.lat, lon: site.lon, n: hexIndex, label: hexLabel }]}
              rings={[{ lat: site.lat, lon: site.lon, km: site.catchment.km }]}
              comps={comps}
              center={[site.lat, site.lon]}
              zoom={14}
              legend={false}
              controls={true}
              onCellClick={(f) => {
                if (f.properties?.id) {
                  nav(`/location/${f.properties.id}?h=${f.properties.hIndex || 1}`);
                }
              }}
            />
            <span className="tag maptag" style={{ left: 14, top: 14, background: 'var(--bg)', height: 28 }}><Icon n="map-pin-2-line" s={14} />{site.catchment.km} km {catInfo?.name.toLowerCase() || ''} catchment · {comps.length} competitors</span>
          </div>
          <h1 className="h2">{hexLocationName}{pick?.label && pick.label !== 'Location' ? <span className="muted s16" style={{ fontWeight: 400 }}> · {pick.label}</span> : null}</h1>
          <div className="row sb wrap g12">
            <div className="row g8 wrap">{eligible ? <Tier t={site.tier} /> : <span className="tag bad">Not suitable</span>}{pick && <span className="tag acc"><Icon n={pick.icon} s={12} />{pick.label}</span>}<Conf c={site.confidence} /><Sim /></div>
            <div className="row g8 wrap">
              <button className="btn out" onClick={share}><Icon n="share-forward-line" s={16} />Share</button>
              <button className={`btn ${ai ? 'pri' : 'out'}`} onClick={() => setAi(!ai)} aria-pressed={ai}><Icon n="sparkling-2-line" s={16} c={ai ? '#fff' : 'var(--accent2)'} />AI summary</button>
              <button className="btn out" onClick={toggleSave}><Icon n={savedId ? 'bookmark-fill' : 'bookmark-line'} s={16} c={savedId ? 'var(--accent)' : undefined} />{savedId ? 'Saved' : 'Save'}</button>
              <button className={`btn ${compare.includes(cellId) ? 'soft' : 'out'}`} onClick={handleLocationCompare}><Icon n="scales-3-line" s={16} />{compare.includes(cellId) ? 'In compare' : 'Compare'}</button>
            </div>
          </div>
          {!eligible && <Banner tone="bad" icon="forbid-line" action={<button className="btn out sm" onClick={() => nav(`/check?lat=${site.lat}&lon=${site.lon}`)}>See alternatives</button>}>This cell fails a {catInfo?.name.toLowerCase()} rule: {site.eligible.reasons.join(', ')}.</Banner>}
          {d.data.visit?.quotedRent && <Banner tone="info" icon="map-pin-user-line">Using quoted rent ₹{d.data.visit.quotedRent} / sq ft / mo from the site visit by {d.data.visit.author} on {new Date(d.data.visit.createdAt).toLocaleDateString('en-IN')}.</Banner>}
          <div className="panel pad20 col g16">
            <div className="row g8 s13 wrap"><b>{catInfo?.name} · {n(site.area)} sq ft</b><span className="muted">· Scored {new Date(d.data.scoredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · model {d.data.modelVersion}{d.data.source !== 'ml' ? ' (placeholder engine)' : ''}</span></div>
            <div className="grid5">
              <Kv k="Revenue P50" v={inr(site.revenue.p50)} sub={`P10 ${inr(site.revenue.p10)} · P90 ${inr(site.revenue.p90)}`} />
              <Kv k="Exp profit" v={inr(site.profit.exp)} sub="per year" />
              <Kv k="Downside (P10)" v={inr(site.profit.p10)} sub={site.profit.p10 > 0 ? 'still positive' : 'loss in a weak year'} />
              <Kv k="Break-even rent" v={`₹${Math.round(site.breakevenRent)} / sq ft / mo`} sub={`Benchmark ₹${site.rent} / sq ft / mo · Headroom ${site.breakevenRent >= site.rent ? '+' : ''}₹${Math.round(site.breakevenRent - site.rent)}`} />
              <Kv k="Takes from own" v={cn ? inr(cn.takenRs) : '—'} sub={cn ? `${pct(cn.ratio)} of its revenue` : 'No own stores of this category'} />
            </div>
          </div>
          <Tabs items={['Summary', 'Why here', 'Risks', 'Neighbourhood', 'Money']} value={tab} onChange={setTab} />
          {tab === 'Summary' && <div className="row as g16 stack-md">
            <div className="card pad20 col g12 f1"><div className="h4">Revenue range (calibrated 80%)</div>
              <div className="col g6"><RangeBar {...site.revenue} /><div className="row sb s12 muted num"><span>P10 {inr(site.revenue.p10)}</span><span className="b" style={{ color: 'var(--text)' }}>P50 {inr(site.revenue.p50)}</span><span>P90 {inr(site.revenue.p90)}</span></div></div>
              <div className="divider" /><div className="h4">Why here · drivers</div><Drivers shap={site.shap} />
            </div>
            <Stress site={site} onCann={() => nav(`/cannibalisation/${cellId}`)} />
          </div>}
          {tab === 'Why here' && <div className="card pad20 col g16"><div className="h4">Contribution to expected profit (vs a typical site)</div><Drivers shap={site.shap} />
            <div className="divider" /><div className="h4">Evidence record</div>
            {ex?.evidence ? <table className="t"><tbody>{ex.evidence.items.map((i) => <tr key={i.id}><td className="muted" style={{ width: 70 }}>{i.id}</td><td>{i.label}</td><td className="b num">{i.text}</td></tr>)}</tbody></table> : <Skel h={120} />}
            <span className="s12 muted">Placeholder attribution until the ML service returns SHAP values (FR-09). Additivity: drivers sum to expected profit minus the typical-site baseline.</span></div>}
          {tab === 'Risks' && <div className="card pad20 col g12"><div className="h4">Risks and flags</div>
            {ex?.risks?.length ? ex.risks.map((r) => <div key={r.code} className="row g10 panel pad12 s13"><span className="tag warn">{r.code}</span><span>{r.text}</span></div>) : <div className="s13 muted">{ex ? 'No material risks flagged for this site.' : 'Loading…'}</div>}
            <div className="divider" /><Stress site={site} inline /></div>}
          {tab === 'Neighbourhood' && <div className="row as g16 stack-md">
            <div className="card pad20 col g12 f1"><div className="h4">Land use within the cell</div>
              {LANDUSE.map(([k, t]) => <div key={k} className="row g10 s13"><span style={{ width: 100 }}>{t}</span><div className="bar f1"><b style={{ width: `${(d.data.neighbourhood.landuse[k] || 0) * 100}%` }} /></div><span className="b num" style={{ width: 44, textAlign: 'right' }}>{Math.round((d.data.neighbourhood.landuse[k] || 0) * 100)}%</span></div>)}
              <div className="divider" /><div className="grid3">
                <Kv k="Population 2020" v={n(d.data.neighbourhood.features.pop2020)} sub={`${pct(site.popChange)} since 2015`} />
                <Kv k={`Households · ${site.catchment.km} km`} v={n(site.catchment.households)} />
                <Kv k="Nearest major road" v={`${d.data.neighbourhood.features.roadDistM} m`} />
                <Kv k="Schools / offices" v={`${d.data.neighbourhood.features.anchors.schools} / ${d.data.neighbourhood.features.anchors.offices}`} />
                <Kv k="Hospitals / transit" v={`${d.data.neighbourhood.features.anchors.hospitals} / ${d.data.neighbourhood.features.anchors.transit}`} />
                <Kv k="Data coverage" v={site.coverage.toFixed(2)} />
              </div></div>
            <div className="card pad20 col g8" style={{ width: 340 }}><div className="row sb"><div className="h4">Competitors in catchment</div><span className="tag">{site.catchment.competitors}</span></div>
              {comps.length ? comps.slice(0, 10).map((c) => (
                <div
                  key={c.id}
                  className="row sb ac s13"
                  style={{ padding: '8px 6px', borderTop: '1px solid var(--line)', cursor: 'pointer', borderRadius: 8 }}
                  onClick={() => setSelectedComp({ ...c, category, relation: 'Competitor', cell: cellId, locality: site.locality })}
                  role="button"
                  tabIndex={0}
                >
                  <div className="row g6 ac">
                    <Icon n="store-2-line" s={14} c="var(--accent)" />
                    <span className="b">{c.name}</span>
                    {c.brandClass && <span className="tag sm">{c.brandClass}</span>}
                  </div>
                  <div className="row g4 ac">
                    <span className="muted">{km(c.distKm)}</span>
                    <Icon n="arrow-right-s-line" s={14} c="var(--muted)" />
                  </div>
                </div>
              )) : <span className="s13 muted">No competitors within the catchment. Check the empty-market flag before treating this as an opportunity.</span>}</div>
          </div>}
          {tab === 'Money' && <div className="row as g16 stack-md">
            <div className="card pad20 col g10 f1"><div className="h4">Yearly P&amp;L at P50</div>
              {[
                ['Revenue', site.revenue.p50],
                [`Gross margin (${Math.round(site.margin * 100)}%)`, site.revenue.p50 * site.margin],
                [`Rent (₹${site.rent} / sq ft / mo · ₹${Math.round(site.rent * site.area).toLocaleString('en-IN')}/mo)`, -site.rent * site.area * 12],
                ['Operating cost', -site.opex],
                ['Expected profit', site.profit.exp]
              ].map(([k, v], i) => <div key={k} className={`row sb s14 ${i === 4 ? 'b' : ''}`} style={{ padding: '8px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}><span className={i === 0 ? 'muted' : ''}>{k}</span><span className="num">{inr(v)}</span></div>)}
              <div className="row sb s13 muted"><span>Capex (one-time)</span><span>{inr(site.capex)} · payback {site.profit.exp > 0 ? `${(site.capex / site.profit.exp).toFixed(1)} yrs` : 'n/a'}</span></div>
              {cn && <div className="row sb s13"><span className="muted">Lost margin at your stores</span><span className="num">−{inr(cn.lostMargin)} · net {inr(cn.netNetworkProfit)}</span></div>}
            </div>
            <div className="card pad20 col g12" style={{ width: 360 }}><div className="h4">What if the rent changes?</div>
              <div className="row sb s13"><span className="muted">Simulated Rent</span><b>₹{rent ?? site.rent} / sq ft / mo</b></div>
              <input type="range" className="rng" min="10" max={Math.max(400, Math.round(site.breakevenRent * 1.3))} value={rent ?? site.rent} style={{ '--p': `${((rent ?? site.rent) - 10) / (Math.max(400, Math.round(site.breakevenRent * 1.3)) - 10) * 100}%` }} onChange={(e) => setRent(e.target.value)} aria-label="Rent what-if" />
              <div className="s12 muted">Monthly outflow: <b>₹{Math.round((rent ?? site.rent) * site.area).toLocaleString('en-IN')} / mo</b></div>
              {whatIf ? <div className="col g6 s13"><div className="row sb"><span className="muted">Expected profit</span><b>{inr(site.profit.exp)} → {inr(whatIf.e)}</b></div><div className="row sb"><span className="muted">Downside (P10)</span><b>{inr(site.profit.p10)} → {inr(whatIf.p10)}</b></div><div className="row sb"><span className="muted">Tier</span><span className="row g6"><Tier t={site.tier} />→<Tier t={whatIf.tier} /></span></div><button className="btn ghost sm" onClick={() => setRent(null)}>Reset</button></div>
                : <span className="s12 muted">Drag slider to test rent sensitivity. Break-even ceiling is <b>₹{Math.round(site.breakevenRent)} / sq ft / mo</b>.</span>}
            </div>
          </div>}
          <div className="col g10"><div className="h4">Site photos</div><div className="row g10">{[1, 2, 3, 4].map((i) => <div key={i} className="photo f1" style={{ height: 150 }}><Photo seed={i + 10 + cellId.charCodeAt(9)} h={150} caption={i === 1 ? 'Illustration' : ''} /></div>)}</div>
            <span className="s11 muted">Illustrations until photos are added from a site visit.</span></div>
          <div className="card pad16 row sb wrap g12">
            <span className="row g10 s13"><b>Was this recommendation useful?</b>
              <button className="iconbtn" onClick={() => api('/feedback', { method: 'POST', body: { cellId, category, rating: 'up' } }).then(() => toast('Thanks for the feedback')).catch((e) => toast(e.message, { tone: 'bad' }))} aria-label="Thumbs up"><Icon n="thumb-up-line" s={16} /></button>
              <button className="iconbtn" onClick={() => setModal('down')} aria-label="Thumbs down"><Icon n="thumb-down-line" s={16} /></button></span>
            <span className="row g8"><button className="btn out sm" onClick={() => setModal('visit')}><Icon n="map-pin-user-line" s={14} />Add site-visit notes</button><button className="btn ink sm" onClick={() => setModal('opened')}><Icon n="store-2-line" s={14} />We opened here</button></span>
          </div>
        </div>

        <aside style={{ width: 440, minWidth: 360, maxWidth: '100%', position: 'relative' }} className="col g12">
          {ai ? <AiPanel cellId={cellId} category={category} ex={ex} onClose={() => setAi(false)} /> : <>
            <div className="row g8 wrap">{[['all', 'All'], ['tierA', 'Tier A'], ['nearby', 'Nearby'], ['lowerRent', 'Lower rent']].map(([k, t]) => <button key={k} className={`chip ${simFilter === k ? 'on' : ''}`} onClick={() => setSimFilter(k)}>{t}</button>)}</div>
            <div className="b s15">Similar locations</div>
            {sim.loading && [1, 2, 3, 4].map((i) => <div key={i} className="row g12"><Skel h={96} w={168} style={{ borderRadius: 12 }} /><div className="col g6 f1"><Skel h={14} /><Skel h={12} w="70%" /></div></div>)}
            {sim.error && <ErrorBox compact error={sim.error} onRetry={sim.refetch} />}
            {sim.data?.similar?.length === 0 && <div className="s13 muted">No similar locations match this filter.</div>}
            {sim.data?.similar?.map((s, idx) => <SimilarRow key={s.cell} s={s} i={idx} onOpen={() => nav(`/location/${s.cell}?h=${idx + 1}`)}><HexMap features={null} picks={[{ lat: s.lat, lon: s.lon }]} center={[s.lat, s.lon]} zoom={13} controls={false} legend={false} interactive={false} /></SimilarRow>)}
          </>}
        </aside>
      </div>
      <Footer />
      <FeedbackModal open={modal === 'down'} onClose={() => setModal(null)} cellId={cellId} category={category} />
      <VisitModal open={modal === 'visit'} onClose={() => setModal(null)} cellId={cellId} category={category} onSaved={() => { setModal(null); d.refetch(); }} />
      <OpenedModal open={modal === 'opened'} onClose={() => setModal(null)} cellId={cellId} category={category} site={site} user={user} />
      <CompetitorAnalysisModal open={!!selectedComp} onClose={() => setSelectedComp(null)} shop={selectedComp} activeCategory={category} />
    </div>
  );
}

export function Drivers({ shap }) {
  const rows = ['Demand', 'Access', 'Network', 'Competition', 'Cost'].map((k) => [k, shap?.[k] || 0]);
  const max = Math.max(1, ...rows.map(([, v]) => Math.abs(v)));
  return <div className="col g10">{rows.map(([k, v]) => (
    <div key={k} className="row g10 s13"><span style={{ width: 90 }}>{k}</span>
      <div className="f1 row" style={{ height: 10 }}><div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>{v < 0 && <span style={{ width: `${(-v / max) * 100}%`, height: 10, borderRadius: '4px 0 0 4px', background: 'var(--muted)' }} />}</div><span style={{ width: 1, height: 16, background: 'var(--line)' }} /><div style={{ flex: 1 }}>{v > 0 && <span style={{ display: 'block', width: `${(v / max) * 100}%`, height: 10, borderRadius: '0 4px 4px 0', background: 'var(--accent)' }} />}</div></div>
      <span className="b num" style={{ width: 70, textAlign: 'right' }}>{v >= 0 ? '+' : ''}{inr(v)}</span></div>))}</div>;
}

const STRESS_CONFIG = {
  competitor500m: {
    label: 'New Competitor (within 500m)',
    sub: '-15% customer share shock',
  },
  rentUp25: {
    label: 'Landlord Rent Surge (+25%)',
    sub: 'Commercial rent hike to ₹ / sq ft / mo',
  },
  demandDown15: {
    label: 'Macro Footfall Drop (-15%)',
    sub: 'Market-wide consumer spending slump',
  },
  marginDown2: {
    label: 'Margin Compression (-2%)',
    sub: 'Inflationary supplier cost squeeze',
  },
};

export function Stress({ site, onCann, inline }) {
  const passes = site.stress?.passes ?? 0;
  const pctPass = (passes / 4) * 100;
  const tone = passes === 4 ? 'ok' : passes === 3 ? 'ok' : passes === 2 ? 'warn' : 'bad';
  const verdict =
    passes === 4
      ? 'Robust (4/4 Pass)'
      : passes === 3
      ? 'Resilient (3/4 Pass)'
      : passes === 2
      ? 'Moderate Risk (2/4 Pass)'
      : `Vulnerable (${passes}/4 Pass)`;

  return (
    <div className={inline ? 'col g12' : 'card pad20 col g14 stress-scorecard'} style={inline ? undefined : { width: 360 }}>
      <div className="row sb ac">
        <div className="row g8 ac">
          <Icon n="shield-check-line" s={18} c="var(--accent)" />
          <h4 className="h4" style={{ margin: 0 }}>Stress Test Scorecard</h4>
        </div>
        <span className={`tag ${tone} b`}>{verdict}</span>
      </div>

      {/* Visual resilience progress bar */}
      <div className="col g4">
        <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pctPass}%`,
              background: passes >= 3 ? 'var(--ok)' : passes === 2 ? 'var(--warn)' : 'var(--bad)',
              borderRadius: 99,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <span className="s11 muted">Simulates 4 severe downside macro &amp; competitive shocks</span>
      </div>

      {/* 4 Scenarios list */}
      <div className="col g8">
        {STRESS_ORDER.map((k) => {
          const s = site.stress?.[k];
          if (!s) return null;
          const conf = STRESS_CONFIG[k] || { label: s.label, sub: '' };
          return (
            <div key={k} className="stress-scenario-row row sb ac g10">
              <div className="row g10 ac f1" style={{ minWidth: 0 }}>
                <Icon
                  n={s.pass ? 'checkbox-circle-fill' : 'close-circle-fill'}
                  s={18}
                  c={s.pass ? 'var(--ok)' : 'var(--bad)'}
                />
                <div className="col g2" style={{ minWidth: 0 }}>
                  <span className="b s13 truncate">{conf.label}</span>
                  <span className="s11 muted truncate">{conf.sub}</span>
                </div>
              </div>
              <div className="row g8 ac" style={{ flexShrink: 0 }}>
                <Tier t={s.tier} />
                <span className={`b s12 num ${s.pass ? '' : 'badc'}`}>
                  {inr(s.exp)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {onCann && (
        <button
          className="btn out sm"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={onCann}
        >
          <Icon n="git-merge-line" s={14} c="var(--accent)" />
          Simulate Network Cannibalisation
        </button>
      )}
    </div>
  );
}

function AiPanel({ cellId, category, ex, onClose }) {
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const ask = async (m) => {
    const t = (m ?? q).trim(); if (!t) return; setQ(''); setBusy(true); setMsgs((x) => [...x, { me: true, text: t }]);
    try { const r = await api('/chat', { method: 'POST', body: { message: t, category, cellId } }); setMsgs((x) => [...x, { text: cleanAiText(r.answer) }]); }
    catch (e) { setMsgs((x) => [...x, { text: e.message, err: true }]); } finally { setBusy(false); }
  };
  return (
    <div className="card shadow col ai-summary-card" style={{ borderRadius: 18 }}>
      <div className="row sb pad16"><span className="b s16 row g6 ac"><Icon n="sparkling-fill" s={16} c="var(--accent2)" />Ask about this location</span><button className="iconbtn" onClick={onClose} aria-label="Close AI summary"><Icon n="close-line" /></button></div>
      <div className="col g12" style={{ padding: '0 16px 16px' }}>
        <p className="s13 muted">Curious about this site? Answers come directly from verified model predictions.</p>
        <div className="col g8" style={{ alignItems: 'flex-end' }}>{['Summarise this site', 'What breaks it in the stress tests?', 'At what rent does it stop making money?', 'How much does it take from my stores?'].map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div>
        <div className="divider" />
        <div className="col g10 s13" style={{ lineHeight: 1.6 }}><b className="s14">Summary</b>{ex?.narrative ? <AiStreamingText text={cleanAiText(ex.narrative)} speed={14} /> : <Skel h={60} />}</div>
        {msgs.map((m, i) => m.me ? <div key={i} className="bubble-me">{m.text}</div> : <div key={i} className="bubble-ai" style={m.err ? { color: 'var(--bad)' } : undefined}>{m.text}</div>)}
        {busy && <div className="bubble-ai muted row g6"><Icon n="loader-4-line" className="spin" />Thinking…</div>}
        <form className="row g8" onSubmit={(e) => { e.preventDefault(); ask(); }}><div className="input f1"><input placeholder="Ask a question…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} aria-label="Ask about this location" /></div><button className="iconbtn" disabled={busy} aria-label="Send"><Icon n="send-plane-2-line" s={16} /></button></form>
      </div>
    </div>
  );
}

function FeedbackModal({ open, onClose, cellId, category }) {
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const toast = useToast();
  const send = async () => {
    if (!reason) { setErr('Pick what was wrong'); return; }
    try { await api('/feedback', { method: 'POST', body: { cellId, category, rating: 'down', reasonCode: reason, comment: comment || undefined } }); toast('Feedback sent. It audits rules and explanations; it does not change predictions.'); onClose(); setReason(''); setComment(''); setErr(''); }
    catch (e) { setErr(e.message); }
  };
  return <Modal open={open} onClose={onClose} title="What was wrong?">
    <div className="col g12"><div className="row g6 wrap">{[['wrong_land_use', 'Wrong land use'], ['rent_unrealistic', 'Rent unrealistic'], ['competitor_missing', 'Competitor missing'], ['other', 'Other']].map(([k, t]) => <button key={k} className={`chip ${reason === k ? 'on' : ''}`} onClick={() => { setReason(k); setErr(''); }}>{t}</button>)}</div>
      {err && <span className="help err"><Icon n="error-warning-line" s={14} />{err}</span>}
      <textarea className="ta" placeholder={reason === 'competitor_missing' ? 'Which competitor? (optional)' : 'Anything else? (optional)'} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      <button className="btn ink" style={{ alignSelf: 'flex-start' }} onClick={send}>Send feedback</button></div>
  </Modal>;
}

function VisitModal({ open, onClose, cellId, category, onSaved }) {
  const [v, setV] = useState({ rent: '', footfall: '', notes: '' });
  const [errs, setErrs] = useState({});
  const toast = useToast();
  const send = async () => {
    const rent = parseNum(v.rent), ff = parseNum(v.footfall);
    const e = {}; if (rent != null && (Number.isNaN(rent) || rent < 10 || rent > 1000)) e.quotedRent = 'Rent must be between ₹10 and ₹1,000'; if (ff != null && (Number.isNaN(ff) || ff < 0)) e.footfall = 'Enter a count of 0 or more';
    if (rent == null && ff == null && !v.notes.trim()) e.notes = 'Add at least one observation';
    setErrs(e); if (Object.keys(e).length) return;
    try { await api('/visits', { method: 'POST', body: { cellId, category, quotedRent: rent ?? undefined, footfall: ff ?? undefined, notes: v.notes || undefined } }); toast('Observation saved. Quoted rent now replaces market benchmark rent.'); setV({ rent: '', footfall: '', notes: '' }); onSaved(); }
    catch (er) { setErrs(fieldErrors(er)); }
  };
  return <Modal open={open} onClose={onClose} title="Site-visit observations">
    <div className="col g14" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <div className="grid2" style={{ gap: 14, width: '100%' }}>
        <Field label="Quoted rent" value={v.rent} onChange={(x) => setV({ ...v, rent: x })} suffix="₹/sq ft/mo" placeholder="e.g. 150" error={errs.quotedRent} />
        <Field label="Footfall count" value={v.footfall} onChange={(x) => setV({ ...v, footfall: x })} suffix="/ hr" placeholder="e.g. 120" error={errs.footfall} />
      </div>
      <div className="field" style={{ width: '100%' }}>
        <label htmlFor="visit-notes">Notes</label>
        <textarea id="visit-notes" className="ta" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="Frontage, parking, visibility, foot traffic…" style={{ width: '100%', boxSizing: 'border-box' }} />
      </div>
      {errs.notes && <span className="help err">{errs.notes}</span>}
      <button className="btn ink" style={{ alignSelf: 'flex-start' }} onClick={send}>Save observation</button>
    </div>
  </Modal>;
}

function OpenedModal({ open, onClose, cellId, category, site }) {
  const [v, setV] = useState({ date: '', rev: '' });
  const [errs, setErrs] = useState({});
  const [res, setRes] = useState(null);
  const send = async () => {
    const rev = parseNum(v.rev); const e = {};
    if (!v.date) e.openedOn = 'Enter the opening date'; else if (new Date(v.date) > new Date()) e.openedOn = 'Opening date cannot be in the future';
    if (rev == null || Number.isNaN(rev) || rev <= 0) e.actualMonthlyRevenue = 'Enter monthly revenue in ₹';
    setErrs(e); if (Object.keys(e).length) return;
    try { setRes(await api('/outcomes', { method: 'POST', body: { cellId, category, openedOn: v.date, actualMonthlyRevenue: rev } })); }
    catch (er) { setErrs(fieldErrors(er)); }
  };
  return <Modal open={open} onClose={() => { onClose(); setRes(null); }} title="We opened here">
    {res ? <div className="col g12"><Banner tone={res.insideInterval ? 'ok' : 'warn'} icon={res.insideInterval ? 'checkbox-circle-line' : 'error-warning-line'}>{res.insideInterval ? 'Inside the predicted P10–P90 range.' : 'Outside the predicted range.'} Intervals recalibrated in {res.recalibrationMs} ms.</Banner>
      <div className="grid2"><div className="panel pad16"><Kv k="Actual (annualised)" v={inr(res.actualAnnual)} /></div><div className="panel pad16"><Kv k="Predicted P50" v={inr(res.predicted.p50)} sub={`P10 ${inr(res.predicted.p10)} · P90 ${inr(res.predicted.p90)}`} /></div></div>
      <span className="s13 muted">New calibration scale: {res.new_calibration_scale.toFixed(2)}{res.coverage != null ? ` · coverage on recorded outcomes ${Math.round(res.coverage * 100)}%` : ''}</span><button className="btn ink" style={{ alignSelf: 'flex-start' }} onClick={() => { onClose(); setRes(null); }}>Done</button></div>
      : <div className="col g12"><Field label="Opened on" type="date" value={v.date} onChange={(x) => setV({ ...v, date: x })} error={errs.openedOn} inputProps={{ max: new Date().toISOString().slice(0, 10) }} />
        <Field label="Actual monthly revenue" value={v.rev} onChange={(x) => setV({ ...v, rev: x })} suffix="₹" error={errs.actualMonthlyRevenue} help={parseNum(v.rev) ? `${inr(parseNum(v.rev))} / month · predicted ${inr(site.revenue.p50 / 12)} / month` : `Predicted ${inr(site.revenue.p50 / 12)} / month`} />
        <button className="btn ink" style={{ alignSelf: 'flex-start' }} onClick={send}>Save outcome</button></div>}
  </Modal>;
}
