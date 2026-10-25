import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi, useApp, useToast } from '../lib/state.jsx';
import { inr, downloadCsv } from '../lib/format.js';
import { Header, Footer, SystemBanners } from '../components/Layout.jsx';
import { Icon, Tier, EmptyState, Skel, ErrorBox } from '../components/ui.jsx';

export default function Saved() {
  const s = useApi('/saved');
  const { categories, compare, toggleCompare, setCategory, category } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const groups = useMemo(() => { const g = {}; for (const x of s.data?.saved || []) (g[x.list] = g[x.list] || []).push(x); return g; }, [s.data]);
  const remove = async (item) => {
    await api(`/saved/${item._id}`, { method: 'DELETE' });
    s.setData((d) => ({ ...d, saved: d.saved.filter((x) => x._id !== item._id) }));
    toast(`Removed ${item.name}`, { icon: 'bookmark-line', tone: 'info', action: { label: 'Undo', onClick: async () => { await api('/saved', { method: 'POST', body: { cellId: item.cell, category: item.category, name: item.name, list: item.list } }); s.refetch(); } } });
  };
  const open = (x) => { if (x.category !== category) setCategory(x.category); nav(`/location/${x.cell}`); };

  const handleCompareClick = (cell, name) => {
    if (compare.includes(cell)) {
      setCompare(compare.filter((c) => c !== cell));
      toast(`Removed ${name} from comparison`, { tone: 'info', icon: 'delete-bin-line' });
      return;
    }
    if (compare.length === 0) {
      setCompare([cell]);
      toast(`Added ${name} to compare (1 of 3)`, { tone: 'ok', icon: 'scales-3-line' });
      return;
    }
    nav(`/compare?add=${cell}&name=${encodeURIComponent(name)}`);
  };

  return (
    <div className="page">
      <Header back />
      <SystemBanners />
      <div className="wrapx col g16" style={{ padding: '24px 28px' }}>
        <div className="row sb wrap g8"><div className="col g4"><h1 className="h2">Saved locations</h1><span className="muted s14">Your shortlist. Values are a snapshot from when you saved; open a location to rescore.</span></div>
          <div className="row g8"><span className="tag">{s.data?.saved.length ?? '…'} of {s.data?.limit ?? 50}</span><button className="btn out sm" disabled={!s.data?.saved.length} onClick={() => downloadCsv('karyakshetram_shortlist.csv', s.data.saved.map((x) => ({ name: x.name, list: x.list, category: x.category, cell: x.cell, tier: x.snapshot?.tier, expected_profit: Math.round(x.snapshot?.exp || 0), p10_profit: Math.round(x.snapshot?.p10 || 0), rent: x.snapshot?.rent, saved_at: x.createdAt })))}><Icon n="download-2-line" s={14} />Export CSV</button></div></div>
        {s.loading && <Skel h={200} style={{ borderRadius: 16 }} />}
        {s.error && <div className="card"><ErrorBox error={s.error} onRetry={s.refetch} /></div>}
        {s.data && !s.data.saved.length && <div className="card"><EmptyState icon="bookmark-line" title="Nothing saved yet" text="Hover a shop card or press Save on a location page to build your shortlist." action={<button className="btn ink sm" onClick={() => nav('/app')}>Find locations</button>} /></div>}
        {Object.entries(groups).map(([list, items]) => (
          <div key={list} className="card" style={{ overflowX: 'auto' }}>
            <div className="row sb pad16"><b>{list}</b><span className="tag">{items.length}</span></div>
            <table className="t"><thead><tr><th>Location</th><th>Category</th><th>Tier</th><th>Expected profit</th><th>Rent</th><th>Saved</th><th /></tr></thead><tbody>
              {items.map((x) => <tr key={x._id} className="click" onClick={() => open(x)}>
                <td className="b">{x.name}</td><td className="muted s12">{categories.find((c) => c.key === x.category)?.name}</td><td>{x.snapshot?.tier ? <Tier t={x.snapshot.tier} /> : '—'}</td><td className="num b">{inr(x.snapshot?.exp)}</td><td>₹{x.snapshot?.rent ?? '—'}</td><td className="muted s12">{new Date(x.createdAt).toLocaleDateString('en-IN')}</td>
                <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}><span className="row g6" style={{ justifyContent: 'flex-end' }}>
                  <button className={`btn sm ${compare.includes(x.cell) ? 'soft' : 'out'}`} onClick={() => handleCompareClick(x.cell, x.name)}><Icon n="scales-3-line" s={14} />{compare.includes(x.cell) ? 'In compare' : 'Compare'}</button>
                  <button className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => remove(x)} aria-label={`Remove ${x.name}`}><Icon n="delete-bin-line" s={15} /></button></span></td></tr>)}</tbody></table>
          </div>))}
        {compare.length >= 2 && <button className="btn ink" style={{ alignSelf: 'flex-start' }} onClick={() => nav('/compare')}><Icon n="scales-3-line" />Compare {compare.length} sites</button>}
      </div>
      <Footer />
    </div>
  );
}
