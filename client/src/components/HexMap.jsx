import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.gridlayer.googlemutant';
import { useTheme } from '../lib/state.jsx';
import { inr } from '../lib/format.js';
import { Icon } from './ui.jsx';

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Singleton: load the Google Maps JS API once globally */
let gmapsLoaded = false;
let gmapsLoading = false;
const gmapsCallbacks = [];

function finishGmapsLoad() {
  if (gmapsLoaded) return;
  gmapsLoaded = true;
  gmapsCallbacks.forEach((f) => f());
  gmapsCallbacks.length = 0;
}

function loadGmapsApi(cb) {
  if (gmapsLoaded && typeof window !== 'undefined' && window.google?.maps?.Map) {
    cb();
    return;
  }
  gmapsCallbacks.push(cb);
  if (gmapsLoading) return;
  gmapsLoading = true;
  if (!GMAPS_KEY) {
    // No key available — resolve immediately to use CARTO basemap
    finishGmapsLoad();
    return;
  }
  window.__initGmapsApi = async () => {
    try {
      if (window.google?.maps?.importLibrary) {
        await Promise.all([
          google.maps.importLibrary('maps'),
          google.maps.importLibrary('places'),
        ]);
      }
    } catch (e) {
      console.warn('Google Maps async importLibrary warning:', e);
    }
    finishGmapsLoad();
  };
  const s = document.createElement('script');
  s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places&loading=async&callback=__initGmapsApi`;
  s.async = true;
  s.defer = true;
  s.onerror = () => {
    finishGmapsLoad();
  };
  document.head.appendChild(s);
}

/**
 * Leaflet H3 hex choropleth with Google Maps basemap (FR-11).
 * props: features (GeoJSON), picks [{lat,lon,n,label,color}], own [{lat,lon,label}], comps [{lat,lon,name}],
 *        rings [{lat,lon,km,kind}], pin {lat,lon}, selected cellId, tiers Set, center [lat,lon], zoom,
 *        onCellClick(feature), onMapClick({lat,lon}), legend, controls, fit ('features'|'markers'|null)
 */
export default function HexMap({ features, picks = [], own = [], comps = [], rings = [], pin, selected, tiers, center, zoom = 12, onCellClick, onMapClick, legend = true, controls = true, fit, height = '100%', interactive = true, popup = true, dim = false }) {
  const el = useRef(null), map = useRef(null), layers = useRef({});
  const { theme } = useTheme();
  const [offline, setOffline] = useState(false);
  const [gmReady, setGmReady] = useState(gmapsLoaded);
  const cbs = useRef({}); cbs.current = { onCellClick, onMapClick };

  // Compute locality rank map for accurate H1, H2, H3 labels in every locality
  const localityRankMap = useMemo(() => {
    if (!features?.length) return new Map();
    const byLoc = new Map();
    for (const f of features) {
      const loc = f.properties?.locality || 'Pune';
      if (!byLoc.has(loc)) byLoc.set(loc, []);
      byLoc.get(loc).push(f);
    }
    const rankMap = new Map();
    for (const [_, cellList] of byLoc.entries()) {
      cellList.sort((a, b) => {
        if (a.properties?.eligible !== b.properties?.eligible) {
          return a.properties?.eligible ? -1 : 1;
        }
        return (b.properties?.exp || 0) - (a.properties?.exp || 0);
      });
      cellList.forEach((cell, idx) => {
        rankMap.set(cell.properties?.id, idx + 1);
      });
    }
    return rankMap;
  }, [features]);

  // Trigger Google Maps API load early
  useEffect(() => {
    if (!gmapsLoaded) {
      loadGmapsApi(() => setGmReady(true));
    }
  }, []);

  // Initialise the Leaflet map once gmaps is ready (or immediately if no key)
  useEffect(() => {
    if (!gmReady) return;
    if (map.current) return; // already initialised

    const m = L.map(el.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: interactive,
      doubleClickZoom: interactive,
      preferCanvas: false,
    }).setView(center || [18.555, 73.85], zoom);

    let baseTile;
    let isCarto = false;

    if (GMAPS_KEY && window.google?.maps?.Map) {
      // Google Maps basemap — roadmap style, city context only
      try {
        baseTile = L.gridLayer.googleMutant({
          type: 'roadmap',
          styles: [
            // Remove points of interest clutter — keep roads & city layout
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
            { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
            // Subtle, desaturated look so hex overlays stand out
            { elementType: 'geometry', stylers: [{ saturation: -20 }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#aecbf0' }] },
            { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f2' }] },
          ],
          maxZoom: 20,
        });
        baseTile.addTo(m);
      } catch (e) {
        // Fallback to CARTO Positron / Dark Matter (no 403 blocks)
        baseTile = _cartoFallback(m, theme, setOffline);
        isCarto = true;
      }
    } else {
      // Use CARTO basemap (official, fast, free, no 403 access blocked errors)
      baseTile = _cartoFallback(m, theme, setOffline);
      isCarto = true;
    }

    layers.current = { hex: L.layerGroup().addTo(m), marks: L.layerGroup().addTo(m), tiles: baseTile, isCarto };
    m.on('click', (e) => cbs.current.onMapClick?.({ lat: e.latlng.lat, lon: e.latlng.lng }));
    map.current = m;

    const ro = new ResizeObserver(() => { if (map.current) m.invalidateSize({ animate: false }); });
    ro.observe(el.current);
    return () => { ro.disconnect(); m.stop(); m.off(); m.remove(); map.current = null; };
  }, [gmReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (center && map.current) map.current.setView(center, zoom ?? map.current.getZoom(), { animate: true }); }, [center?.[0], center?.[1], zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update CARTO basemap tiles when switching theme
  useEffect(() => {
    if (!map.current || !layers.current?.tiles) return;
    if (layers.current.isCarto && layers.current.tiles.setUrl) {
      const isDark = theme === 'dark' || (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark');
      const newUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      layers.current.tiles.setUrl(newUrl);
    }
  }, [theme]);

  // hex layer
  useEffect(() => {
    const g = layers.current.hex; if (!g) return;
    g.clearLayers();
    if (!features?.length) return;
    const ramp = [0, 1, 2, 3, 4].map((i) => css(`--hex${i}`)), mask = css('--mask'), line = css('--mapBg'), ink = css('--ink');
    const vals = features.filter((f) => f.properties.eligible).map((f) => f.properties.exp).sort((a, b) => a - b);
    const q = (p) => vals[Math.floor(p * (vals.length - 1))] ?? 0;
    const cuts = [q(0.2), q(0.4), q(0.6), q(0.8)];
    const gj = L.geoJSON({ type: 'FeatureCollection', features }, {
      style: (f) => {
        const p = f.properties; const hidden = tiers && !tiers.has(p.tier) && p.eligible;
        const idx = cuts.filter((c) => p.exp > c).length;
        const isSel = selected === p.id;
        return { color: isSel ? ink : line, weight: isSel ? 3 : 1, fillColor: p.eligible ? ramp[idx] : mask, fillOpacity: hidden ? 0.08 : dim ? 0.35 : p.eligible ? 0.66 : 0.6, opacity: 1 };
      },
      onEachFeature: (f, layer) => {
        const p = f.properties;
        const hNum = p.hIndex || localityRankMap.get(p.id) || p.rank || p.n || 1;
        const hQuery = `?h=${hNum}`;
        const locTitle = escapeHtml(p.locality || 'Location');
        const fullTitle = locTitle.startsWith('H') ? locTitle : `H${hNum} in ${locTitle}`;
        if (popup) layer.bindPopup(() => `<div style="min-width:190px"><div style="font-weight:700;font-size:14px;margin-bottom:4px">${fullTitle}</div>${p.eligible
          ? `<div>Tier <b>${p.tier}</b> · ${escapeHtml(p.confidence)} confidence</div><div>Expected profit <b>${inr(p.exp)}</b>/yr</div><div>Rent ₹${p.rent}/sq ft</div>`
          : `<div style="color:${css('--bad')}">Not suitable</div><div style="font-size:12px">${p.reasons.map(escapeHtml).join('<br>')}</div>`}<a href="/location/${p.id}${hQuery}" data-cell="${p.id}" data-h="${hNum}" style="display:inline-block;margin-top:8px;font-weight:700;color:${css('--accent')}">${p.eligible ? `Open Location H${hNum} →` : 'See alternatives →'}</a></div>`);
        layer.on('click', (e) => { L.DomEvent.stopPropagation(e); cbs.current.onCellClick?.({ ...f, properties: { ...p, hIndex: hNum } }); });
      },
    }).addTo(g);
    if (fit === 'features' && map.current) map.current.fitBounds(gj.getBounds(), { padding: [10, 10], animate: false });
  }, [features, localityRankMap, theme, tiers, selected, dim, fit, popup]);

  // markers
  useEffect(() => {
    const g = layers.current.marks; if (!g) return;
    g.clearLayers();
    for (const r of rings) L.circle([r.lat, r.lon], { radius: r.km * 1000, color: r.kind === 'own' ? css('--ink') : css('--accent'), weight: 1.5, dashArray: '5 4', fillColor: r.kind === 'own' ? css('--ink') : css('--accent'), fillOpacity: r.kind === 'own' ? 0.04 : 0.08, interactive: false }).addTo(g);
    for (const c of comps) L.marker([c.lat, c.lon], { icon: L.divIcon({ className: '', html: '<div class="compmk"></div>', iconSize: [12, 12], iconAnchor: [6, 6] }), title: c.name }).bindTooltip(escapeHtml(c.name)).addTo(g);
    for (const s of own) L.marker([s.lat, s.lon], { icon: L.divIcon({ className: '', html: `<div style="position:relative"><div class="ownmk"></div>${s.label ? `<span class="ownlbl">${escapeHtml(s.label)}</span>` : ''}</div>`, iconSize: [16, 16], iconAnchor: [8, 8] }), title: s.label || 'Your store' }).addTo(g);
    for (const p of picks) {
      const mk = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html: `<div class="pin"><span class="head" style="${p.color ? `background:${p.color}` : ''}"></span><b>${escapeHtml(p.n ?? '')}</b>${p.label ? `<span class="pinlbl">${escapeHtml(p.label)}</span>` : ''}</div>`, iconSize: [26, 34], iconAnchor: [13, 34] }), zIndexOffset: 1000, title: p.title || p.label || '' }).addTo(g);
      if (p.onClick) mk.on('click', p.onClick);
    }
    if (pin) L.marker([pin.lat, pin.lon], { icon: L.divIcon({ className: '', html: `<div class="pin"><span class="head" style="background:${pin.color || css('--accent2')}"></span><b>${pin.n || ''}</b>${pin.label ? `<span class="pinlbl">${escapeHtml(pin.label)}</span>` : ''}</div>`, iconSize: [26, 34], iconAnchor: [13, 34] }), zIndexOffset: 2000 }).addTo(g);
    if (fit === 'markers') {
      const pts = [...picks, ...own, ...(pin ? [pin] : [])].map((p) => [p.lat, p.lon]);
      if (!map.current) return; if (pts.length > 1) map.current.fitBounds(pts, { padding: [40, 40], maxZoom: 14, animate: false }); else if (pts.length === 1) map.current.setView(pts[0], 14, { animate: false });
    }
  }, [picks, own, comps, rings, pin, theme, fit]);

  const z = (d) => map.current?.setZoom(map.current.getZoom() + d);
  const recenter = () => { const pts = [...picks, ...own].map((p) => [p.lat, p.lon]); if (pts.length) map.current.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }); else map.current.setView(center || [18.555, 73.85], zoom); };
  const toggleTiles = () => { const t = layers.current.tiles; if (!t) return; if (map.current.hasLayer(t)) map.current.removeLayer(t); else t.addTo(map.current); };

  return (
    <div className="map" style={{ height }}>
      <div ref={el} style={{ position: 'absolute', inset: 0 }} />
      {controls && <div className="mapctl" style={{ right: 14, top: 14 }}>
        <button className="iconbtn" onClick={() => z(1)} aria-label="Zoom in"><Icon n="add-line" /></button>
        <button className="iconbtn" onClick={() => z(-1)} aria-label="Zoom out"><Icon n="subtract-line" /></button>
        <button className="iconbtn" onClick={recenter} aria-label="Recenter"><Icon n="focus-3-line" /></button>
        <button className="iconbtn" onClick={toggleTiles} aria-label="Toggle basemap"><Icon n="stack-line" /></button>
      </div>}
      {legend && features?.length > 0 && <div className="legend" style={{ left: 14, bottom: 14 }}>
        <div className="b s13" style={{ marginBottom: 7, color: 'var(--text)', letterSpacing: '-0.2px' }}>Expected profit (P50)</div>
        <div className="ramp" style={{ width: 176, height: 10, borderRadius: 999, overflow: 'hidden' }}>
          {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ background: `var(--hex${i})` }} />)}
        </div>
        <div className="row sb s13 muted" style={{ marginTop: 4, width: 176, fontSize: 13 }}><span>Low</span><span>High</span></div>
        <div className="row g8 s13 muted" style={{ marginTop: 8, alignItems: 'center', fontSize: 13 }}>
          <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--mask)', flex: 'none', display: 'inline-block' }} />
          <span>Not suitable (rule / mask)</span>
        </div>
      </div>}
      {offline && interactive && <span className="tag maptag" style={{ left: 14, top: 14, background: 'var(--bg)', height: 28 }}><Icon n="wifi-off-line" s={12} />Basemap offline · hex layer still shown</span>}
      {interactive && <div className="attrib">© Google Maps · CARTO · WorldPop</div>}
    </div>
  );
}

// CARTO basemap helper — free high-performance vector-rendered tiles with zero 403 blocks
function _cartoFallback(m, theme, setOffline) {
  const isDark = theme === 'dark' || (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark');
  const url = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  const tiles = L.tileLayer(url, {
    maxZoom: 20,
    subdomains: 'abcd',
    crossOrigin: true,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
  let errs = 0;
  tiles.on('tileerror', () => { errs++; if (errs > 4) setOffline?.(true); });
  tiles.on('tileload', () => { errs = 0; setOffline?.(false); });
  tiles.addTo(m);
  return tiles;
}
