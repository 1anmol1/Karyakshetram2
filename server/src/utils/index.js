import crypto from 'crypto';
import { CITY } from '../data/city.js';

export class ApiError extends Error {
  constructor(status, code, message, field) { super(message); this.status = status; this.code = code; this.field = field; }
}
export const bad = (message, field, code = 'VALIDATION_ERROR') => new ApiError(400, code, message, field);
export const notFound = (message = 'Not found') => new ApiError(404, 'NOT_FOUND', message);

export const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function insideCity(lat, lon, poly = CITY.polygon) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const hash = (obj) => crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 16);

// Seeded PRNG + smooth noise so the simulated city is reproducible (same seed → identical checksum)
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function noise2(x, y, seed = 1) {
  const a = Math.sin(x * 12.9898 + y * 78.233 + seed * 3.1) * 43758.5453;
  return a - Math.floor(a);
}

// Indian money formatting used by narratives: ₹38.4 L, ₹4.1 Cr
export function inr(v, digits = 1) {
  if (v == null || Number.isNaN(v)) return '—';
  const neg = v < 0, a = Math.abs(v);
  let s;
  if (a >= 1e7) s = `₹${(a / 1e7).toFixed(digits)} Cr`;
  else if (a >= 1e5) s = `₹${(a / 1e5).toFixed(digits)} L`;
  else s = `₹${Math.round(a).toLocaleString('en-IN')}`;
  return (neg ? '−' : '') + s;
}
export const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;
export const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
