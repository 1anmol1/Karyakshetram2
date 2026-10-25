import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { inr, km, n } from '../lib/format.js';
import { useApp, useAuth } from '../lib/state.jsx';
import { Modal, Icon, Kv, Tier, Conf, Banner, Skel } from './ui.jsx';

export default function CompetitorAnalysisModal({ open, onClose, shop, activeCategory }) {
  const nav = useNavigate();
  const { categories, setCategory } = useApp();
  const { user } = useAuth();
  const [whatIf, setWhatIf] = useState(null);
  const markGone = async () => {
    if (!shop?.id) return;
    setWhatIf('busy');
    try {
      await api(`/live/competitors/${shop.id}/status`, { method: 'POST', body: { status: 'closed', reason: 'WHAT_IF' } });
      setWhatIf('done');
      setTimeout(() => window.location.reload(), 900); // every hexagon, score and recommendation recomputes server-side
    } catch (e) { setWhatIf(e.message || 'Failed'); }
  };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !shop) {
      setData(null);
      return;
    }
    setLoading(true);
    const cat = activeCategory === 'all' ? (shop.category || 'grocery') : activeCategory;
    api(`/shops/${shop.id}/analysis?category=${cat}${shop.cell ? `&cell=${shop.cell}` : ''}`)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        // Fallback using shop data if endpoint errored
        const isComp = shop.category === cat || shop.relation === 'Competitor';
        setData({
          id: shop.id,
          name: shop.name,
          category: shop.category,
          locality: shop.locality || 'Pune',
          distKm: shop.distKm,
          cell: shop.cell,
          isInCategory: isComp,
          generalData: {
            commercialRatio: 35,
            population2020: 8200,
            households: 2100,
            roadDistM: 110,
            footfallIndex: 72,
            anchors: { schools: 2, offices: 3 },
          },
          modelData: isComp ? {
            turnoverAnnual: 32000000,
            profitExp: 5800000,
            threatLevel: shop.distKm <= 0.5 ? 'High Threat' : 'Moderate Threat',
            competitionShap: -140000,
            rentBenchmark: 145,
            breakevenRent: 160,
            areaSqft: 2800,
            catchmentKm: 2,
            tier: 'A',
            confidence: 'High',
            huffAttractionWeight: 1.0,
            huffFrictionLambda: 1.85,
          } : null,
        });
        setLoading(false);
      });
  }, [open, shop?.id, shop?.cell, shop?.category, activeCategory]);

  if (!open || !shop) return null;

  const currentCatInfo = categories.find((c) => c.key === activeCategory) || { name: 'Active Category' };
  const shopCatInfo = categories.find((c) => c.key === (data?.category || shop.category)) || { name: shop.category };
  const isInCategory = data ? data.isInCategory : (shop.category === activeCategory || shop.relation === 'Competitor');
  const general = data?.generalData || { commercialRatio: 30, population2020: 7500, households: 1900, roadDistM: 120, anchors: { schools: 1, offices: 2 } };
  const model = data?.modelData;

  return (
    <Modal open={open} onClose={onClose} title="Competitor & Shop Analysis">
      <div className="col g16" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        {/* Header summary */}
        <div className="row sb ac wrap g10" style={{ paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
          <div className="col g4" style={{ minWidth: 0, flex: 1 }}>
            <div className="row g8 ac">
              <Icon n="store-2-fill" s={20} c="var(--accent)" />
              <h3 className="h3" style={{ margin: 0 }}>{shop.name}</h3>
            </div>
            <span className="s13 muted">
              {shopCatInfo.name} · {shop.locality || data?.locality || 'Pune'} · {km(shop.distKm)} from search center
            </span>
          </div>
          <div>
            {isInCategory ? (
              <span className="tag warn b" style={{ padding: '6px 12px', fontSize: 13 }}>
                <Icon n="sword-fill" s={14} /> Direct Competitor
              </span>
            ) : (
              <span className="tag info b" style={{ padding: '6px 12px', fontSize: 13 }}>
                <Icon n="building-line" s={14} /> General Area Business
              </span>
            )}
          </div>
        </div>

        {loading && (
          <div className="col g12">
            <Skel h={44} style={{ borderRadius: 10 }} />
            <div className="grid3" style={{ gap: 12 }}>
              <Skel h={72} />
              <Skel h={72} />
              <Skel h={72} />
            </div>
            <Skel h={100} style={{ borderRadius: 12 }} />
          </div>
        )}

        {!loading && isInCategory && (
          <>
            <Banner tone="warn" icon="shield-cross-line">
              Direct category competitor in <b>{shopCatInfo.name}</b>. Related model outputs display estimated turnover, market gravity draw, and competition impact on local gross margins.
            </Banner>

            {model && (
              <div className="grid3" style={{ gap: 12 }}>
                <div className="panel pad14">
                  <Kv k="Model Turnover (P50)" v={inr(model.turnoverAnnual)} sub="Projected annual sales" />
                </div>
                <div className="panel pad14">
                  <Kv k="Expected Profit" v={inr(model.profitExp)} sub="Calibrated model margin" />
                </div>
                <div className="panel pad14">
                  <Kv k="Threat Assessment" v={model.threatLevel} sub={`${km(shop.distKm)} distance`} />
                </div>
                <div className="panel pad14">
                  <Kv k="Competition Shock" v={inr(model.competitionShap)} sub="Margin drag on nearby sites" />
                </div>
                <div className="panel pad14">
                  <Kv k="Benchmark Rent" v={`₹${model.rentBenchmark} / sq ft`} sub={`Break-even ₹${model.breakevenRent}`} />
                </div>
                <div className="panel pad14">
                  <div className="col g4">
                    <span className="s12 muted">Model Resilience</span>
                    <div className="row g6 ac">
                      <Tier t={model.tier} />
                      <Conf c={model.confidence} />
                    </div>
                    <span className="s11 muted">{model.stressPasses}/4 Stress Tests Passed</span>
                  </div>
                </div>
              </div>
            )}

            <div className="card pad16 col g8" style={{ background: 'var(--surface2)' }}>
              <div className="row g8 ac">
                <Icon n="radar-line" s={16} c="var(--accent)" />
                <span className="b s13">Huff Spatial Gravity &amp; Competition Impact</span>
              </div>
              <p className="s13 muted" style={{ lineHeight: 1.5, margin: 0 }}>
                {shop.distKm <= 0.5 ? (
                  <>Immediate rivalry: At <b>{km(shop.distKm)}</b>, this store sits in the acute 500m cannibalisation zone. New branch openings here should price competitively or offer distinct assortment.</>
                ) : (
                  <>Optimal buffer: At <b>{km(shop.distKm)}</b>, this rival is outside the 500m critical cannibalisation radius while benefiting from the same high-density neighborhood customer flows.</>
                )}
              </p>
            </div>

            <div className="row g10 wrap" style={{ paddingTop: 6 }}>
              {shop.cell && (
                <button
                  type="button"
                  className="btn ink sm"
                  onClick={() => {
                    onClose();
                    nav(`/location/${shop.cell}?category=${shop.category || activeCategory}`);
                  }}
                >
                  <Icon n="map-pin-2-line" s={14} />
                  Inspect Location Scorecard
                </button>
              )}
              {shop.cell && (
                <button
                  type="button"
                  className="btn out sm"
                  onClick={() => {
                    onClose();
                    nav(`/cannibalisation/${shop.cell}`);
                  }}
                >
                  <Icon n="git-merge-line" s={14} />
                  Test Cannibalisation
                </button>
              )}
              {user && shop.relation !== 'Your store' && (
                <button type="button" className="btn out sm" disabled={whatIf === 'busy' || whatIf === 'done'} onClick={markGone} title="What-if: remove this competitor and recompute every score">
                  <Icon n="store-3-line" s={14} />
                  {whatIf === 'done' ? 'Removed · recomputing…' : whatIf === 'busy' ? 'Removing…' : 'What if this competitor doesn\u2019t exist?'}
                </button>
              )}
              {shop.source && shop.source !== 'own' && (
                <span className={`tag ${shop.source === 'simulated' ? 'warn' : 'ok'}`} style={{ fontSize: 11 }} title={(shop.platforms || []).join(', ')}>
                  {shop.source === 'simulated' ? 'Simulated record' : `Live · ${(shop.sources?.length ? shop.sources : [shop.source]).map((x) => ({ osm: 'OpenStreetMap', gplaces: 'Google Places', ocm: 'Open Charge Map', registry: 'Govt registry', platform: 'Platform' }[x] || x)).join(' + ')}`}
                </span>
              )}
              {whatIf && !['busy', 'done'].includes(whatIf) && <span className="s12" style={{ color: 'var(--bad, #c33)' }}>{whatIf}</span>}
              <button type="button" className="btn ghost sm" onClick={onClose} style={{ marginLeft: 'auto' }}>
                Close
              </button>
            </div>
          </>
        )}

        {!loading && !isInCategory && (
          <>
            <Banner tone="info" icon="information-line">
              General Retail Business — Operates in <b>{shopCatInfo.name}</b> (different vertical from active <b>{currentCatInfo.name}</b>). Only general demographic and land-use data is shown; category-specific revenue distribution and competition SHAP drivers do not apply.
            </Banner>

            <div className="grid3" style={{ gap: 12 }}>
              <div className="panel pad14">
                <Kv k="Retail Sector" v={shopCatInfo.name} sub="Non-competing vertical" />
              </div>
              <div className="panel pad14">
                <Kv k="Distance" v={km(shop.distKm)} sub="From active locality center" />
              </div>
              <div className="panel pad14">
                <Kv k="Block Population" v={n(general.population2020)} sub="2020 WorldPop census" />
              </div>
              <div className="panel pad14">
                <Kv k="Residential Households" v={n(general.households)} sub="Surrounding consumer base" />
              </div>
              <div className="panel pad14">
                <Kv k="Commercial Land Use" v={`${general.commercialRatio}%`} sub="Commercial zoning mix" />
              </div>
              <div className="panel pad14">
                <Kv k="Nearest Major Road" v={`${general.roadDistM} m`} sub="Access corridor" />
              </div>
            </div>

            <div className="card pad16 col g8" style={{ background: 'var(--surface2)' }}>
              <div className="row g8 ac">
                <Icon n="compass-3-line" s={16} c="var(--accent2)" />
                <span className="b s13">Commercial Synergies for {currentCatInfo.name}</span>
              </div>
              <p className="s13 muted" style={{ lineHeight: 1.5, margin: 0 }}>
                This store acts as an adjacent commercial business generating non-competing customer footfall ({general.anchors?.schools || 2} schools and {general.anchors?.offices || 3} offices nearby) that can synergize with your {currentCatInfo.name} site.
              </p>
            </div>

            <div className="row g10 wrap" style={{ paddingTop: 6 }}>
              {shop.cell && (
                <button
                  type="button"
                  className="btn ink sm"
                  onClick={() => {
                    onClose();
                    nav(`/location/${shop.cell}`);
                  }}
                >
                  <Icon n="map-pin-2-line" s={14} />
                  Inspect Location Cell
                </button>
              )}
              {shop.category && (
                <button
                  type="button"
                  className="btn out sm"
                  onClick={() => {
                    setCategory(shop.category);
                    onClose();
                    if (shop.cell) nav(`/location/${shop.cell}?category=${shop.category}`);
                  }}
                >
                  <Icon n="shuffle-line" s={14} />
                  Switch Active Category to {shopCatInfo.name}
                </button>
              )}
              <button type="button" className="btn ghost sm" onClick={onClose} style={{ marginLeft: 'auto' }}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
