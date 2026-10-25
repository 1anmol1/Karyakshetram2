// Fetch wrapper with the API's stable error schema {error:{code,message,field}}.
const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'ks-token';

export class ApiError extends Error {
  constructor(status, code, message, field, extra = {}) { super(message); this.status = status; this.code = code; this.field = field; Object.assign(this, extra); }
}
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t, remember = true) => {
  try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); if (t) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t); } catch { /* storage blocked */ }
};

export async function api(path, { method = 'GET', body, form, signal, timeout = 20000 } = {}) {
  const headers = {};
  const t = getToken(); if (t) headers.Authorization = `Bearer ${t}`;
  let payload;
  if (form) payload = form; else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  if (signal) signal.addEventListener('abort', () => ctrl.abort());
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: payload, signal: ctrl.signal });
  } catch (e) {
    clearTimeout(timer);
    if (signal?.aborted) throw new ApiError(0, 'ABORTED', 'Request cancelled');
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    window.dispatchEvent(new CustomEvent('ks:network', { detail: { offline } }));
    throw new ApiError(0, offline ? 'OFFLINE' : 'NETWORK', offline ? 'You’re offline. Check your connection and retry.' : 'Cannot reach the server. It may be starting up; retry in a few seconds.');
  }
  clearTimeout(timer);
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const e = data?.error || {};
    if (res.status === 401 && (e.code === 'SESSION_EXPIRED' || e.code === 'UNAUTHENTICATED') && t) window.dispatchEvent(new CustomEvent('ks:expired'));
    if (res.status === 429) window.dispatchEvent(new CustomEvent('ks:ratelimit', { detail: e }));
    throw new ApiError(res.status, e.code || 'HTTP_' + res.status, e.message || `Request failed (${res.status})`, e.field, { issues: e.issues, report: data?.report });
  }
  return data;
}

// Map API errors to per-field messages for forms
export function fieldErrors(err) {
  const out = {};
  if (!err) return out;
  if (err.issues) for (const i of err.issues) out[i.field] = out[i.field] || i.message;
  if (err.field) out[err.field] = err.message;
  return out;
}
