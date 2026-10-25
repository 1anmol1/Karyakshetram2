import { useNavigate } from 'react-router-dom';
import { inr, km } from '../lib/format.js';
import { Icon, Tier, RangeBar, Photo } from './ui.jsx';

export function PickCard({ p, i, selected, compared, onCompare, onClick }) {
  if (p.empty) return (
    <div className="pick empty"><div className="row sb"><span className="tag acc"><Icon n={p.icon} s={12} />{p.label}</span><span className="s12 muted">{i + 1}</span></div>
      <div className="s13 muted" style={{ lineHeight: 1.5 }}>{p.reason}</div><span className="s12 muted">Try relaxing max rent or minimum downside profit.</span></div>
  );
  return (
    <div className={`pick ${selected ? 'sel' : ''}`} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick?.()}>
      <div className="row sb"><span className="tag acc" title={p.rule}><Icon n={p.icon} s={12} />{p.label}</span>
        <button className="row g4 s12 muted" onClick={(e) => { e.stopPropagation(); onCompare?.(); }} aria-pressed={compared} title="Add to compare"><span className={`check ${compared ? 'on' : ''}`} style={{ width: 16, height: 16 }}>{compared && <Icon n="check-line" s={11} />}</span>{i + 1}</button></div>
      <div className="b s14" style={{ lineHeight: 1.3, minHeight: 36 }}>H{i + 1} in {p.locality}<div className="s12 muted" style={{ fontWeight: 400 }}>rent ₹{p.rent}/sq ft · {p.confidence} confidence</div></div>
      <div className="row g8"><Tier t={p.tier} /><div className="col"><span className="s11 muted">Exp profit / yr</span><span className="price-lg num" style={{ color: 'var(--accent2)' }}>{inr(p.profit.exp)}</span></div></div>
      <div className="col g4"><div className="row sb s11 muted"><span>P10 <b className="num">{inr(p.revenue.p10)}</b></span><span>P90 <b className="num">{inr(p.revenue.p90)}</b></span></div><RangeBar {...p.revenue} /></div>
      <div className="row sb s12"><span className="muted">Stress tests</span><span className="b">{p.stress.passes} of 4 pass</span></div>
      <div className="row sb s12"><span className="muted">Cannibalisation</span><span className="b">{p.cannibalisation ? `${(p.cannibalisation.ratio * 100).toFixed(1)}%` : 'No own stores'}</span></div>
      {p.flags?.length > 0 && <div className="row g4 wrap">{p.flags.map((f) => <span key={f} className="tag warn">{f.replace(/_/g, ' ').toLowerCase()}</span>)}</div>}
    </div>
  );
}

const REL = { Competitor: 'bad', 'Your store': 'ink' };

const BUSINESS_CATEGORIES = {
  restaurant: { label: 'Restaurant', icon: 'restaurant-2-line', tone: 'warn' },
  qsr: { label: 'QSR', icon: 'restaurant-line', tone: 'warn' },
  cafe: { label: 'Cafe', icon: 'cup-line', tone: 'ink' },
  pharmacy: { label: 'Pharmacy', icon: 'capsule-line', tone: 'ok' },
  grocery: { label: 'Grocery', icon: 'shopping-basket-line', tone: 'acc' },
  supermarket: { label: 'Supermarket', icon: 'store-2-line', tone: 'acc' },
  convenience: { label: 'Convenience', icon: 'store-3-line', tone: 'ink' },
  apparel: { label: 'Apparel', icon: 't-shirt-line', tone: 'info' },
  fashion: { label: 'Fashion', icon: 't-shirt-2-line', tone: 'info' },
  bakery: { label: 'Bakery', icon: 'cake-3-line', tone: 'warn' },
  gym: { label: 'Fitness / Gym', icon: 'run-line', tone: 'ok' },
  salon: { label: 'Salon', icon: 'scissors-cut-line', tone: 'info' },
  electronics: { label: 'Electronics', icon: 'tv-2-line', tone: 'ink' },
  mobile: { label: 'Mobile Retail', icon: 'smartphone-line', tone: 'ink' },
  jewellery: { label: 'Jewellery', icon: 'vip-diamond-line', tone: 'warn' },
  diagnostics: { label: 'Diagnostics', icon: 'microscope-line', tone: 'ok' },
  bookstore: { label: 'Bookstore', icon: 'book-open-line', tone: 'info' },
  mall: { label: 'Mall', icon: 'building-4-line', tone: 'ink' },
  bank: { label: 'Bank', icon: 'bank-line', tone: 'ink' },
};

