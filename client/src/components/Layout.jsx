import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp, useAuth, useToast } from '../lib/state.jsx';
import { api } from '../lib/api.js';
import { initials, ROLE_LABEL } from '../lib/format.js';
import { Icon, ThemeToggle, Banner } from './ui.jsx';
import ChatWidget from './Chat.jsx';

function useOutside(ref, cb) {
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [ref, cb]);
}

function CategoryPicker() {
  const { categories, category, catInfo, setCategory } = useApp();
  const [open, setOpen] = useState(false), [q, setQ] = useState('');
  const ref = useRef(null); useOutside(ref, () => setOpen(false));
  const list = categories.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  const showAll = !q || 'all sections'.includes(q.toLowerCase()) || 'all categories'.includes(q.toLowerCase());
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="loc" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        <Icon n={catInfo?.icon || 'apps-2-line'} s={16} c="var(--accent)" /><span className="hide-sm">{catInfo?.name || 'All Sections'}</span>
      </button>
      {open && <div className="popover" style={{ left: 0, width: 300 }} role="listbox">
        <div className="input" style={{ height: 38, marginBottom: 6 }}><Icon n="search-line" s={16} c="var(--muted)" /><input autoFocus placeholder="Search 30+ categories" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {showAll && (
          <button className={category === 'all' ? 'on' : ''} onClick={() => { setCategory('all'); setOpen(false); }}>
            <Icon n="apps-2-line" s={16} c="var(--accent)" />
            All Sections
            <span className="tag ok" style={{ marginLeft: 'auto' }}>All</span>
          </button>
        )}
        {list.map((c) => <button key={c.key} className={c.key === category ? 'on' : ''} onClick={() => { setCategory(c.key); setOpen(false); }}><Icon n={c.icon} s={16} c="var(--accent)" />{c.name}{c.p0 && <span className="tag ok" style={{ marginLeft: 'auto' }}>P0</span>}</button>)}
        {!list.length && !showAll && <div className="s13 muted pad12">No category matches “{q}”</div>}
      </div>}
    </div>
  );
}

function LocalityPicker() {
  const { locality, setLocality, category, setPicks } = useApp();
  const [open, setOpen] = useState(false), [list, setList] = useState([]), [q, setQ] = useState('');
  const ref = useRef(null); useOutside(ref, () => setOpen(false));
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => { if (open && !list.length) api('/localities').then((r) => setList(r.localities)).catch(() => {}); }, [open, list.length]);
  const f = list.filter((l) => l.name.toLowerCase().includes(q.toLowerCase()));

  const handleSelectLocality = async (l) => {
    setLocality(l);
    setOpen(false);
    if (loc.pathname.startsWith('/location')) {
      try {
        const body = { category: category || 'all', k: 8 };
        if (l?.lat && l?.lon) { body.lat = l.lat; body.lon = l.lon; }
        const r = await api('/recommend', { method: 'POST', body });
        if (r.picks?.length > 0) {
          setPicks(r.picks);
          nav(`/location/${r.picks[0].cell}?h=1`);
        }
      } catch {}
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="loc" onClick={() => setOpen(!open)} aria-label="Change location"><Icon n="map-pin-line" s={16} c="var(--accent2)" /><span className="hide-sm">Pune · {locality?.name || 'All city'}</span></button>
      {open && <div className="popover" style={{ right: 0, width: 280 }}>
        <div className="input" style={{ height: 38, marginBottom: 6 }}><Icon n="search-line" s={16} c="var(--muted)" /><input autoFocus placeholder="Search a locality" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button onClick={() => handleSelectLocality(null)} className={!locality ? 'on' : ''}><Icon n="map-2-line" s={16} />Whole city (Pune &amp; PCMC)</button>
        {f.map((l) => <button key={l.name} className={locality?.name === l.name ? 'on' : ''} onClick={() => handleSelectLocality(l)}><Icon n="map-pin-line" s={16} c="var(--muted)" />{l.name}</button>)}
      </div>}
    </div>
  );
}

const NAV = [
  ['/app', 'dashboard-line', 'Dashboard'],
  ['/business', 'building-2-line', 'Business'],
  ['/app?find=1', 'search-eye-line', 'Find locations'],
  ['/check', 'crosshair-2-line', 'Check a location'],
  ['/compare', 'scales-3-line', 'Compare sites'],
  ['/cannibalisation', 'git-merge-line', 'Cannibalisation'],
  ['/portfolio', 'node-tree', 'Portfolio planner'],
  ['/saved', 'bookmark-line', 'Saved'],
  ['/trust', 'shield-check-line', 'Trust Center'],
  ['/profile', 'user-line', 'Profile'],
];

