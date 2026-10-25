import { useEffect, useState } from 'react';
import { useTheme } from '../lib/state.jsx';

export const Icon = ({ n, s, c, className = '', style }) => <i className={`ri-${n} ${className}`} style={{ fontSize: s, color: c, ...style }} aria-hidden="true" />;

export function ThemeToggle({ small }) {
  const { theme, toggle } = useTheme();
  const on = theme === 'dark';
  return (
    <button className="themewrap" onClick={toggle} aria-label={`Switch to ${on ? 'day' : 'night'} theme`} title={on ? 'Night theme' : 'Day theme'}>
      <span className={`tgl ${small ? 'sm' : ''} ${on ? 'on' : ''}`} />
    </button>
  );
}

export const Tier = ({ t }) => <span className={`tier ${t}`} title={{ A: 'Tier A: profitable even at P10', B: 'Tier B: profitable on average', C: 'Tier C: not expected to cover costs' }[t]}>{t}</span>;
export function Conf({ c }) {
  const m = { High: ['ok', 'signal-wifi-3-line'], Medium: ['warn', 'signal-wifi-2-line'], Low: ['bad', 'signal-wifi-1-line'] }[c] || ['', 'signal-wifi-line'];
  return <span className={`tag ${m[0]}`}><Icon n={m[1]} s={12} />{c} confidence</span>;
}
export const Sim = () => null;

export function RangeBar({ p10, p50, p90, min, max }) {
  const lo = min ?? p10 * 0.85, hi = max ?? p90 * 1.08, span = hi - lo || 1;
  const pos = (v) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));
  return <div className="range"><b style={{ left: `${pos(p10)}%`, right: `${100 - pos(p90)}%` }} /><i style={{ left: `calc(${pos(p50)}% - 1px)` }} /></div>;
}

export function Collapse({ title, right, children, open: o = false, onToggle }) {
  const [open, setOpen] = useState(o);
  useEffect(() => setOpen(o), [o]);
  return (
    <div className="coll">
      <button className="coll-h" onClick={() => { setOpen(!open); onToggle?.(!open); }} aria-expanded={open}>
        <span className="row g8">{title}</span><span className="row g10">{right}<Icon n={open ? 'arrow-up-s-line' : 'arrow-down-s-line'} s={20} /></span>
      </button>
      {open && <div className="coll-b">{children}</div>}
    </div>
  );
}

