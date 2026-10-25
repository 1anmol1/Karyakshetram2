/**
 * Live competitor data → `competitors` collection.
 *
 * Connectors (per live category, every LIVE_REFRESH_HOURS):
 *   osm       OpenStreetMap Overpass                    always on (free)
 *   gplaces   Google Places API (New) searchText        when GOOGLE_PLACES_KEY is set; businessStatus → closures
 *   ocm       Open Charge Map                           EV only; OCM_API_KEY recommended; IsOperational → closures
 *   registry  government registers (FSSAI, FDA, RBI, PESO, BIS, NABL, GST, Shop Act…)
 *             server/data/registry/<key>.csv  or  POST /api/live/registry/:category
 *   platform  industry platforms & brand locators (Swiggy, Zomato, Blinkit, Practo, Cult.fit, OEM locators…)
 *             server/data/platform/<key>.json|csv, PLATFORM_FEED_URLS={"restaurant":"https://…"}  or  POST /api/live/platform/:category
 *
 * Merge: records within 60 m with a matching name are one business; each keeps the list of sources that saw it.
 * Closures: OSM-only record missing from the latest pull → NOT_IN_LATEST_OSM; registry cancelled → REGISTRY_CANCELLED;
 *   Google CLOSED_* → GOOGLE_CLOSED; platform delisted/closed → PLATFORM_DELISTED; charger not operational → OCM_NON_OPERATIONAL.
 * Simulated POIs of a category are removed only after a successful live pull; failures keep previous data.
 * After a sync, Node state + caches reload and the Python ML service is told to reload → the whole app recomputes.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { latLngToCell } from 'h3-js';
import { Poi, LiveSync } from '../models/index.js';
import { CITY, LOCALITIES } from '../data/city.js';
import { LIVE, LIVE_KEYS, PUNE_BBOX, feasibilityOf } from '../data/liveSources.js';
import { insideCity } from '../utils/index.js';
import { loadState, distKm } from '../ml/placeholder/state.js';
import { config } from '../config/index.js';
import { clearAll } from './cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const ENDPOINTS = (process.env.OVERPASS_URLS || 'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter').split(',').map((s) => s.trim());
const AUTO_CLOSE = ['NOT_IN_LATEST_OSM', 'REGISTRY_CANCELLED', 'GOOGLE_CLOSED', 'PLATFORM_DELISTED', 'OCM_NON_OPERATIONAL'];
const CLOSED_RE = /closed|cancel|suspend|revok|surrender|delist|unservice|inactive|struck|non[-_ ]?operational/i;

const nearestLocality = (lat, lon) => {
  let best = null, bd = Infinity;
  for (const l of LOCALITIES) { const d = distKm(lat, lon, l.lat, l.lon); if (d < bd) { bd = d; best = l.name; } }
  return best;
};
const norm = (s = '') => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const sameName = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x.includes(y) || y.includes(x)); };

let fetchImpl = (...a) => fetch(...a);
export const _setFetch = (f) => { fetchImpl = f; }; // tests

async function getJson(url, opts = {}, ms = 70000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetchImpl(url, { ...opts, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// ---------------- connector: OpenStreetMap
export function overpassQuery(key) {
  const { s, w, n, e } = PUNE_BBOX;
  return `[out:json][timeout:60];(${LIVE[key].overpass.map((q) => `${q}(${s},${w},${n},${e});`).join('')});out center tags;`;
}
async function fetchOverpass(key) {
  const body = 'data=' + encodeURIComponent(overpassQuery(key));
  let lastErr;
  for (const url of ENDPOINTS) {
    try { return (await getJson(url, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Karyakshetram/1.0 (site selection research)' } })).elements || []; } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Overpass unreachable');
}
export function fromOsm(key, el) {
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null || !insideCity(lat, lon, CITY.polygon)) return null;
  const t = el.tags || {};
  const brandClass = LIVE[key].brandClass(t);
  return { osmId: `${el.type}/${el.id}`, name: t.name || t.brand || t.operator || null, brand: t.brand || t.operator || undefined, category: key, brandClass, areaSqft: LIVE[key].area[brandClass] || 1500, lat, lon, sources: ['osm'] };
}

// ---------------- connector: Google Places API (New) – tiles the city so each request stays under the 60-result cap
export async function fetchGooglePlaces(key) {
  const apiKey = process.env.GOOGLE_PLACES_KEY;
  if (!apiKey || !LIVE[key].gtype) return null;
  const n = Math.max(1, Math.min(6, Number(process.env.GOOGLE_PLACES_TILES || 3)));
  const { s, w, n: north, e } = PUNE_BBOX;
  const dLat = (north - s) / n, dLon = (e - w) / n;
  const out = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    let pageToken;
    for (let page = 0; page < 3; page++) {
      const body = {
        textQuery: LIVE[key].gtype.replace(/_/g, ' '), includedType: LIVE[key].gtype, strictTypeFiltering: true, pageSize: 20, ...(pageToken ? { pageToken } : {}),
        locationRestriction: { rectangle: { low: { latitude: s + i * dLat, longitude: w + j * dLon }, high: { latitude: s + (i + 1) * dLat, longitude: w + (j + 1) * dLon } } },
      };
      const j2 = await getJson('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST', body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.businessStatus,nextPageToken' },
      }, 20000);
      for (const p of j2.places || []) out.push({ extId: `g/${p.id}`, name: p.displayName?.text, lat: p.location?.latitude, lon: p.location?.longitude, closed: !!p.businessStatus && p.businessStatus !== 'OPERATIONAL', kind: 'gplaces' });
      pageToken = j2.nextPageToken; if (!pageToken) break;
    }
  }
  return out;
}

// ---------------- connector: Open Charge Map (EV)
export async function fetchOpenChargeMap(key) {
  if (key !== 'ev') return null;
  const { s, w, n, e } = PUNE_BBOX;
  const url = `https://api.openchargemap.io/v3/poi/?output=json&countrycode=IN&maxresults=2000&compact=true&verbose=false&boundingbox=(${s},${w}),(${n},${e})${process.env.OCM_API_KEY ? `&key=${process.env.OCM_API_KEY}` : ''}`;
  const rows = await getJson(url, { headers: { 'User-Agent': 'Karyakshetram/1.0' } }, 30000);
  return rows.map((r) => ({ extId: `ocm/${r.ID}`, name: r.AddressInfo?.Title, lat: r.AddressInfo?.Latitude, lon: r.AddressInfo?.Longitude, closed: r.StatusType ? r.StatusType.IsOperational === false : false, kind: 'ocm' }));
}

// ---------------- connectors: government registry + platform feeds (files, env URLs, POSTed rows)
function readTable(file) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file);
  return file.endsWith('.json') ? JSON.parse(raw) : parse(raw, { columns: true, skip_empty_lines: true, trim: true });
}
/** rows: [{name, lat, lon, regNo?, status?, platform?, id?}] */
export function normaliseRows(rows, kind) {
  return (rows || []).map((r) => ({
    name: r.name, lat: Number(r.lat ?? r.latitude), lon: Number(r.lon ?? r.lng ?? r.longitude), regNo: r.regNo || r.reg_no || r.licence || r.gstin || r.ifsc || undefined,
    platform: r.platform || r.source || undefined, extId: r.id ? `${kind}/${r.platform || ''}/${r.id}` : undefined,
    closed: CLOSED_RE.test(r.status || ''), kind,
  })).filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lon) && insideCity(r.lat, r.lon, CITY.polygon));
}
export const normaliseRegistry = (key, rows) => normaliseRows(rows, 'registry'); // backwards compatible
export function readRegistry(key) {
  return normaliseRows([...readTable(path.join(DATA_DIR, 'registry', `${key}.csv`)), ...readTable(path.join(DATA_DIR, 'registry', `${key}.json`))], 'registry');
}
async function readPlatform(key) {
  const rows = [...readTable(path.join(DATA_DIR, 'platform', `${key}.json`)), ...readTable(path.join(DATA_DIR, 'platform', `${key}.csv`))];
  const urls = feedUrls();
  for (const u of [].concat(urls[key] || [])) {
    try { const j = await getJson(u, { headers: process.env.PLATFORM_FEED_TOKEN ? { Authorization: `Bearer ${process.env.PLATFORM_FEED_TOKEN}` } : {} }, 30000); rows.push(...(Array.isArray(j) ? j : j.rows || j.data || [])); } catch (e) { console.warn('[live] platform feed failed', key, e.message); }
  }
  return normaliseRows(rows, 'platform');
}
const feedUrls = () => { try { return JSON.parse(process.env.PLATFORM_FEED_URLS || '{}'); } catch { return {}; } };
export const connectorStatus = (key) => ({
  osm: true,
  gplaces: !!process.env.GOOGLE_PLACES_KEY && !!LIVE[key]?.gtype,
  ocm: key === 'ev',
  registry: fs.existsSync(path.join(DATA_DIR, 'registry', `${key}.csv`)) || fs.existsSync(path.join(DATA_DIR, 'registry', `${key}.json`)),
  platform: fs.existsSync(path.join(DATA_DIR, 'platform', `${key}.json`)) || fs.existsSync(path.join(DATA_DIR, 'platform', `${key}.csv`)) || feedUrls()[key] != null,
});