function Drawer({ onClose }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (<>
    <div className="overlay" onClick={onClose} />
    <nav className="drawer" aria-label="Main menu">
      <div className="row sb" style={{ marginBottom: 12 }}>
        <div className="row g10"><div className="avatar">{initials(user?.name)}</div><div className="col"><span className="b s13">{user?.name}</span><span className="s11 muted">{user?.profile?.businessName || '—'} · {ROLE_LABEL[user?.profile?.role] || ''}</span></div></div>
        <button className="iconbtn" onClick={onClose} aria-label="Close menu"><Icon n="close-line" /></button>
      </div>
      {NAV.map(([to, ic, t]) => <NavLink key={t} to={to} onClick={onClose} className={() => `navitem ${loc.pathname + loc.search === to || (to === '/app' && loc.pathname === '/app' && !loc.search) ? 'on' : ''}`}><Icon n={ic} s={18} />{t}</NavLink>)}
      <div className="divider" style={{ margin: '10px 0' }} />
      <NavLink to="/business" onClick={onClose} className="navitem"><Icon n="building-2-line" s={18} />Business &amp; stores</NavLink>
      <Link to="/guide" className="navitem" onClick={onClose}><Icon n="question-line" s={18} />Help &amp; guide</Link>
      <button className="navitem" style={{ color: 'var(--bad)' }} onClick={() => { logout(); onClose(); nav('/login'); }}><Icon n="logout-box-r-line" s={18} />Sign out</button>
    </nav>
  </>);
}

export function Header({ back, showCategory = true, crumb }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  return (<>
    <header className="hdr">
      <div className="hleft" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {back ? (
            <button className="iconbtn" onClick={() => (window.history.length > 2 ? nav(-1) : nav('/app'))} aria-label="Back">
              <Icon n="arrow-left-line" />
            </button>
          ) : null}
        </div>
        {showCategory && user && <CategoryPicker />}
        {crumb && <span className="s13 muted hide-sm">{crumb}</span>}
      </div>
      <Link to={user ? '/app' : '/'} className="logo" aria-label="Karyakshetram home">Karyakshetram<i>.</i></Link>
      <div className="hright">
        {user && <LocalityPicker />}
        <span className="hide-sm"><ThemeToggle /></span>
        {user ? <>
          <Link to="/profile" className="avatar" title="Profile">{initials(user.name)}</Link>
          <button className="iconbtn sq header-menu-btn" onClick={() => setMenu(true)} aria-label="Open menu"><Icon n="menu-line" /></button>
        </> : <><Link className="btn out sm" to="/login">Sign in</Link><Link className="btn ink sm" to="/signup">Get started</Link></>}
      </div>
    </header>
    {menu && <Drawer onClose={() => setMenu(false)} />}
  </>);
}

export function Footer() {
  const { health } = useApp();
  return <footer className="footer"><span>Karyakshetram · decision support for site visits, not a replacement for them</span>
    <span className="row g16 wrap"><span>Map data © OpenStreetMap contributors (ODbL)</span><span>Population © WorldPop (CC BY 4.0)</span><span>Model {health?.modelVersion || '—'}</span><Link to="/trust" className="b" style={{ color: 'var(--text)' }}>Trust Center</Link></span></footer>;
}

export function SystemBanners() {
  const { health } = useApp();
  const toast = useToast();
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    const rl = (e) => toast(e.detail?.message || 'Too many requests. Try again shortly.', { tone: 'warn', icon: 'timer-line' });
    window.addEventListener('online', on); window.addEventListener('offline', off); window.addEventListener('ks:ratelimit', rl);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('ks:ratelimit', rl); };
  }, [toast]);
  return (<div className="wrapx col g8" style={{ paddingTop: offline || health.state === 'warming' || health.state === 'down' ? 12 : 0 }}>
    {offline && <Banner tone="bad" icon="wifi-off-line">You’re offline. Saved locations stay available; results refresh when you reconnect.</Banner>}
    {health.state === 'warming' && <Banner tone="warn" icon="time-line">Warming up the service, about 60 s. Results appear as soon as it’s ready.</Banner>}
    {health.state === 'down' && <Banner tone="bad" icon="cloud-off-line" action={<button className="btn out sm" onClick={() => window.location.reload()}>Retry</button>}>The API is not reachable right now. Check that the server is running.</Banner>}
    {health.ml?.remote?.ok === false && <Banner tone="warn" icon="cpu-line">ML service unavailable; showing results from the built-in placeholder engine.</Banner>}
  </div>);
}

// App shell for signed-in pages: header (optional per page), banners, chat, SPA links from map popups
export function AppShell() {
  const nav = useNavigate();
  const { expired, setExpired } = useAuth();
  const loc = useLocation();
  useEffect(() => {
    const h = (e) => {
      const a = e.target.closest?.('a[data-cell]');
      if (a) {
        e.preventDefault();
        const hVal = a.dataset.h ? `?h=${a.dataset.h}` : '';
        nav(`/location/${a.dataset.cell}${hVal}`);
      }
    };
    document.addEventListener('click', h); return () => document.removeEventListener('click', h);
  }, [nav]);
  useEffect(() => { if (expired) { setExpired(false); nav(`/login?expired=1&next=${encodeURIComponent(loc.pathname + loc.search)}`); } }, [expired]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return (<><Outlet /><ChatWidget /></>);
}
