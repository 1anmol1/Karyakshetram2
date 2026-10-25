import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useToast } from '../lib/state.jsx';
import { inr, downloadCsv } from '../lib/format.js';
import { Header, Footer, SystemBanners } from '../components/Layout.jsx';
import { Icon, Tier, Conf, Collapse, Photo, Skel, ErrorBox, Modal } from '../components/ui.jsx';
import { Drivers } from './Location.jsx';
import HexMap from '../components/HexMap.jsx';

const PUNE_KEY_HUBS = [
  { cell: '8860884203fffff', locality: 'Baner', name: 'Baner High Street', sub: 'Commercial Corridor', tier: 'A', rent: 145 },
  { cell: '886088508dfffff', locality: 'Deccan', name: 'Deccan Gymkhana', sub: 'Prime Central Pune', tier: 'A', rent: 174 },
  { cell: '8860884249fffff', locality: 'Aundh', name: 'Aundh ITI Road', sub: 'High Footfall Junction', tier: 'A', rent: 138 },
  { cell: '8860885081fffff', locality: 'Kothrud', name: 'Kothrud Paud Road', sub: 'Dense Residential Hub', tier: 'B', rent: 125 },
  { cell: '886088510dfffff', locality: 'Viman Nagar', name: 'Viman Nagar', sub: 'Phoenix Mall Corridor', tier: 'A', rent: 160 },
  { cell: '8860884231fffff', locality: 'Balewadi', name: 'Balewadi High Street', sub: 'Lifestyle & Dining Strip', tier: 'B', rent: 130 },
  { cell: '8860885067fffff', locality: 'Koregaon Park', name: 'Koregaon Park', sub: 'North Main Road', tier: 'A', rent: 185 },
  { cell: '88608840cbfffff', locality: 'Hinjewadi', name: 'Hinjewadi Phase 1', sub: 'IT Park Express Hub', tier: 'B', rent: 110 },
  { cell: '8860885111fffff', locality: 'Yerawada', name: 'Yerawada', sub: 'Airport Road Commercial', tier: 'B', rent: 115 },
  { cell: '8860885461fffff', locality: 'Bavdhan', name: 'Bavdhan', sub: 'Bavdhan Expressway Hub', tier: 'B', rent: 105 },
];

