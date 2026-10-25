// Small in-process cache for rank results, keyed by (model version, parameter hash) as in FR-14.
const store = new Map();
const TTL = 10 * 60 * 1000;
export function getCache(key) { const v = store.get(key); if (!v) return null; if (Date.now() - v.at > TTL) { store.delete(key); return null; } return v.value; }
export function setCache(key, value) { if (store.size > 500) store.delete(store.keys().next().value); store.set(key, { at: Date.now(), value }); }
export function clearUserCaches(userId) { for (const k of store.keys()) if (k.includes(userId)) store.delete(k); }
export function clearCategory(cat) { for (const k of store.keys()) if (k.includes(`:${cat}:`)) store.delete(k); }
export function clearAll() { store.clear(); }