export function Field({ label, value, onChange, suffix, error, help, type = 'text', icon, placeholder, sim, disabled, options, inputProps = {}, id }) {
  const fid = id || `f-${String(label).replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="field">
      {label && <label htmlFor={fid}>{label}{sim && <Sim />}</label>}
      <div className={`input ${error ? 'err' : ''} ${disabled ? 'dis' : ''}`}>
        {icon && <Icon n={icon} s={16} c="var(--muted)" />}
        {options ? (
          <select id={fid} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} disabled={disabled} {...inputProps}>
            {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        ) : (
          <input id={fid} type={type} value={value ?? ''} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange?.(e.target.value)} aria-invalid={!!error} {...inputProps} />
        )}
        {options && <Icon n="arrow-down-s-line" s={16} c="var(--muted)" />}
        {suffix && <span className="suf">{suffix}</span>}
      </div>
      {error ? <span className="help err"><Icon n="error-warning-line" s={14} />{error}</span> : help ? <span className="help">{help}</span> : null}
    </div>
  );
}

export const Seg = ({ items, value, onChange }) => (
  <div className="seg" role="tablist">{items.map((it) => <button key={it.value} role="tab" aria-selected={value === it.value} className={value === it.value ? 'on' : ''} onClick={() => onChange(it.value)}>{it.icon && <Icon n={it.icon} s={15} />}{it.label}</button>)}</div>
);
export const Tabs = ({ items, value, onChange }) => (
  <div className="tabs" role="tablist">{items.map((t) => <button key={t} role="tab" aria-selected={value === t} className={`tab ${value === t ? 'on' : ''}`} onClick={() => onChange(t)}>{t}</button>)}</div>
);
export const Banner = ({ tone = 'info', icon = 'information-line', children, action }) => <div className={`banner ${tone}`} role={tone === 'bad' ? 'alert' : undefined}><Icon n={icon} s={16} /><span className="f1">{children}</span>{action}</div>;
export const Kv = ({ k, v, sub }) => <div className="kv"><span className="k">{k}</span><span className="v num">{v}</span>{sub && <span className="s12 muted">{sub}</span>}</div>;
export const Skel = ({ h = 16, w = '100%', style }) => <div className="skel" style={{ height: h, width: w, ...style }} />;
export const Check = ({ on, onClick, label }) => <button type="button" className="row g8 s13" onClick={onClick} aria-pressed={on}><span className={`check ${on ? 'on' : ''}`}>{on && <Icon n="check-line" s={12} />}</span>{label}</button>;
export const Radio = ({ on }) => <span className={`radio ${on ? 'on' : ''}`} />;

export function Modal({ open, onClose, title, children, width }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (<><div className="overlay" onClick={onClose} /><div className="modal" role="dialog" aria-modal="true" style={width ? { width } : undefined}>
    <div className="row sb" style={{ marginBottom: 16 }}><div className="h3">{title}</div><button className="iconbtn" onClick={onClose} aria-label="Close"><Icon n="close-line" /></button></div>{children}</div></>);
}

export function EmptyState({ icon = 'inbox-line', title, text, action }) {
  return <div className="col ac g10" style={{ padding: '32px 16px', textAlign: 'center' }}><div className="iconbtn fill" style={{ width: 52, height: 52, fontSize: 24, color: 'var(--accent)' }}><Icon n={icon} /></div><div className="h4">{title}</div>{text && <p className="s13 muted" style={{ maxWidth: 440 }}>{text}</p>}{action}</div>;
}

export function ErrorBox({ error, onRetry, compact }) {
  if (!error) return null;
  const map = { OFFLINE: ['wifi-off-line', 'You’re offline'], NETWORK: ['cloud-off-line', 'Server not reachable'], RATE_LIMITED: ['timer-line', 'Too many requests'], NOT_FOUND: ['map-pin-2-line', 'Not found'] };
  const [ic, t] = map[error.code] || ['error-warning-line', 'Something went wrong'];
  if (compact) return <Banner tone="bad" icon={ic} action={onRetry && <button className="btn out sm" onClick={onRetry}><Icon n="refresh-line" />Retry</button>}>{error.message}</Banner>;
  return <EmptyState icon={ic} title={t} text={error.message} action={onRetry && <button className="btn out sm" onClick={onRetry}><Icon n="refresh-line" />Retry</button>} />;
}

export function AiStreamingText({ text, speed = 14, onComplete }) {
  const seenKey = text ? `ai_streamed_${text.slice(0, 36).replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const initialSeen = Boolean(seenKey && (() => {
    try { return !!sessionStorage.getItem(seenKey); } catch { return false; }
  })());

  const [displayedLength, setDisplayedLength] = useState(() => (initialSeen && text ? text.length : 0));
  const [isTyping, setIsTyping] = useState(() => !initialSeen);

  useEffect(() => {
    if (!text) {
      setDisplayedLength(0);
      setIsTyping(false);
      return undefined;
    }

    const key = `ai_streamed_${text.slice(0, 36).replace(/[^a-zA-Z0-9]/g, '_')}`;
    let alreadySeen = false;
    try {
      alreadySeen = !!sessionStorage.getItem(key);
    } catch {}

    if (alreadySeen) {
      setDisplayedLength(text.length);
      setIsTyping(false);
      return undefined;
    }

    setDisplayedLength(0);
    setIsTyping(true);

    let current = 0;
    const interval = setInterval(() => {
      const step = Math.min(3, text.length - current);
      current += step;
      setDisplayedLength(current);
      if (current >= text.length) {
        clearInterval(interval);
        setIsTyping(false);
        try { sessionStorage.setItem(key, '1'); } catch {}
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  const displayed = text ? text.slice(0, displayedLength) : '';

  return (
    <div className="s14" style={{ lineHeight: 1.65, color: 'var(--text)' }}>
      <span>{displayed}</span>
      {isTyping && (
        <span
          className="ai-cursor"
          style={{
            display: 'inline-block',
            width: 7,
            height: 15,
            marginLeft: 4,
            verticalAlign: 'text-bottom',
            background: 'var(--accent2)',
            borderRadius: 2,
            animation: 'aiBlink 0.7s infinite alternate',
          }}
        />
      )}
    </div>
  );
}

const RETAIL_PHOTOS = {
  cafe: [
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=600&q=80',
  ],
  restaurant: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
  ],
  qsr: [
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=600&q=80',
  ],
  grocery: [
    'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&w=600&q=80',
  ],
  supermarket: [
    'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80',
  ],
  convenience: [
    'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80',
  ],
  pharmacy: [
    'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=600&q=80',
  ],
  fashion: [
    'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80',
  ],
  apparel: [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=600&q=80',
  ],
  bakery: [
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
  ],
  gym: [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80',
  ],
  electronics: [
    'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=600&q=80',
  ],
  mobile: [
    'https://images.unsplash.com/photo-1511707171634-5f897ff02560?auto=format&fit=crop&w=600&q=80',
  ],
  default: [
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&w=600&q=80',
  ],
};

export function Photo({ category, seed = 1, h = 120, caption }) {
  const [failed, setFailed] = useState(false);
  const cat = (category || '').toLowerCase();
  const list = RETAIL_PHOTOS[cat] || RETAIL_PHOTOS.default;
  const imgUrl = list[Math.abs(seed) % list.length];

  if (!failed && imgUrl) {
    return (
      <div style={{ width: '100%', height: h, position: 'relative', overflow: 'hidden', background: 'var(--surface2)' }}>
        <img
          src={imgUrl}
          alt={caption || 'Storefront'}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />
        {caption && (
          <span style={{ position: 'absolute', left: 10, top: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, fontWeight: 700 }}>
            {caption}
          </span>
        )}
      </div>
    );
  }

  let s = (seed * 9301 + 49297) % 233280; const R = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const W = 320, blds = []; let x = 0;
  while (x < W) {
    const bw = 30 + R() * 70, bh = h * (0.35 + R() * 0.5), op = 0.35 + R() * 0.45;
    const wins = [];
    for (let wy = h - bh + 10; wy < h - 24; wy += 16) for (let wx = x + 8; wx < x + bw - 10; wx += 14) wins.push(<rect key={`${wx}-${wy}`} x={wx} y={wy} width="6" height="8" style={{ fill: 'var(--bg)' }} fillOpacity=".55" />);
    blds.push(<g key={x}><rect x={x} y={h - bh} width={bw} height={bh} style={{ fill: 'var(--muted)' }} fillOpacity={op} />{wins}</g>);
    x += bw + 2;
  }
  return (
    <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ display: 'block' }} role="img" aria-label="Site illustration">
      <rect width={W} height={h} style={{ fill: 'var(--surface2)' }} />{blds}
      <rect y={h - 18} width={W} height="18" style={{ fill: 'var(--muted)' }} fillOpacity=".5" />
      <rect x={W * 0.12} y={h * 0.58} width={W * 0.3} height={h * 0.24} style={{ fill: 'var(--accent)' }} fillOpacity=".85" />
      {caption && <g><rect x="10" y="10" width={caption.length * 6.4 + 16} height="20" rx="10" fill="#000" fillOpacity=".55" /><text x="18" y="24" fontFamily="Arial" fontSize="11" fill="#fff">{caption}</text></g>}
    </svg>
  );
}

export function AbstractArtBackground({ variant = 'default', showHex = true }) {
  return (
    <div className={`abstract-art-bg variant-${variant}`} aria-hidden="true">
      <div className="art-gradient-orb orb-1" />
      <div className="art-gradient-orb orb-2" />
      <div className="art-gradient-orb orb-3" />
      <div className="art-dot-grid" />
      <svg className="art-svg-layer" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="artGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
            <stop offset="50%" stopColor="var(--accent2)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--line)" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="artGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--accent2)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--line)" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {showHex && (
          <g className="art-hex-cluster" stroke="url(#artGrad1)" strokeWidth="1.2">
            {/* Primary H3 Hexagon Motif */}
            <path d="M720 180 L790 220 L790 300 L720 340 L650 300 L650 220 Z" strokeDasharray="4 4" fill="var(--accentSoft)" fillOpacity="0.15" />
            <path d="M720 100 L860 180 L860 340 L720 420 L580 340 L580 180 Z" strokeWidth="0.8" strokeDasharray="8 6" opacity="0.4" />
            
            {/* Secondary Ambient Hexagons */}
            <path d="M1180 380 L1240 415 L1240 485 L1180 520 L1120 485 L1120 415 Z" stroke="url(#artGrad2)" strokeWidth="1" strokeDasharray="5 4" opacity="0.6" />
            <path d="M260 520 L320 555 L320 625 L260 660 L200 625 L200 555 Z" stroke="url(#artGrad2)" strokeWidth="1" strokeDasharray="6 4" opacity="0.6" />
          </g>
        )}

        {/* Concentric Geometric Orbitals */}
        <circle cx="720" cy="260" r="180" stroke="url(#artGrad1)" strokeWidth="0.75" strokeDasharray="3 7" opacity="0.45" />
        <circle cx="720" cy="260" r="320" stroke="url(#artGrad1)" strokeWidth="0.6" opacity="0.3" />
        <circle cx="720" cy="260" r="480" stroke="url(#artGrad2)" strokeWidth="0.5" strokeDasharray="10 10" opacity="0.2" />

        {/* Dynamic Curvilinear Topographic Waves */}
        <path d="M-80 320 C280 160, 560 480, 980 290 C1220 180, 1420 360, 1560 410" stroke="url(#artGrad1)" strokeWidth="1" opacity="0.35" />
        <path d="M-80 370 C300 210, 580 530, 1000 340 C1240 230, 1440 410, 1560 460" stroke="url(#artGrad2)" strokeWidth="0.8" opacity="0.25" />

        {/* Architectural Crosshair Grid Markers */}
        <g stroke="var(--line)" strokeWidth="1.2" opacity="0.7">
          <path d="M160 120 v14 M153 127 h14" />
          <path d="M1280 140 v14 M1273 147 h14" />
          <path d="M180 740 v14 M173 747 h14" />
          <path d="M1300 720 v14 M1293 727 h14" />
          <path d="M720 50 v14 M713 57 h14" />
        </g>
      </svg>
    </div>
  );
}