const REASON = { registry: 'REGISTRY_CANCELLED', gplaces: 'GOOGLE_CLOSED', platform: 'PLATFORM_DELISTED', ocm: 'OCM_NON_OPERATIONAL' };

/** Merge OSM records with rows from other connectors. Returns live records + closures (with reasons). */
export function mergeAll(key, osm, extras) {
  const spec = LIVE[key];
  const out = osm.map((p) => ({ ...p, sources: [...(p.sources || ['osm'])] }));
  const closures = [];
  for (const r of extras) {
    const match = out.find((p) => distKm(p.lat, p.lon, r.lat, r.lon) <= 0.06 && (sameName(p.name, r.name) || !p.name));
    if (r.closed) { closures.push({ ...r, match, reason: REASON[r.kind] }); if (match) match._closed = REASON[r.kind]; continue; }
    if (match) {
      if (!match.sources.includes(r.kind)) match.sources.push(r.kind);
      if (r.regNo) match.regNo = r.regNo; if (r.platform) match.platforms = [...new Set([...(match.platforms || []), r.platform])];
      if (!match.name) match.name = r.name; continue;
    }
    const brandClass = spec.brandClass({ name: r.name });
    out.push({ osmId: r.extId || `${r.kind}/${key}/${r.regNo || norm(r.name) + '@' + r.lat.toFixed(4)}`, name: r.name, category: key, brandClass, areaSqft: spec.area[brandClass] || 1500, lat: r.lat, lon: r.lon, sources: [r.kind], regNo: r.regNo, platforms: r.platform ? [r.platform] : undefined });
  }
  return { records: out.filter((p) => !p._closed), closures };
}
export const mergeSources = (key, osm, registry) => mergeAll(key, osm, registry); // backwards compatible

