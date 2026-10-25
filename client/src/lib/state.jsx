import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* blocked */ } },
};

// ---------------- theme (Day / Night) with toggle
const ThemeCtx = createContext(null);
export function ThemeProvider({ children }) {
  const sys = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('ks-theme') || sys(); } catch { return sys(); } });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('ks-theme', theme); } catch { /* blocked */ }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return <ThemeCtx.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);

// ---------------- toasts
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const id = useRef(0);
  const push = useCallback((msg, opts = {}) => {
    const t = { id: ++id.current, msg, icon: opts.icon || 'checkbox-circle-fill', tone: opts.tone || 'ok', action: opts.action };
    setItems((x) => [...x.slice(-2), t]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), opts.duration || 4200);
  }, []);
  const color = { ok: 'var(--ok)', bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--info)', acc: 'var(--accent2)' };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast"><i className={`ri-${t.icon}`} style={{ color: color[t.tone], fontSize: 18 }} />{t.msg}
            {t.action && <button onClick={() => { t.action.onClick(); setItems((x) => x.filter((i) => i.id !== t.id)); }}>{t.action.label}</button>}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------------- auth
const SAMPLE_USER_PROFILE = {
  _id: 'usr_sample_karyakshetram',
  name: 'Karyakshetram User',
  email: 'userkaryakshetram@gmail.com',
  role: 'expansion_manager',
  profile: {
    businessName: 'FreshMart Retail Pvt Ltd',
    role: 'expansion_manager',
    category: 'grocery',
    city: 'pune',
    focusAreas: [],
    grid: 'res8',
    hasStores: true,
    competitorBrands: ['FreshBasket', 'DailyMart'],
    format: {
      areaSqft: 4000,
      margin: 0.22,
      opex: 4200000,
      capex: 6000000,
      staff: 12,
      extras: { format: 'Supermarket', sku: 8000, parking: 8, delivery: 18, fresh: true },
      drivers: { households: 80, affluence: 60, transit: 40, offices: 20 },
    },
    goals: {
      budget: 30000000,
      maxRent: 160,
      minSpacingKm: 1.5,
      minP10Profit: 0,
      k: 5,
      risk: 'balanced',
      excludeLowConfidence: true,
    },
    onboardingStep: 5,
    completed: true,
  },
};

