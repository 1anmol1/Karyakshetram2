// Indian number formatting (FR-11): ₹38 L, ₹4.1 Cr
export function inr(v, digits = 1) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const neg = v < 0, a = Math.abs(v);
  let s;
  if (a >= 1e7) s = `₹${(a / 1e7).toFixed(digits)} Cr`;
  else if (a >= 1e5) s = `₹${(a / 1e5).toFixed(digits)} L`;
  else s = `₹${Math.round(a).toLocaleString('en-IN')}`;
  return (neg ? '−' : '') + s;
}
export const inrPlain = (v) => (v == null ? '' : Math.round(v).toLocaleString('en-IN'));
export const pct = (v, d = 1) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`);
export const km = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(1)} km`);
export const n = (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-IN'));
export const signed = (v) => (v > 0 ? '+' : '') + inr(v);
export const parseNum = (s) => { if (s === '' || s == null) return null; const x = Number(String(s).replace(/[,₹\s]/g, '')); return Number.isFinite(x) ? x : NaN; };
export const shortCell = (id) => (id ? id.slice(-7, -3).toUpperCase() : '');
export const siteTitle = (s) => (s ? (s.locality || 'Location') : '');
export const ROLE_LABEL = { expansion_manager: 'Expansion manager', finance_analyst: 'Finance / real-estate analyst', regional_head: 'Regional head (approver)', independent_owner: 'Independent owner' };
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'K';

export function cleanAiText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\(?\bCell\s+8[0-9a-f]{14}\b\)?/gi, '')
    .replace(/\(Cell\s*8[0-9a-f]{14}\)/gi, '')
    .replace(/\b8[0-9a-f]{14}\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