function resolveCategoryTag(catKey, catInfo) {
  const k = (catKey || '').toLowerCase();
  if (BUSINESS_CATEGORIES[k]) return BUSINESS_CATEGORIES[k];
  if (catInfo) {
    const clean = catInfo.name?.split(' &')[0] || catInfo.name;
    return { label: clean, icon: catInfo.icon || 'store-2-line', tone: 'acc' };
  }
  const label = catKey ? catKey.charAt(0).toUpperCase() + catKey.slice(1) : 'Business';
  return { label, icon: 'store-2-line', tone: 'acc' };
}

export function ShopCard({ s, i, square, catInfo, saved, onSave, onClick }) {
  const nav = useNavigate();
  const cat = resolveCategoryTag(s.category, catInfo);
  return (
    <div
      className={`shop ${square ? 'sq' : ''}`}
      onClick={() => (onClick ? onClick(s) : s.cell && nav(`/location/${s.cell}`))}
      role="button"
      tabIndex={0}
      style={{ cursor: 'pointer' }}
    >
      <div className="ph"><Photo category={s.category} seed={i + 3} h={square ? 150 : 120} />
        <button className={`save ${saved ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); onSave?.(s); }} aria-label={saved ? 'Saved' : 'Save location'}><Icon n={saved ? 'bookmark-fill' : 'bookmark-line'} s={14} c={saved ? 'var(--accent)' : undefined} />{saved ? 'Saved' : 'Save'}</button>
      </div>
      <div className="pad12 col g6">
        <div className="row sb ac"><span className="b s14 ellipsis" title={s.name}>{s.name}</span><Icon n="eye-line" s={16} c="var(--muted)" /></div>
        <div className="row g6 wrap ac s12">
          <span className={`tag ${cat.tone}`} title={`Category: ${cat.label}`}>
            <Icon n={cat.icon} s={12} />{cat.label}
          </span>
          {s.relation && s.relation !== 'Anchor' && (
            <span className={`tag ${REL[s.relation] || ''}`}>{s.relation}</span>
          )}
          <span className="muted" style={{ marginLeft: 'auto' }}>{km(s.distKm)}</span>
        </div>
      </div>
    </div>
  );
}

export function SimilarRow({ s, i, onOpen, children }) {
  const expProfit = s.profit?.exp ?? s.profit?.p50 ?? 0;
  const hLabel = s.hTag || (typeof i === 'number' ? `H${i + 1}` : null);
  const rawLoc = (s.locality || 'Location').replace(/^H\d+\s+in\s+/i, '');
  const title = hLabel ? `${hLabel} in ${rawLoc}` : rawLoc;
  return (
    <div className="row g12 as" style={{ cursor: 'pointer' }} onClick={onOpen} role="link" tabIndex={0}>
      <div style={{ width: 168, height: 96, borderRadius: 12, overflow: 'hidden', flex: 'none', position: 'relative' }}>
        {children}
        <span className="tag" style={{ position: 'absolute', right: 6, bottom: 6, background: 'var(--bg)', zIndex: 600 }}>{km(s.distKm)}</span>
      </div>
      <div className="col g4 f1">
        <span className="b s14" style={{ lineHeight: 1.3, color: 'var(--text)' }}>{title}</span>
        <span className="s12 muted">
          Exp profit <b className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{inr(expProfit)}</b>/yr · rent <b className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>₹{s.rent}</b>/sq ft
        </span>
        <span className="row g6 ac">
          <Tier t={s.tier} />
          <span className="s12 muted">{s.tier === 'A' ? 'Stays profitable at P10' : s.tier === 'B' ? 'Profitable on average' : 'Loss-making on average'}</span>
        </span>
      </div>
    </div>
  );
}