export default function Compare() {
  const { compare, setCompare, picks, category } = useApp();
  const [saved, setSaved] = useState([]);
  const [candidatesData, setCandidatesData] = useState(null);
  const [d, setD] = useState({ loading: false });
  const [hl, setHl] = useState(true);
  const [picker, setPicker] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const addCell = searchParams.get('add');
  const addName = searchParams.get('name') || 'Selected Location';

  // Load verified candidate locations from scoring run
  useEffect(() => {
    const reqCat = category === 'all' ? 'grocery' : category;
    api(`/compare/candidates?category=${reqCat}`)
      .then((r) => setCandidatesData(r))
      .catch(() => {});
  }, [category]);

  // Load saved locations
  useEffect(() => {
    api('/saved')
      .then((r) => setSaved((r.saved || []).filter((s) => s.category === category || category === 'all')))
      .catch(() => {});
  }, [category]);

  // Combine only verified candidate locations that are part of current scoring run
  const allCandidates = useMemo(() => {
    const list = [];
    const seen = new Set();
    const validSet = candidatesData?.validCells?.length ? new Set(candidatesData.validCells) : null;

    // 1. Live recommended picks (from API candidates or useApp picks)
    const sourcePicks = (candidatesData?.picks && candidatesData.picks.length)
      ? candidatesData.picks
      : (picks || []).filter((p) => !p.empty);

    sourcePicks.forEach((p, idx) => {
      const cellId = p.cell;
      if (!seen.has(cellId) && (!validSet || validSet.has(cellId))) {
        seen.add(cellId);
        const hTag = p.hTag || `H${idx + 1}`;
        const rawLoc = (p.locality || 'Location').replace(/^H\d+\s+in\s+/i, '');
        list.push({
          cell: cellId,
          hTag,
          name: `${hTag} in ${rawLoc}`,
          locality: rawLoc,
          sub: p.sub || p.label || 'Recommended pick',
          tier: p.tier || 'A',
          rent: p.rent,
          source: 'pick',
        });
      }
    });

    // 2. Saved locations (strictly verified against current scoring run)
    saved.forEach((s) => {
      const cellId = s.cell;
      // Do not include locations that are not part of the current scoring run
      if (cellId && !seen.has(cellId) && (!validSet || validSet.has(cellId))) {
        seen.add(cellId);
        const hTag = `H${list.length + 1}`;
        const rawLoc = (s.locality || s.name || 'Saved Site').replace(/^H\d+\s+in\s+/i, '');
        list.push({
          cell: cellId,
          hTag,
          name: `${hTag} in ${rawLoc}`,
          locality: rawLoc,
          sub: 'Saved shortlist',
          tier: s.snapshot?.tier || 'A',
          rent: s.snapshot?.rent,
          source: 'saved',
        });
      }
    });

    // 3. Key Pune Commercial Hubs (strictly verified against current scoring run)
    const hubs = candidatesData?.hubs?.length ? candidatesData.hubs : PUNE_KEY_HUBS;
    hubs.forEach((h) => {
      const cellId = h.cell;
      if (cellId && !seen.has(cellId) && (!validSet || validSet.has(cellId))) {
        seen.add(cellId);
        const hTag = `H${list.length + 1}`;
        const rawLoc = (h.locality || 'Pune Hub').replace(/^H\d+\s+in\s+/i, '');
        list.push({
          cell: cellId,
          hTag,
          name: `${hTag} in ${rawLoc}`,
          locality: rawLoc,
          sub: h.sub || 'Commercial hub',
          tier: h.tier || 'A',
          rent: h.rent,
          source: 'hub',
        });
      }
    });

    return list;
  }, [candidatesData, picks, saved]);

  // Defensively sanitize compare array so any cell not in scoring run is replaced
  useEffect(() => {
    if (candidatesData?.validCells?.length && compare.length > 0 && allCandidates.length >= 2) {
      const validSet = new Set(candidatesData.validCells);
      const cleaned = compare.filter((c) => validSet.has(c));
      if (cleaned.length !== compare.length) {
        if (cleaned.length < 2) {
          const c1 = allCandidates[0].cell;
          const c2 = allCandidates.find((c) => c.cell !== c1)?.cell || allCandidates[1].cell;
          setCompare([c1, c2]);
        } else {
          setCompare(cleaned);
        }
      }
    }
  }, [candidatesData, compare, allCandidates]); // eslint-disable-line react-hooks/exhaustive-deps

  // If addCell is already in compare, notify and clean URL
  useEffect(() => {
    if (addCell && compare.includes(addCell)) {
      toast(`${addName} is already in the comparison`, { tone: 'info', icon: 'information-line' });
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      next.delete('name');
      setSearchParams(next, { replace: true });
    }
  }, [addCell, compare]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-initialize comparison with 2 sites if empty or fewer than 2 (only when not adding via modal)
  useEffect(() => {
    if (!addCell && compare.length < 2 && allCandidates.length >= 2) {
      const c1 = allCandidates[0].cell;
      const c2 = allCandidates.find((c) => c.cell !== c1)?.cell || allCandidates[1].cell;
      setCompare([c1, c2]);
    }
  }, [allCandidates.length, addCell]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeAddModal = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    next.delete('name');
    setSearchParams(next, { replace: true });
  };

  const handleStartFresh = () => {
    const second = allCandidates.find((c) => c.cell !== addCell)?.cell || PUNE_KEY_HUBS[0].cell;
    setCompare([addCell, second]);
    closeAddModal();
    toast(`Started fresh comparison with ${addName}`, { tone: 'ok', icon: 'sparkling-2-line' });
  };

  const handleReplaceSite = (idx, existingName) => {
    const next = [...compare];
    next[idx] = addCell;
    setCompare(next);
    closeAddModal();
    toast(`Replaced ${existingName} with ${addName}`, { tone: 'ok', icon: 'arrow-left-right-line' });
  };

  const handleAddKeepExisting = () => {
    setCompare([...compare, addCell]);
    closeAddModal();
    toast(`Added ${addName} to comparison (${compare.length + 1} of 3)`, { tone: 'ok', icon: 'checkbox-circle-line' });
  };

  // Execute compare API call whenever compare array changes
  useEffect(() => {
    if (compare.length < 2) {
      setD({ loading: false });
      return;
    }
    setD({ loading: true });
    const reqCat = category === 'all' ? 'grocery' : category;
    api('/compare', { method: 'POST', body: { cells: compare, category: reqCat } })
      .then((r) => setD({ data: r }))
      .catch((e) => setD({ error: e }));
  }, [compare.join(','), category]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-repair compare array with valid candidate locations if any error occurs
  useEffect(() => {
    if (d.error && allCandidates.length >= 2) {
      const valid = compare.filter((c) => allCandidates.some((cand) => cand.cell === c));
      if (valid.length < 2) {
        setCompare([allCandidates[0].cell, allCandidates[1].cell]);
      } else if (valid.length !== compare.length) {
        setCompare(valid);
      }
    }
  }, [d.error, allCandidates]); // eslint-disable-line react-hooks/exhaustive-deps

  const sites = d.data?.sites || [];

  const addSite = (cell) => {
    if (compare.includes(cell)) {
      toast('That site is already in the comparison', { tone: 'warn', icon: 'error-warning-line' });
      return;
    }
    if (compare.length >= 3) {
      toast('Maximum 3 sites can be compared at once. Remove one first.', { tone: 'warn', icon: 'error-warning-line' });
      return;
    }
    setCompare([...compare, cell]);
    setPicker(null);
    toast('Added site to comparison', { tone: 'ok', icon: 'checkbox-circle-line' });
  };

  const removeSite = (cell) => {
    setCompare(compare.filter((c) => c !== cell));
    toast('Removed site from comparison', { tone: 'info', icon: 'delete-bin-line' });
  };

  const replace = (i, cell) => {
    if (compare.includes(cell)) {
      toast('That site is already in the comparison', { tone: 'warn', icon: 'error-warning-line' });
      return;
    }
    const next = [...compare];
    next[i] = cell;
    setCompare(next.filter(Boolean));
    setPicker(null);
    toast('Site updated in comparison', { tone: 'ok', icon: 'checkbox-circle-line' });
  };

  const best = (vals, dir = 1) => {
    if (!hl) return -1;
    const v = vals.map((x) => (typeof x === 'number' ? x : NaN));
    const m = dir > 0 ? Math.max(...v.filter(Number.isFinite)) : Math.min(...v.filter(Number.isFinite));
    return v.filter((x) => x === m).length === v.length ? -1 : v.indexOf(m);
  };

  const Row = ({ k, vals, raw, dir = 1 }) => {
    const b = best(raw || [], dir);
    return (
      <div className="row compare-table-row" style={{ padding: '14px 0', borderTop: '1px solid var(--line)', minWidth: 580 }}>
        <span className="s14" style={{ width: 240, flex: 'none', fontWeight: 600 }}>{k}</span>
        {vals.map((v, i) => (
          <span key={i} className={`s14 f1 ${i === b ? 'b' : ''}`} style={i === b ? { color: 'var(--accent)' } : undefined}>
            {v}
          </span>
        ))}
        {vals.length < 3 && <span className="f1" />}
      </div>
    );
  };

  const exportCsv = () =>
    downloadCsv(
      'karyakshetram_compare.csv',
      sites.map((s) => ({
        locality: s.locality,
        cell: s.cell,
        tier: s.tier,
        revenue_p50: Math.round(s.revenue.p50),
        expected_profit: Math.round(s.profit.exp),
        p10_profit: Math.round(s.profit.p10),
        rent: s.rent,
        breakeven_rent: Math.round(s.breakevenRent),
        stress_passes: s.stress.passes,
      }))
    );

  // Filter available candidate list based on search and tab
  const filteredCandidates = allCandidates.filter((c) => {
    if (searchQ && !c.name.toLowerCase().includes(searchQ.toLowerCase()) && !c.sub.toLowerCase().includes(searchQ.toLowerCase())) {
      return false;
    }
    if (filterTab === 'picks') return c.source === 'pick';
    if (filterTab === 'saved') return c.source === 'saved';
    if (filterTab === 'hubs') return c.source === 'hub';
    return true;
  });

  return (
    <div className="page">
      <Header back />
      <SystemBanners />
      <div className="wrapx col g20" style={{ padding: '24px 28px' }}>
        {/* Top Header & Actions */}
        <div className="row sb wrap g12">
          <div className="col g4">
            <h1 className="h2">Compare sites</h1>
            <span className="muted s14">
              Side-by-side viability, revenue, stress testing and cannibalisation for up to 3 Pune locations.
            </span>
          </div>
          <div className="row g8">
            <button className="btn out sm" disabled={!sites.length} onClick={exportCsv}>
              <Icon n="download-2-line" s={14} />
              Export CSV
            </button>
            <button
              className="btn out sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  toast('Comparison link copied');
                } catch {
                  toast('Copy failed', { tone: 'bad' });
                }
              }}
            >
              <Icon n="share-forward-line" s={14} />
              Share
            </button>
          </div>
        </div>

        {/* Direct Location Selection & Management Tray */}
        <div className="card pad20 col g16" style={{ background: 'var(--surface)' }}>
          <div className="row sb wrap g12 ac">
            <div className="col g2">
              <span className="b s14">Selected for Comparison ({compare.length} of 3)</span>
              <span className="s12 muted">
                {compare.length >= 3
                  ? 'Maximum 3 sites selected. Click (x) to remove a site or click below to swap.'
                  : compare.length === 2
                  ? 'Comparing 2 sites. You can add 1 more site to compare 3 side by side.'
                  : 'Select at least 2 sites to run side-by-side comparison.'}
              </span>
            </div>
            <div className="row g8 wrap">
              {compare.map((cell, idx) => {
                const found = allCandidates.find((c) => c.cell === cell);
                const s = sites.find((x) => x.cell === cell);
                const rawLoc = s?.locality || found?.locality || (found?.name ? found.name.replace(/^H\d+\s+in\s+/i, '') : 'Selected Site');
                const label = `H${idx + 1} in ${rawLoc}`;
                return (
                  <span
                    key={cell}
                    className="tag acc"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <Icon n="map-pin-2-fill" s={14} c="var(--accent)" />
                    {label}
                    <button
                      className="iconbtn"
                      style={{ width: 20, height: 20, marginLeft: 2, padding: 0 }}
                      onClick={() => removeSite(cell)}
                      aria-label={`Remove ${label}`}
                    >
                      <Icon n="close-line" s={14} />
                    </button>
                  </span>
                );
              })}
              {compare.length < 2 && (
                <button
                  className="btn ink sm"
                  onClick={() => {
                    const c1 = allCandidates[0]?.cell || PUNE_KEY_HUBS[0].cell;
                    const c2 = allCandidates[1]?.cell || PUNE_KEY_HUBS[1].cell;
                    setCompare([c1, c2]);
                  }}
                >
                  <Icon n="sparkling-2-line" s={14} />
                  Auto-compare Top 2 Picks
                </button>
              )}
            </div>
          </div>

          <div className="divider" style={{ margin: '4px 0' }} />

          {/* Quick Add / Search Grid */}
          <div className="col g10">
            <div className="row sb wrap g12 ac">
              <span className="b s13 muted">Available Locations in Pune ({filteredCandidates.length})</span>
              <div className="row g8 wrap ac">
                <div className="row g4">
                  {[
                    ['all', 'All Locations'],
                    ['picks', 'Top Picks'],
                    ['saved', 'Saved Sites'],
                    ['hubs', 'Pune Hubs'],
                  ].map(([k, t]) => (
                    <button
                      key={k}
                      className={`btn sm ${filterTab === k ? 'ink' : 'ghost'}`}
                      style={{ height: 30, fontSize: 12, padding: '0 10px' }}
                      onClick={() => setFilterTab(k)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="input" style={{ width: 220, height: 32 }}>
                  <Icon n="search-line" s={14} c="var(--muted)" />
                  <input
                    placeholder="Search locations…"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                  {searchQ && (
                    <button className="iconbtn" style={{ width: 20, height: 20 }} onClick={() => setSearchQ('')}>
                      <Icon n="close-line" s={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Candidate chips to add or remove */}
            <div className="row wrap g8" style={{ maxHeight: 160, overflowY: 'auto', padding: '4px 0' }}>
              {filteredCandidates.map((c) => {
                const inComp = compare.includes(c.cell);
                return (
                  <button
                    key={c.cell}
                    className={`chip ${inComp ? 'on' : ''}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      cursor: 'pointer',
                      borderRadius: 10,
                      border: inComp ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                      background: inComp ? 'var(--accentSoft)' : 'var(--bg)',
                    }}
                    onClick={() => (inComp ? removeSite(c.cell) : addSite(c.cell))}
                    title={inComp ? 'Click to remove from comparison' : 'Click to add to comparison'}
                  >
                    <Icon
                      n={inComp ? 'checkbox-circle-fill' : 'add-line'}
                      s={14}
                      c={inComp ? 'var(--accent)' : 'var(--muted)'}
                    />
                    <span className="b">{c.name}</span>
                    <span className="s11 muted">· {c.sub}</span>
                    {c.tier && <Tier t={c.tier} />}
                  </button>
                );
              })}
              {!filteredCandidates.length && (
                <span className="s13 muted pad12">No locations found matching “{searchQ}”.</span>
              )}
            </div>
          </div>
        </div>

        {/* Notice if less than 2 sites selected */}
        {compare.length < 2 && (
          <div className="card pad24 col ac g12" style={{ textAlign: 'center' }}>
            <div className="iconbtn fill" style={{ width: 48, height: 48, fontSize: 22, color: 'var(--accent)' }}>
              <Icon n="scales-3-line" />
            </div>
            <div className="h4">Select at least 2 locations above</div>
            <p className="s13 muted" style={{ maxWidth: 460 }}>
              Click on any location chips above to add them to your side-by-side comparison.
            </p>
            <button
              className="btn ink sm"
              onClick={() => {
                const c1 = allCandidates[0]?.cell || PUNE_KEY_HUBS[0].cell;
                const c2 = allCandidates[1]?.cell || PUNE_KEY_HUBS[1].cell;
                setCompare([c1, c2]);
              }}
            >
              <Icon n="sparkling-2-line" s={14} />
              Compare Top 2 Picks
            </button>
          </div>
        )}

        {/* Side-by-Side Comparison Columns */}
        {compare.length >= 2 && (
          <>
            {/* Mobile highlight toggle */}
            <div className="show-md col g8 pad12 panel" style={{ marginBottom: 12, width: '100%' }}>
              <button
                className="row sb ac"
                style={{ width: '100%', background: 'transparent', border: 'none' }}
                onClick={() => setHl(!hl)}
                aria-pressed={hl}
              >
                <span className="b s14">Highlight key differences</span>
                <span className={`tgl ${hl ? 'on' : ''}`} />
              </button>
              <span className="s12 muted">Best value in each row is highlighted when on.</span>
            </div>

            <div className="row as stack-md" style={{ gap: 0, width: '100%' }}>
              {/* Highlight toggle sidebar for desktop */}
              <div style={{ width: 260, paddingTop: 140, flex: 'none' }} className="col g12 hide-md">
                <button
                  className="panel pad16 row sb"
                  style={{ width: 240 }}
                  onClick={() => setHl(!hl)}
                  aria-pressed={hl}
                >
                  <span className="s14">Highlight key differences</span>
                  <span className={`tgl ${hl ? 'on' : ''}`} />
                </button>
                <span className="s12 muted" style={{ width: 230 }}>
                  Best value in each row is highlighted when on.
                </span>
              </div>

              {/* 3 Location Columns in scrollable track on mobile */}
              <div className="f1 row compare-cols-track" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 12 }}>
                {[0, 1, 2].map((i) => {
                  const s = sites[i];
                  const cell = compare[i];
                  const found = allCandidates.find((c) => c.cell === cell);
                  const rawLoc = s?.locality || found?.locality || (found?.name ? found.name.replace(/^H\d+\s+in\s+/i, '') : 'Loading…');
                  const locName = cell ? `H${i + 1} in ${rawLoc}` : 'Select a site';

                return (
                  <div key={i} className="f1 col g12 compare-col" style={{ paddingRight: 16, minWidth: 260 }}>
                    <div className="card pad16 row sb shadow" style={{ position: 'relative' }}>
                      {cell ? (
                        <>
                          <div className="row g10" style={{ minWidth: 0 }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 10,
                                overflow: 'hidden',
                                flex: 'none',
                              }}
                            >
                              {s ? (
                                <HexMap
                                  features={null}
                                  picks={[{ lat: s.lat, lon: s.lon }]}
                                  center={[s.lat, s.lon]}
                                  zoom={13}
                                  controls={false}
                                  legend={false}
                                  interactive={false}
                                />
                              ) : (
                                <Skel h={44} />
                              )}
                            </div>
                            <div className="col" style={{ minWidth: 0 }}>
                              <span className="b s15 ellipsis">{locName}</span>
                              <span className="s12 muted">
                                {found?.sub || 'Site'} · Tier {s?.tier || found?.tier || '…'}
                              </span>
                            </div>
                          </div>
                          <span className="row g4">
                            <button
                              className="iconbtn"
                              style={{ width: 30, height: 30 }}
                              onClick={() => setPicker(picker === i ? null : i)}
                              aria-label="Change site"
                              title="Swap with another location"
                            >
                              <Icon n="arrow-down-s-line" s={18} />
                            </button>
                            <button
                              className="iconbtn"
                              style={{ width: 30, height: 30 }}
                              onClick={() => removeSite(cell)}
                              aria-label="Remove site"
                              title="Remove from comparison"
                            >
                              <Icon n="close-line" s={16} />
                            </button>
                          </span>
                        </>
                      ) : (
                        <button
                          className="row g8 b"
                          style={{ width: '100%', height: 44, justifyContent: 'center' }}
                          onClick={() => setPicker(picker === i ? null : i)}
                        >
                          <Icon n="add-line" />
                          Add a third site
                        </button>
                      )}

                      {/* Swap site popover */}
                      {picker === i && (
                        <div className="popover" style={{ left: 0, right: 0, top: 70, zIndex: 1200 }}>
                          <div className="b s12 muted pad8">Select a site to put in this slot:</div>
                          {allCandidates.map((o) => (
                            <button
                              key={o.cell}
                              className={compare.includes(o.cell) ? 'on' : ''}
                              onClick={() => replace(i, o.cell)}
                            >
                              <Icon n="map-pin-line" s={16} c="var(--muted)" />
                              <span className="ellipsis">{o.name}</span>
                              <span className="s11 muted" style={{ marginLeft: 'auto' }}>
                                {o.sub}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {cell && (
                      <>
                        <div className="photo" style={{ height: 150 }}>
                          <Photo seed={i + 20} h={150} />
                        </div>
                        <div className="col ac g4">
                          <span className="s12 muted">Expected profit / year</span>
                          {s ? (
                            <>
                              <span className="h3 num">{inr(s.profit.exp)}</span>
                              <span className="row g6">
                                <Tier t={s.tier} />
                                <Conf c={s.confidence} />
                              </span>
                              <button
                                className="b s13 acc row g4"
                                style={{ marginTop: 4 }}
                                onClick={() => nav(`/location/${s.cell}?h=${i + 1}`)}
                              >
                                View full location <Icon n="arrow-right-line" s={14} />
                              </button>
                            </>
                          ) : (
                            <Skel h={60} w={160} />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              </div>
            </div>

            {d.error && <ErrorBox compact error={d.error} />}
            {d.loading && <Skel h={200} style={{ borderRadius: 16 }} />}

            {d.data && (
              <>
                <div className="card pad20 row g12 as" style={{ background: 'var(--surface)' }}>
                  <Icon n="sparkling-2-line" s={20} c="var(--accent2)" />
                  <div className="col g6">
                    <b>{d.data.title}</b>
                    <span className="s13" style={{ lineHeight: 1.6 }}>
                      {d.data.narrative}
                    </span>
                    <span className="row g6 wrap">
                      <span className="s11 muted">
                        {d.data.narrative_source === 'llm'
                          ? 'LLM narrative · validated'
                          : 'Deterministic evidence synthesis'}
                        {' · '}
                        every metric evaluated from model outputs
                      </span>
                    </span>
                  </div>
                </div>

                <Collapse open title="Key numbers">
                  <div className="compare-table-scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <Row
                      k="Revenue P10 – P90"
                      vals={sites.map((s) => `${inr(s.revenue.p10)} – ${inr(s.revenue.p90)}`)}
                      raw={sites.map((s) => s.revenue.p50)}
                    />
                    <Row
                      k="Expected profit"
                      vals={sites.map((s) => inr(s.profit.exp))}
                      raw={sites.map((s) => s.profit.exp)}
                    />
                    <Row
                      k="Downside profit (P10)"
                      vals={sites.map((s) => inr(s.profit.p10))}
                      raw={sites.map((s) => s.profit.p10)}
                    />
                    <Row
                      k="Assumed rent"
                      vals={sites.map((s) => `₹${s.rent} /sq ft/mo`)}
                      raw={sites.map((s) => s.rent)}
                      dir={-1}
                    />
                    <Row
                      k="Break-even rent"
                      vals={sites.map((s) => `₹${Math.round(s.breakevenRent)}`)}
                      raw={sites.map((s) => s.breakevenRent)}
                    />
                    <Row
                      k="Rent-to-revenue"
                      vals={sites.map((s) => `${(((s.rent * s.area * 12) / s.revenue.p50) * 100).toFixed(1)}%`)}
                      raw={sites.map((s) => (s.rent * s.area * 12) / s.revenue.p50)}
                      dir={-1}
                    />
                  </div>
                </Collapse>

                <Collapse open title="Stress tests">
                  <div className="compare-table-scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    {['competitor500m', 'rentUp25', 'demandDown15', 'marginDown2'].map((k) => (
                      <Row
                        key={k}
                        k={sites[0].stress[k].label}
                        vals={sites.map((s) => `${s.stress[k].pass ? 'Pass' : 'Fail'} · Tier ${s.stress[k].tier}`)}
                        raw={sites.map((s) => s.stress[k].exp)}
                      />
                    ))}
                    <Row
                      k="Passes"
                      vals={sites.map((s) => `${s.stress.passes} of 4`)}
                      raw={sites.map((s) => s.stress.passes)}
                    />
                  </div>
                </Collapse>

                <Collapse open title="Cannibalisation">
                  <div className="compare-table-scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <Row
                      k="Taken from own stores"
                      vals={sites.map((s) => (s.cannibalisation ? inr(s.cannibalisation.takenRs) : 'No own stores'))}
                      raw={sites.map((s) => s.cannibalisation?.takenRs ?? NaN)}
                      dir={-1}
                    />
                    <Row
                      k="Net network profit"
                      vals={sites.map((s) =>
                        s.cannibalisation ? inr(s.cannibalisation.netNetworkProfit) : inr(s.profit.exp)
                      )}
                      raw={sites.map((s) => s.cannibalisation?.netNetworkProfit ?? s.profit.exp)}
                    />
                  </div>
                </Collapse>

                <Collapse title="Why here · drivers">
                  <div className="row as g24 stack-md">
                    {sites.map((s) => (
                      <div key={s.cell} className="f1 col g8">
                        <b className="s13">{s.locality}</b>
                        <Drivers shap={s.shap} />
                      </div>
                    ))}
                  </div>
                </Collapse>

                <Collapse title="Neighbourhood">
                  <Row
                    k="Households in catchment"
                    vals={sites.map((s) => s.catchment.households.toLocaleString('en-IN'))}
                    raw={sites.map((s) => s.catchment.households)}
                  />
                  <Row
                    k="Competitors in catchment"
                    vals={sites.map((s) => s.catchment.competitors)}
                    raw={sites.map((s) => s.catchment.competitors)}
                    dir={-1}
                  />
                  <Row
                    k="Population change 2015–20"
                    vals={sites.map((s) => `${(s.popChange * 100).toFixed(1)}%`)}
                    raw={sites.map((s) => s.popChange)}
                  />
                  <Row
                    k="Data coverage"
                    vals={sites.map((s) => s.coverage.toFixed(2))}
                    raw={sites.map((s) => s.coverage)}
                  />
                </Collapse>

                <Collapse title="Risks and flags">
                  <div className="row as g24 stack-md">
                    {sites.map((s) => (
                      <div key={s.cell} className="f1 col g6">
                        <b className="s13">{s.locality}</b>
                        {s.flags.length ? (
                          s.flags.map((f) => (
                            <span key={f} className="tag warn" style={{ alignSelf: 'flex-start' }}>
                              {f.replace(/_/g, ' ').toLowerCase()}
                            </span>
                          ))
                        ) : (
                          <span className="s13 muted">No flags</span>
                        )}
                      </div>
                    ))}
                  </div>
                </Collapse>
              </>
            )}
          </>
        )}
      </div>
      {/* Modal asking user how to update comparison when arriving with ?add= */}
      {addCell && !compare.includes(addCell) && (
        <Modal
          open={true}
          onClose={closeAddModal}
          title={`Add ${addName} to Comparison`}
        >
          <div className="col g16" style={{ padding: '6px 0' }}>
            <p className="s14 muted" style={{ lineHeight: 1.5 }}>
              You currently have <b>{compare.length} site{compare.length > 1 ? 's' : ''}</b> in your comparison. Choose which one to remove, or start fresh:
            </p>

            {/* Option 1: Start fresh */}
            <div className="card pad16 col g8" style={{ border: '1.5px solid var(--line)', background: 'var(--surface)' }}>
              <div className="row sb ac">
                <span className="b s14">Option 1 · Start fresh</span>
                <span className="tag acc">Reset</span>
              </div>
              <span className="s12 muted">
                Clear all existing sites and compare <b>{addName}</b> from scratch.
              </span>
              <button
                className="btn out sm"
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
                onClick={handleStartFresh}
              >
                <Icon n="refresh-line" s={14} />
                Start fresh with {addName}
              </button>
            </div>

            {/* Option 2: Replace an existing site */}
            <div className="card pad16 col g10" style={{ border: '1.5px solid var(--line)' }}>
              <div className="row sb ac">
                <span className="b s14">Option 2 · Replace a site already in compare</span>
                <span className="tag">Swap</span>
              </div>
              <span className="s12 muted">
                Click on any site below to remove it and put <b>{addName}</b> in its slot:
              </span>
              <div className="col g8">
                {compare.map((existingCell, i) => {
                  const existingSite = sites.find((s) => s.cell === existingCell) || allCandidates.find((c) => c.cell === existingCell);
                  const existingName = existingSite?.locality || existingSite?.name || `Site ${i + 1}`;
                  return (
                    <button
                      key={existingCell}
                      className="btn out sm row sb"
                      style={{ width: '100%', padding: '10px 14px', textAlign: 'left', borderRadius: 10, height: 'auto' }}
                      onClick={() => handleReplaceSite(i, existingName)}
                    >
                      <span className="row g8 ac">
                        <Icon n="arrow-left-right-line" s={15} c="var(--accent)" />
                        <span>Remove <b>{existingName}</b> &amp; add <b>{addName}</b></span>
                      </span>
                      <span className="tag s11 muted">Slot {i + 1}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Option 3: Keep existing and add as 3rd site (if compare.length < 3) */}
            {compare.length < 3 && (
              <div className="card pad16 col g8" style={{ border: '1.5px solid var(--accent)', background: 'var(--accentSoft)' }}>
                <div className="row sb ac">
                  <span className="b s14" style={{ color: 'var(--accent)' }}>Option 3 · Add as Site {compare.length + 1} (Keep all)</span>
                  <span className="tag ok b">Slot Available</span>
                </div>
                <span className="s12 muted">
                  You currently have {compare.length} of 3 maximum slots used. Keep all current sites and compare {addName} alongside them.
                </span>
                <button
                  className="btn ink sm"
                  style={{ alignSelf: 'flex-start', marginTop: 4 }}
                  onClick={handleAddKeepExisting}
                >
                  <Icon n="add-line" s={14} />
                  Add {addName} as Site {compare.length + 1}
                </button>
              </div>
            )}

            <div className="row jc" style={{ marginTop: 4 }}>
              <button className="btn ghost sm" onClick={closeAddModal}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
      <Footer />
    </div>
  );
}