const primary = (srcs) => (srcs.includes('osm') && srcs.length === 1 ? 'osm' : srcs.length > 1 ? 'multi' : srcs[0]);
const running = new Set();

export async function syncCategory(key, { extraRegistry = [], extraPlatform = [], reload = true } = {}) {
  if (!LIVE[key]) throw new Error(`${key} is not a live category`);
  if (running.has(key)) return { category: key, skipped: 'already running' };
  running.add(key);
  const t0 = Date.now();
  const warnings = [];
  try {
    const elements = await fetchOverpass(key);
    const osm = elements.map((el) => fromOsm(key, el)).filter(Boolean);
    const extras = [];
    for (const [name, fn] of [['gplaces', fetchGooglePlaces], ['ocm', fetchOpenChargeMap]]) {
      try { const rows = await fn(key); if (rows) extras.push(...rows.filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lon) && insideCity(r.lat, r.lon, CITY.polygon))); } catch (e) { warnings.push(`${name}: ${e.message}`); }
    }
    extras.push(...readRegistry(key), ...normaliseRows(extraRegistry, 'registry'), ...(await readPlatform(key)), ...normaliseRows(extraPlatform, 'platform'));
    const { records, closures } = mergeAll(key, osm, extras);
    if (!records.length) throw new Error('Live sources returned 0 records; keeping previous data');

    const now = new Date();
    const existing = await Poi.find({ category: key, source: { $ne: 'simulated' } }).lean();
    const byId = new Map(existing.map((p) => [p.osmId, p]));
    const seen = new Set();
    let added = 0, reopened = 0;
    const ops = [];
    for (const p of records) {
      seen.add(p.osmId);
      const prev = byId.get(p.osmId);
      const set = {
        name: p.name || `${key} outlet`, brand: p.brand, category: key, brandClass: p.brandClass, areaSqft: p.areaSqft, source: primary(p.sources), sources: p.sources, platforms: p.platforms, regNo: p.regNo,
        loc: { type: 'Point', coordinates: [p.lon, p.lat] }, h3: latLngToCell(p.lat, p.lon, 8), locality: nearestLocality(p.lat, p.lon), lastSeen: now,
      };
      if (!prev) { added++; Object.assign(set, { status: 'open', firstSeen: now, statusChangedAt: now }); }
      // closed automatically but back in the data → reopen; user/what-if closures stay until undone
      else if (prev.status === 'closed' && AUTO_CLOSE.includes(prev.closedReason)) { reopened++; Object.assign(set, { status: 'open', closedReason: null, statusChangedAt: now }); }
      ops.push({ updateOne: { filter: { osmId: p.osmId }, update: { $set: set }, upsert: true } });
    }
    // only map-only records can "vanish"; records backed by a registry/platform/API close via that source's status
    const vanished = existing.filter((p) => !seen.has(p.osmId) && p.status === 'open' && p.source === 'osm');
    for (const p of vanished) ops.push({ updateOne: { filter: { _id: p._id }, update: { $set: { status: 'closed', closedReason: 'NOT_IN_LATEST_OSM', statusChangedAt: now } } } });
    const closedNow = closures.filter((c) => byId.has(c.match?.osmId) || byId.has(c.extId)); // only businesses we already knew about
    for (const c of closedNow) ops.push({ updateOne: { filter: { osmId: c.match?.osmId || c.extId }, update: { $set: { status: 'closed', closedReason: c.reason, statusChangedAt: now } } } });
    if (ops.length) await Poi.bulkWrite(ops, { ordered: false });
    await Poi.deleteMany({ category: key, source: 'simulated' });

    const bySource = {};
    for (const p of records) for (const s of p.sources) bySource[s] = (bySource[s] || 0) + 1;
    const nameCoverage = Math.round((osm.filter((p) => p.name).length / Math.max(1, osm.length)) * 100);
    const log = await LiveSync.create({
      category: key, ok: true, durationMs: Date.now() - t0, fetched: elements.length + extras.length,
      osm: bySource.osm || 0, registry: bySource.registry || 0, both: records.filter((p) => p.sources.length > 1).length, bySource, warnings,
      open: await Poi.countDocuments({ category: key, status: 'open' }), added, reopened,
      closed: vanished.length + closedNow.length, nameCoverage, feasibility: feasibilityOf(key),
    });
    if (reload) await reloadEverywhere();
    return log.toObject();
  } catch (e) {
    await LiveSync.create({ category: key, ok: false, error: String(e.message || e), warnings, durationMs: Date.now() - t0, feasibility: feasibilityOf(key) }).catch(() => {});
    return { category: key, ok: false, error: String(e.message || e) };
  } finally { running.delete(key); }
}

