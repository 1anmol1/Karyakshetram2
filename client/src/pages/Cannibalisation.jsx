import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useToast, useApi } from '../lib/state.jsx';
import { inr, km, pct } from '../lib/format.js';
import { Header, Footer, SystemBanners } from '../components/Layout.jsx';
import { Icon, Kv, Sim, Banner, EmptyState, Skel, Field, Tier, ErrorBox } from '../components/ui.jsx';
import HexMap from '../components/HexMap.jsx';

const POPULAR_PUNE_LOCATIONS = [
  { cell: '886088508dfffff', name: 'Deccan Gymkhana · Prime High Street' },
  { cell: '8860884203fffff', name: 'Baner High Street · Commercial Nexus' },
  { cell: '8860884231fffff', name: 'Balewadi High St · Retail Hub' },
  { cell: '8860885081fffff', name: 'Kothrud Central · Paud Road' },
  { cell: '88608852cbfffff', name: 'Viman Nagar · Phoenix Corridor' },
  { cell: '8860885759fffff', name: 'Koregaon Park · North Main Rd' },
  { cell: '8860884639fffff', name: 'Hinjewadi Phase 1 · IT Park' },
];

export default function Cannibalisation() {
  const { cellId: param } = useParams();
  const { category, catInfo, picks, categories, locality } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const [saved, setSaved] = useState([]);
  const [myStores, setMyStores] = useState([]);
  const candApi = useApi(`/compare/candidates?category=${category}`, [category]);
  const hex = useApi(`/cells?category=${category}`, [category]);

  useEffect(() => {
    api('/saved').then((r) => setSaved(r.saved || [])).catch(() => {});
    api('/stores').then((r) => setMyStores(r.stores || [])).catch(() => {});
  }, []);

  const options = useMemo(() => {
    const list = [];
    const candidates = candApi.data?.candidates || [];
    const locName = locality?.name?.toLowerCase();

    // 1. Current locality candidates first
    const inLoc = candidates.filter((c) => locName && c.locality?.toLowerCase() === locName);
    inLoc.forEach((c) => {
      list.push({
        cell: c.cell,
        name: `H${c.rank} in ${c.locality} · Exp profit ${inr(c.exp)}/yr`,
        rank: c.rank,
        locality: c.locality,
      });
    });

    // 2. Recommendations from state
    (picks || []).filter((p) => !p.empty).forEach((p, idx) => {
      if (!list.some((o) => o.cell === p.cell)) {
        list.push({
          cell: p.cell,
          name: `H${idx + 1} in ${p.locality || 'Location'} · ${p.label}`,
          rank: idx + 1,
          locality: p.locality,
        });
      }
    });

    // 3. Saved locations
    (saved || []).forEach((s) => {
      if (!list.some((o) => o.cell === s.cell)) {
        list.push({
          cell: s.cell,
          name: `Saved · ${s.name || s.locality || 'Site'}`,
          locality: s.locality,
        });
      }
    });

    // 4. Other Pune candidates
    const otherLoc = candidates.filter((c) => !locName || c.locality?.toLowerCase() !== locName);
    otherLoc.slice(0, 20).forEach((c) => {
      if (!list.some((o) => o.cell === c.cell)) {
        list.push({
          cell: c.cell,
          name: `H${c.rank} in ${c.locality} · Exp profit ${inr(c.exp)}/yr`,
          rank: c.rank,
          locality: c.locality,
        });
      }
    });

    if (!list.length) {
      POPULAR_PUNE_LOCATIONS.forEach((loc) => list.push(loc));
    }
    return list;
  }, [candApi.data?.candidates, locality?.name, picks, saved]);

  const cellId = param || options[0]?.cell || '8860884231fffff';

  // Automatically update candidate to top site in new locality when locality changes
  const prevLocalityRef = useRef(locality?.name);
  useEffect(() => {
    if (prevLocalityRef.current !== undefined && prevLocalityRef.current !== locality?.name && locality?.name) {
      prevLocalityRef.current = locality.name;
      const inNewLoc = (candApi.data?.candidates || []).filter((c) => c.locality?.toLowerCase() === locality.name.toLowerCase());
      if (inNewLoc.length > 0) {
        nav(`/cannibalisation/${inNewLoc[0].cell}`);
      }
    } else {
      prevLocalityRef.current = locality?.name;
    }
  }, [locality?.name, candApi.data?.candidates, nav]);

  const [d, setD] = useState({ loading: true });
  const [threshold, setThreshold] = useState(5);

  const load = () => {
    if (!cellId) { setD({ loading: false, none: true }); return; }
    setD({ loading: true });
    const reqCat = category === 'all' ? 'grocery' : category;
    const topPickCells = options.slice(0, 5).map((o) => o.cell);
    const topPickLabels = options.slice(0, 5).map((o) => o.name.split('·')[0].trim());

    api('/cannibalisation', {
      method: 'POST',
      body: {
        cellId,
        category: reqCat,
        crossCategory: true,
        withPicks: true,
        pickCells: topPickCells,
        pickLabels: topPickLabels,
      },
      timeout: 60000,
    })
      .then((r) => setD({ loading: false, data: r }))
      .catch((e) => setD({ loading: false, error: e }));
  };

  useEffect(load, [cellId, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = d.data;
  const res = r?.result;
  const site = r?.site;
  const over = res?.stores.filter((s) => s.lossPct * 100 > threshold) || [];

  return (
    <div className="page">
      <Header back />
      <SystemBanners />
      <div className="wrapx col g20" style={{ padding: '24px 28px' }}>
        <div className="row sb wrap g12">
          <div className="col g4">
            <h1 className="h2">Network Cannibalisation Matrix</h1>
            <span className="muted s14">
              Recomputes customer gravity and projected revenue loss at your existing stores using the Huff probability model.
            </span>
          </div>
          <div className="row g8 ac">
            <span className="tag">
              {r ? `Operating stores: ${r.ownStoresTotal}` : myStores.length ? `Operating stores: ${myStores.length}` : 'Operating stores: …'}
            </span>
            <button className="btn out sm" onClick={() => nav('/business')}>
              <Icon n="store-2-line" s={14} />
              Manage Stores
            </button>
          </div>
        </div>

        {/* Candidate Selector Bar */}
        <div className="card pad16 col g12">
          <div className="row g16 wrap ac">
            <div style={{ width: 340 }}>
              <Field
                label="Candidate expansion site"
                icon="map-pin-2-fill"
                value={cellId || ''}
                onChange={(v) => nav(`/cannibalisation/${v}`)}
                options={options.map((o) => ({ value: o.cell, label: o.name }))}
              />
            </div>
            <div style={{ width: 170 }}>
              <Field label="Catchment Radius" value={`${catInfo?.catchmentKm ?? 2} km`} disabled />
            </div>
            <div style={{ width: 180 }}>
              <Field
                label="Loss Alert Threshold"
                value={threshold}
                onChange={(v) => setThreshold(Math.max(0, Math.min(100, Number(v) || 0)))}
                suffix="% of revenue"
                type="number"
              />
            </div>
            <div className="col g4 f1">
              <span className="s12 b">Huff Spatial Interaction Model</span>
              <div className="row g8 s13 ac" style={{ minHeight: 40 }}>
                <span>α {res?.model?.alpha ?? '1.0'} (attractiveness) · λ {res?.model?.lambda ?? '1.85'} (friction)</span>
                <Sim />
              </div>
            </div>
          </div>

          {options.slice(0, 6).length > 1 && (
            <div className="row g8 wrap ac" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <span className="s12 muted" style={{ marginRight: 4 }}>Select location:</span>
              {options.slice(0, 6).map((o) => (
                <button
                  key={o.cell}
                  type="button"
                  className={`chip ${cellId === o.cell ? 'on' : ''}`}
                  onClick={() => nav(`/cannibalisation/${o.cell}`)}
                  style={{ fontSize: 12, padding: '4px 10px', fontWeight: cellId === o.cell ? 700 : 500 }}
                >
                  {o.name.split('·')[0].trim()}
                </button>
              ))}
            </div>
          )}
        </div>

        {d.loading && (
          <div className="row g20 stack-md">
            <Skel h={560} style={{ borderRadius: 18, flex: 1.35 }} />
            <div className="col g12" style={{ flex: 1 }}>
              <Skel h={200} />
              <Skel h={300} />
            </div>
          </div>
        )}

        {d.error && (
          <div className="card">
            <ErrorBox error={d.error} onRetry={load} />
          </div>
        )}

        {d.none && (
          <div className="card">
            <EmptyState
              icon="map-pin-line"
              title="Pick a candidate site to start"
              text="Select an expansion location from the dropdown above to test how customer flows interact with your current store network."
              action={<button className="btn ink sm" onClick={() => nav('/app')}>Browse dashboard picks</button>}
            />
          </div>
        )}

        {r?.status === 'no_stores' && (
          <StateCard
            tag="No Stores Registered"
            tone="info"
            icon="store-3-line"
            title="Add your operating store to simulate cannibalisation"
            text="Cannibalisation measures how many customers your new branch takes from your own existing outlets. You currently have 0 stores registered. Add at least one store on the Business page, then test any expansion site here."
            actions={
              <>
                <button className="btn ink sm" onClick={() => nav('/business')}>
                  <Icon n="add-line" />
                  Add Your Store
                </button>
                <button className="btn out sm" onClick={() => nav(`/location/${cellId}`)}>
                  View Location Details
                </button>
              </>
            }
          />
        )}

        {r?.status === 'different_category' && (
          <StateCard
            tag="Different Category"
            tone="info"
            icon="shuffle-line"
            title={`Your stores are ${r.otherCategories.join(', ').toLowerCase()}`}
            text={`Your registered outlets are under ${r.otherCategories.join(', ')}, while current search is ${catInfo?.name}. We can analyze cross-category cannibalisation across your total network.`}
            actions={
              <button className="btn ink sm" onClick={load}>
                Analyze Total Store Network
              </button>
            }
          />
        )}

        {r?.status === 'ineligible' && (
          <StateCard
            tag="Disqualified Candidate"
            tone="bad"
            icon="forbid-line"
            title={`Site fails a ${catInfo?.name.toLowerCase()} commercial zoning rule`}
            text={`${r.reasons.map((x) => x.message).join('. ')}. Choose a suitable nearby alternative:`}
            actions={
              <div className="col g6" style={{ width: '100%' }}>
                {r.alternatives.map((a) => (
                  <button
                    key={a.cell}
                    className="row g10 s13 panel pad12 ac"
                    onClick={() => nav(`/cannibalisation/${a.cell}`)}
                  >
                    <Tier t={a.tier} />
                    <span className="f1 b" style={{ textAlign: 'left' }}>{a.locality}</span>
                    <span className="muted">{km(a.distKm)}</span>
                    <Icon n="arrow-right-s-line" />
                  </button>
                ))}
              </div>
            }
          />
        )}

        {res && site && (
          <>
            {r.isBenchmark && (
              <Banner tone="info" icon="information-line">
                Simulating cannibalisation against category benchmark outlets based on active ML model output. Add your custom stores under Business to evaluate your personal footprint.
              </Banner>
            )}
            {r.crossCategoryNotice && (
              <Banner tone="info" icon="information-line">
                Evaluating customer gravity against your total network of {r.ownStoresCategory} registered store{r.ownStoresCategory > 1 ? 's' : ''}.
              </Banner>
            )}
            {r.estimatedCount > 0 && (
              <Banner tone="warn" icon="question-line">
                {r.estimatedCount} of your stores use demographic-estimated turnover, so revenue draw is calibrated within a ±15% band.
              </Banner>
            )}
            {r.status === 'no_overlap' && (
              <Banner tone="ok" icon="checkbox-circle-line">
                Zero cannibalisation: 0 of your {r.ownStoresCategory} stores lose revenue. Nearest is {r.nearestStore?.name} ({km(r.nearestStore?.distKm)} away). 100% of new site revenue is incremental.
              </Banner>
            )}
            {r.status === 'heavy' && (
              <Banner tone="bad" icon="alert-line">
                Heavy overlap warning: {res.netNetworkProfit < 0
                  ? `Value destroying: network lost margin exceeds new store profit (net ${inr(res.netNetworkProfit)}).`
                  : `One store loses ${pct(Math.max(...res.stores.map((s) => s.lossPct)))} of revenue.`}
              </Banner>
            )}

            <div className="row as g20 stack-md">
              {/* Map View */}
              <div style={{ flex: 1.35, height: 560, minWidth: 0, position: 'relative' }}>
                <HexMap
                  features={hex.data?.features}
                  selected={cellId}
                  picks={[{
                    lat: site.lat,
                    lon: site.lon,
                    n: site.rank ? `H${site.rank}` : '+',
                    label: `Candidate: H${site.rank || 1} in ${site.locality}`,
                  }]}
                  own={res.stores.map((s) => ({
                    lat: s.lat,
                    lon: s.lon,
                    label: s.name.split('·')[1]?.trim() || s.name,
                  }))}
                  rings={[
                    { lat: site.lat, lon: site.lon, km: catInfo?.catchmentKm || 2 },
                    ...res.stores
                      .filter((s) => s.lossPct > 0.001)
                      .map((s) => ({ lat: s.lat, lon: s.lon, km: catInfo?.catchmentKm || 2, kind: 'own' })),
                  ]}
                  center={[site.lat, site.lon]}
                  zoom={13}
                  fit="markers"
                  legend={false}
                  controls={true}
                  onCellClick={(f) => {
                    if (f.properties?.id) {
                      nav(`/cannibalisation/${f.properties.id}`);
                    }
                  }}
                />
                <div className="legend" style={{ left: 14, bottom: 28, width: 240 }}>
                  <div className="row g6 ac">
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--ink)' }} />
                    <span>Your existing store</span>
                  </div>
                  <div className="row g6 ac" style={{ marginTop: 6 }}>
                    <span style={{ width: 14, borderTop: '2.5px dashed var(--accent)' }} />
                    <span>New candidate catchment</span>
                  </div>
                  <div className="row g6 ac" style={{ marginTop: 6 }}>
                    <span style={{ width: 14, borderTop: '2.5px dashed var(--ink)' }} />
                    <span>Impacted store catchment</span>
                  </div>
                </div>
              </div>

              {/* Impact Breakdown Cards & Table */}
              <div className="col g16 f1">
                <div className="grid2" style={{ gap: 12 }}>
                  <div className="panel pad16">
                    <Kv k="New site turnover" v={inr(site.revenue?.p50, 2)} sub="P50 expected / year" />
                  </div>
                  <div className="panel pad16">
                    <Kv k="Draw from own stores" v={`−${inr(res.takenRs)}`} sub={`${pct(res.ratio)} of revenue · ${res.affected} stores`} />
                  </div>
                  <div className="panel pad16">
                    <Kv k="Net incremental revenue" v={`+${inr(res.netNetworkRevenue, 2)}`} sub="after cannibalisation" />
                  </div>
                  <div className="panel pad16" style={{ background: res.netNetworkProfit >= 0 ? 'var(--okSoft)' : 'var(--badSoft)' }}>
                    <Kv
                      k="Net network profit"
                      v={`${res.netNetworkProfit >= 0 ? '+' : ''}${inr(res.netNetworkProfit)}`}
                      sub={`${inr(site.profit?.exp || 0)} site − ${inr(res.lostMargin)} lost margin`}
                    />
                  </div>
                </div>

                {over.length > 0 && (
                  <Banner tone="warn" icon="error-warning-line">
                    <b>{over[0].name}</b> loses {pct(over[0].lossPct)} of turnover, exceeding your {threshold}% threshold.
                  </Banner>
                )}

                <div className="card" style={{ overflowX: 'auto' }}>
                  <table className="t">
                    <thead>
                      <tr>
                        <th>Your Store</th>
                        <th>Distance</th>
                        <th>Current Turnover</th>
                        <th>Projected Loss</th>
                        <th style={{ width: 90 }}>Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.stores.slice(0, 10).map((s) => {
                        const hot = s.lossPct * 100 > threshold;
                        return (
                          <tr key={s.id}>
                            <td className="b">
                              {s.name}
                              {s.estimated && <span className="tag warn" style={{ marginLeft: 6 }}>Estimated</span>}
                            </td>
                            <td className="muted nowrap">{km(s.distKm)}</td>
                            <td className="num nowrap">{inr(s.revenue)}</td>
                            <td className={`b num nowrap ${hot ? 'warnc' : ''}`}>
                              {s.lossPct > 0.001 ? `−${pct(s.lossPct)} · ${inr(s.lossRs)}` : 'No overlap'}
                            </td>
                            <td>
                              <div className="bar">
                                <b style={{ width: `${Math.min(100, s.lossPct * 500)}%`, background: hot ? 'var(--warn)' : 'var(--accent)' }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="row g8 wrap">
                  <button className="btn ink" onClick={() => nav('/portfolio')}>
                    <Icon n="node-tree" s={16} />
                    Plan Portfolio Rollout
                  </button>
                  <button className="btn out" onClick={() => nav(`/location/${cellId}`)}>
                    <Icon n="map-pin-line" s={16} />
                    View Location Scorecard
                  </button>
                </div>
              </div>
            </div>

            {/* How top recommended picks affect network */}
            {r.picks?.length > 0 && (
              <div className="card pad20 col g12">
                <div className="h4">Network Impact Comparison Across Recommendations</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="t">
                    <thead>
                      <tr>
                        <th>Recommended Pick</th>
                        <th>Site Profit</th>
                        <th>Taken from Network</th>
                        <th>Lost Margin</th>
                        <th>Net Network Profit</th>
                        <th>Strategic Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const bestProfit = Math.max(...r.picks.map((p) => p.netNetworkProfit));
                        return r.picks.map((p) => (
                          <tr key={p.cell} className="click" onClick={() => nav(`/cannibalisation/${p.cell}`)}>
                            <td className="b">{p.label.includes(p.locality) ? p.label : `${p.label} · ${p.locality}`}</td>
                            <td className="num">{inr(p.profitExp)}</td>
                            <td className="num">{inr(p.takenRs)}</td>
                            <td className="num">{inr(p.lostMargin)}</td>
                            <td className={`b num ${p.netNetworkProfit >= 0 ? 'okc' : 'badc'}`}>
                              {p.netNetworkProfit >= 0 ? '+' : ''}{inr(p.netNetworkProfit)}
                            </td>
                            <td>
                              {p.netNetworkProfit < 0 ? (
                                <span className="tag bad">Destroys Value</span>
                              ) : p.netNetworkProfit === bestProfit ? (
                                <span className="tag ok">Best Network Gain</span>
                              ) : p.takenRs < 1000 ? (
                                <span className="tag info">No Overlap</span>
                              ) : p.lostMargin > p.profitExp * 0.3 ? (
                                <span className="tag warn">Heavy Cannibalisation</span>
                              ) : (
                                <span className="tag ok">Adds Value</span>
                              )}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );

  function StateCard({ tag, tone, icon, title, text, actions }) {
    return (
      <div className="card pad24 col g12" style={{ maxWidth: 640 }}>
        <span className={`tag ${tone}`} style={{ alignSelf: 'flex-start' }}>{tag}</span>
        <div className="iconbtn fill" style={{ width: 48, height: 48, fontSize: 22, color: 'var(--accent)' }}>
          <Icon n={icon} />
        </div>
        <div className="h4">{title}</div>
        <p className="s13 muted" style={{ lineHeight: 1.55 }}>{text}</p>
        <div className="row g8 wrap">{actions}</div>
      </div>
    );
  }
}