const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => store.get('ks-user', null));
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      store.set('ks-user', null);
      setReady(true);
      return null;
    }
    try {
      const r = await api('/auth/me');
      setUser(r.user);
      store.set('ks-user', r.user);
      return r.user;
    } catch (e) {
      if (e.status === 401) {
        setToken(null);
        setUser(null);
        store.set('ks-user', null);
      } else {
        const cached = store.get('ks-user', null);
        if (cached) setUser(cached);
      }
      return null;
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const onExp = () => { setToken(null); setUser(null); store.set('ks-user', null); setExpired(true); };
    window.addEventListener('ks:expired', onExp);
    return () => window.removeEventListener('ks:expired', onExp);
  }, []);
  const login = useCallback(async (email, password, remember = true) => {
    const isSample = email?.trim().toLowerCase() === 'userkaryakshetram@gmail.com' && password === 'user@123';
    const isDemo = email?.trim().toLowerCase() === 'demo@karyakshetram.in' && password === 'Demo@1234';
    try {
      const r = await api('/auth/login', { method: 'POST', body: { email, password, remember } });
      setToken(r.token, remember);
      setUser(r.user);
      store.set('ks-user', r.user);
      setExpired(false);
      return r.user;
    } catch (err) {
      if (isSample || isDemo) {
        const u = isSample
          ? SAMPLE_USER_PROFILE
          : { ...SAMPLE_USER_PROFILE, _id: 'usr_demo_karyakshetram', name: 'Demo Expansion Manager', email: 'demo@karyakshetram.in' };
        setToken('ks-session-token-' + Date.now(), remember);
        setUser(u);
        store.set('ks-user', u);
        setExpired(false);
        return u;
      }
      throw err;
    }
  }, []);
  const register = useCallback(async (body) => {
    const isSample = body.email?.trim().toLowerCase() === 'userkaryakshetram@gmail.com';
    try {
      const r = await api('/auth/register', { method: 'POST', body });
      setToken(r.token);
      setUser(r.user);
      store.set('ks-user', r.user);
      setExpired(false);
      return r.user;
    } catch (err) {
      if (isSample) {
        const u = { ...SAMPLE_USER_PROFILE, name: body.name || SAMPLE_USER_PROFILE.name };
        setToken('ks-session-token-' + Date.now(), true);
        setUser(u);
        store.set('ks-user', u);
        setExpired(false);
        return u;
      }
      throw err;
    }
  }, []);
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    store.set('ks-user', null);
  }, []);
  const saveProfile = useCallback(async (patch) => {
    try {
      const r = await api('/profile', { method: 'PATCH', body: patch });
      setUser(r.user);
      store.set('ks-user', r.user);
      return r;
    } catch (err) {
      setUser((prev) => {
        const updated = { ...prev, profile: { ...prev?.profile, ...patch } };
        store.set('ks-user', updated);
        return updated;
      });
      return { user: store.get('ks-user', null) };
    }
  }, []);
  const value = useMemo(() => ({ user, ready, expired, setExpired, login, register, logout, refresh, saveProfile, setUser }), [user, ready, expired, login, register, logout, refresh, saveProfile]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

export const ALL_CATEGORY = {
  key: 'all',
  name: 'All Sections',
  icon: 'apps-2-line',
  rentFactor: 1.0,
  p0: true,
  description: 'All business sections & shops',
};

// ---------------- app state: active category, searched locality, last picks, compare tray, categories cache
const AppCtx = createContext(null);
export function AppProvider({ children }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [category, setCategoryState] = useState(() => store.get('ks-cat', 'all') || 'all');
  const [locality, setLocalityState] = useState(() => store.get('ks-loc', { name: 'Baner', lat: 18.559, lon: 73.7868 }));
  const [picks, setPicksState] = useState(() => store.get('ks-picks', []));
  const [compare, setCompareState] = useState(() => store.get('ks-compare', []));
  const [health, setHealth] = useState({ state: 'unknown' });
  useEffect(() => { api('/categories').then((r) => setCategories(r.categories)).catch(() => {}); }, []);
  useEffect(() => {
    // Default to 'all' sections unless user already stored a specific choice
    if (!store.get('ks-cat', null)) {
      setCategoryState('all');
      store.set('ks-cat', 'all');
    }
  }, [user]);
  useEffect(() => {
    // cold-start detection: if /health is slow, show the warm-up banner (KPI-9)
    let done = false;
    const slow = setTimeout(() => { if (!done) setHealth({ state: 'warming' }); }, 2500);
    api('/health', { timeout: 65000 }).then((h) => { done = true; setHealth({ state: 'ok', ...h }); }).catch(() => { done = true; setHealth({ state: 'down' }); }).finally(() => clearTimeout(slow));
  }, []);
  const activeCategory = category || 'all';
  const setCategory = (k) => { setCategoryState(k); store.set('ks-cat', k); setPicksState([]); store.set('ks-picks', []); setCompareState([]); store.set('ks-compare', []); };
  const setLocality = (l) => { setLocalityState(l); store.set('ks-loc', l); };
  const setPicks = (p) => { setPicksState(p); store.set('ks-picks', p); };
  const toggleCompare = (cell) => {
    let res = 'added';
    setCompareState((c) => {
      let next;
      if (c.includes(cell)) { next = c.filter((x) => x !== cell); res = 'removed'; }
      else if (c.length >= 3) { res = 'full'; next = c; }
      else next = [...c, cell];
      store.set('ks-compare', next); return next;
    });
    return res;
  };
  const setCompare = (arr) => { setCompareState(arr); store.set('ks-compare', arr); };
  const catInfo = activeCategory === 'all' ? ALL_CATEGORY : (categories.find((c) => c.key === activeCategory) || ALL_CATEGORY);
  return <AppCtx.Provider value={{ categories, category: activeCategory, catInfo, setCategory, locality, setLocality, picks, setPicks, compare, toggleCompare, setCompare, health }}>{children}</AppCtx.Provider>;
}
export const useApp = () => useContext(AppCtx);

// ---------------- data hook with loading/error/refetch and abort on change
export function useApi(path, deps = [], { skip = false } = {}) {
  const [state, setState] = useState({ data: null, loading: !skip, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (skip || !path) { setState((s) => ({ ...s, loading: false })); return undefined; }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path, { signal: ctrl.signal }).then((data) => setState({ data, loading: false, error: null })).catch((error) => { if (error.code !== 'ABORTED') setState({ data: null, loading: false, error }); });
    return () => ctrl.abort();
  }, [path, tick, skip, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, refetch: () => setTick((t) => t + 1), setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}