export async function syncAll(keys = LIVE_KEYS) {
  const results = [];
  for (const k of keys) { results.push(await syncCategory(k, { reload: false })); await new Promise((r) => setTimeout(r, 1500)); } // be polite to Overpass
  await reloadEverywhere();
  return results;
}

/** Reload Node state (clears every score/catchment cache) and tell the Python ML service to reload too */
export async function reloadEverywhere() {
  const s = await loadState();
  clearAll(); // hex layer + recommendation response caches
  if (config.mlServiceUrl) {
    fetch(`${config.mlServiceUrl.replace(/\/$/, '')}/ml/reload`, { method: 'POST', headers: { 'X-Internal-Key': config.mlInternalKey } }).catch(() => {});
  }
  return s;
}

/** What-if / user report: mark a competitor as not existing (or restore it) and recompute the whole app */
export async function setCompetitorStatus(id, status, reason = 'WHAT_IF') {
  const q = /^[a-f0-9]{24}$/i.test(id) ? { _id: id } : { osmId: id };
  const p = await Poi.findOneAndUpdate(q, { $set: { status, closedReason: status === 'closed' ? reason : null, statusChangedAt: new Date() } }, { new: true }).lean();
  if (!p) return null;
  await reloadEverywhere();
  return p;
}

let timer = null;
export function startScheduler() {
  const hours = Number(process.env.LIVE_REFRESH_HOURS || 12);
  if (process.env.LIVE_DATA === 'off' || !hours) return;
  const run = () => syncAll().then((r) => console.log('[live] sync', r.map((x) => `${x.category}:${x.ok === false ? 'FAIL ' + x.error : x.open + ' open'}`).join(' · '))).catch((e) => console.warn('[live] sync failed', e.message));
  setTimeout(run, 15000); // first sync shortly after boot
  timer = setInterval(run, hours * 3600e3);
  timer.unref?.();
}
