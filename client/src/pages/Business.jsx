import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fieldErrors } from '../lib/api.js';
import { useApp, useAuth, useToast } from '../lib/state.jsx';
import { inr, inrPlain, parseNum } from '../lib/format.js';
import { Header, Footer, SystemBanners } from '../components/Layout.jsx';
import { Icon, Collapse, Field, Modal, Banner, Check } from '../components/ui.jsx';

const PUNE_LOCALITY_PRESETS = [
  { name: 'FC Road / Deccan', lat: 18.5204, lon: 73.8407 },
  { name: 'Koregaon Park', lat: 18.5362, lon: 73.8940 },
  { name: 'Kalyani Nagar', lat: 18.5492, lon: 73.9038 },
  { name: 'Viman Nagar', lat: 18.5679, lon: 73.9143 },
  { name: 'Kothrud', lat: 18.5074, lon: 73.8077 },
  { name: 'Baner High Street', lat: 18.5590, lon: 73.7868 },
  { name: 'Wakad', lat: 18.5987, lon: 73.7686 },
  { name: 'Hinjawadi IT Park', lat: 18.5913, lon: 73.7389 },
  { name: 'Camp / MG Road', lat: 18.5167, lon: 73.8767 },
  { name: 'Aundh', lat: 18.5580, lon: 73.8070 },
  { name: 'Magarpatta City', lat: 18.5135, lon: 73.9248 },
  { name: 'Pimpri Commercial', lat: 18.6279, lon: 73.8009 },
  { name: 'Chinchwad Station', lat: 18.6444, lon: 73.7915 },
  { name: 'Swargate', lat: 18.5018, lon: 73.8580 },
];

const Bar = ({ dirty, onSave, onDiscard, note, disabled }) =>
  dirty && (
    <div className="row sb wrap g8" style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'var(--surface)' }}>
      <span className="s13 row g8">
        <Icon n="error-warning-line" s={16} c="var(--warn)" />
        {note || 'You have unsaved changes.'}
      </span>
      <span className="row g8">
        <button className="btn ghost sm" onClick={onDiscard}>Discard</button>
        <button className="btn ink sm" disabled={disabled} onClick={onSave}>Save changes</button>
      </span>
    </div>
  );

export default function Business() {
  const { user, saveProfile } = useAuth();
  const { categories, setCategory } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const p = user?.profile || {};
  const cat = categories.find((c) => c.key === p.category);

  // ---------------- STORES LIST & MANAGEMENT ----------------
  const [stores, setStores] = useState(null);
  const [upRes, setUpRes] = useState(null);
  const fileRef = useRef(null);

  const loadStores = () =>
    api('/stores')
      .then((r) => setStores(r.stores || []))
      .catch(() => setStores([]));

  useEffect(() => {
    loadStores();
  }, []);

  const upload = async (file, mode) => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('category', p.category);
    form.append('mode', mode);
    try {
      const r = await api('/stores/upload', { method: 'POST', form });
      setUpRes(r.summary);
      loadStores();
      toast(`${r.summary.valid + r.summary.imputed} stores imported, ${r.summary.excluded} excluded`, { tone: 'ok' });
    } catch (e) {
      toast(e.message, { tone: 'bad', icon: 'error-warning-line' });
      setUpRes(null);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const delStore = async (s) => {
    try {
      await api(`/stores/${s._id}`, { method: 'DELETE' });
      setStores((x) => x.filter((y) => y._id !== s._id));
      toast(`${s.name} removed`, { icon: 'delete-bin-line', tone: 'info' });
    } catch (e) {
      toast(e.message, { tone: 'bad' });
    }
  };

  // ---------------- "ADD STORES" DROPDOWN FEATURE ----------------
  const [addStoreOpen, setAddStoreOpen] = useState(false);
  const [storeForm, setStoreForm] = useState({
    name: '',
    category: p.category || 'grocery',
    locality: PUNE_LOCALITY_PRESETS[0].name,
    lat: PUNE_LOCALITY_PRESETS[0].lat,
    lon: PUNE_LOCALITY_PRESETS[0].lon,
    annualRevenue: '',
    areaSqft: p.format?.areaSqft || 1000,
  });
  const [storeBusy, setStoreBusy] = useState(false);

  const onLocalityChange = (locName) => {
    const found = PUNE_LOCALITY_PRESETS.find((l) => l.name === locName);
    if (found) {
      setStoreForm((sf) => ({
        ...sf,
        locality: found.name,
        lat: found.lat,
        lon: found.lon,
      }));
    }
  };

  const handleCreateStore = async (e) => {
    e?.preventDefault();
    if (!storeForm.name.trim()) {
      toast('Please enter a store name', { tone: 'bad' });
      return;
    }
    setStoreBusy(true);
    try {
      const rev = Number(storeForm.annualRevenue) || undefined;
      await api('/stores', {
        method: 'POST',
        body: {
          name: storeForm.name.trim(),
          lat: Number(storeForm.lat),
          lon: Number(storeForm.lon),
          annualRevenue: rev,
          category: storeForm.category,
        },
      });
      toast(`Store "${storeForm.name}" created successfully!`, { tone: 'ok', icon: 'checkbox-circle-fill' });
      setStoreForm({
        name: '',
        category: p.category || 'grocery',
        locality: PUNE_LOCALITY_PRESETS[0].name,
        lat: PUNE_LOCALITY_PRESETS[0].lat,
        lon: PUNE_LOCALITY_PRESETS[0].lon,
        annualRevenue: '',
        areaSqft: p.format?.areaSqft || 1000,
      });
      setAddStoreOpen(false);
      loadStores();
    } catch (err) {
      toast(err.message || 'Failed to create store', { tone: 'bad' });
    } finally {
      setStoreBusy(false);
    }
  };

  // ---------------- "ADD A BUSINESS" MODAL FEATURE ----------------
  const [addBizModal, setAddBizModal] = useState(false);
  const [newBiz, setNewBiz] = useState({
    name: '',
    category: p.category || 'grocery',
    activity: '',
    type: '',
    budget: '',
    areaSqft: '',
  });
  const [newBizBusy, setNewBizBusy] = useState(false);

  const handleAddBusiness = async () => {
    if (!newBiz.name.trim()) {
      toast('Please enter the name of the new business', { tone: 'bad' });
      return;
    }
    setNewBizBusy(true);
    try {
      const budgetNum = Number(newBiz.budget) || undefined;
      const areaNum = Number(newBiz.areaSqft) || undefined;
      await saveProfile({
        profile: {
          businessName: newBiz.name.trim(),
          businessActivity: newBiz.activity.trim() || 'Retail business operations',
          businessType: newBiz.type.trim() || 'Commercial Outlet',
          category: newBiz.category,
          categories: Array.from(new Set([...(p.categories || []), newBiz.category])),
          goals: {
            ...p.goals,
            budget: budgetNum ?? p.goals?.budget,
          },
          format: {
            ...p.format,
            areaSqft: areaNum ?? p.format?.areaSqft,
          },
        },
      });
      setCategory(newBiz.category);
      toast(`Business "${newBiz.name}" registered and set active! Reflected in Profile.`, { tone: 'ok', icon: 'checkbox-circle-fill' });
      setAddBizModal(false);
      setNewBiz({
        name: '',
        category: p.category || 'grocery',
        activity: '',
        type: '',
        budget: '',
        areaSqft: '',
      });
    } catch (e) {
      toast(e.message || 'Failed to create business', { tone: 'bad' });
    } finally {
      setNewBizBusy(false);
    }
  };

  // ---------------- CATEGORY SWITCHER ----------------
  const [catModal, setCatModal] = useState(false);
  const [newCat, setNewCat] = useState(p.category);
  const changeCat = async () => {
    try {
      const r = await saveProfile({ profile: { category: newCat }, resetForCategory: true });
      setCategory(newCat);
      setCatModal(false);
      toast(`Category changed to ${categories.find((c) => c.key === newCat)?.name}`);
    } catch (e) {
      toast(e.message, { tone: 'bad' });
    }
  };

  // ---------------- FORMAT & ECONOMICS ----------------
  const f = p.format || {};
  const initFmt = () => ({
    areaSqft: String(f.areaSqft ?? ''),
    margin: f.margin != null ? String(+(f.margin * 100).toFixed(1)) : '',
    opex: String(f.opex ?? ''),
    capex: String(f.capex ?? ''),
    staff: String(f.staff ?? ''),
  });
  const [fmt, setFmt] = useState(initFmt);
  const [fmtErr, setFmtErr] = useState({});
  const fmtDirty = JSON.stringify(fmt) !== JSON.stringify(initFmt());

  const saveFmt = async () => {
    const e = {};
    const a = parseNum(fmt.areaSqft),
      m = parseNum(fmt.margin),
      o = parseNum(fmt.opex),
      c = parseNum(fmt.capex),
      s = parseNum(fmt.staff);
    if (!Number.isFinite(a) || a < 200) e.areaSqft = 'At least 200 sq ft';
    if (!Number.isFinite(m) || m < 1 || m > 80) e.margin = 'Margin must be between 1% and 80%';
    if (!Number.isFinite(o) || o <= 0) e.opex = 'Must be more than 0';
    if (!Number.isFinite(c) || c <= 0) e.capex = 'Must be more than 0';
    setFmtErr(e);
    if (Object.keys(e).length) return;
    try {
      await saveProfile({
        profile: {
          format: {
            areaSqft: a,
            margin: m / 100,
            opex: o,
            capex: c,
            staff: Number.isFinite(s) ? Math.round(s) : undefined,
          },
        },
      });
      toast('Format & economics saved');
    } catch (er) {
      setFmtErr(Object.fromEntries(Object.entries(fieldErrors(er)).map(([k, v]) => [k.split('.').pop(), v])));
    }
  };

  // ---------------- GOALS & CONSTRAINTS ----------------
  const g = p.goals || {};
  const initGoals = () => ({
    budget: String(g.budget ?? ''),
    maxRent: String(g.maxRent ?? ''),
    minSpacingKm: String(g.minSpacingKm ?? 1.5),
    minP10Profit: String(g.minP10Profit ?? 0),
    k: String(g.k ?? 5),
    risk: g.risk || 'balanced',
    excludeLowConfidence: g.excludeLowConfidence !== false,
  });
  const [goals, setGoals] = useState(initGoals);
  const [goalErr, setGoalErr] = useState({});
  const goalsDirty = JSON.stringify(goals) !== JSON.stringify(initGoals());

  const validateGoals = (x) => {
    const e = {};
    const b = parseNum(x.budget),
      r = parseNum(x.maxRent),
      s = parseNum(x.minSpacingKm),
      m = parseNum(x.minP10Profit),
      k = parseNum(x.k);
    if (!Number.isFinite(b) || b <= 0) e.budget = 'Budget must be more than 0';
    if (!Number.isFinite(r) || r < 10 || r > 1000) e.maxRent = 'Rent must be between ₹10 and ₹1,000 per sq ft per month';
    if (!Number.isFinite(s) || s < 0.5 || s > 10) e.minSpacingKm = 'Spacing must be 0.5 – 10 km';
    if (!Number.isFinite(m) || m < 0) e.minP10Profit = 'Must be 0 or more';
    if (!Number.isInteger(k) || k < 1 || k > 20) e.k = '1 – 20';
    return e;
  };
  const liveGoalErr = validateGoals(goals);

  const saveGoals = async () => {
    setGoalErr(liveGoalErr);
    if (Object.keys(liveGoalErr).length) return;
    try {
      await saveProfile({
        profile: {
          goals: {
            budget: parseNum(goals.budget),
            maxRent: parseNum(goals.maxRent),
            minSpacingKm: parseNum(goals.minSpacingKm),
            minP10Profit: parseNum(goals.minP10Profit),
            k: parseNum(goals.k),
            risk: goals.risk,
            excludeLowConfidence: goals.excludeLowConfidence,
          },
        },
      });
      toast('Goals & constraints saved');
    } catch (er) {
      setGoalErr(Object.fromEntries(Object.entries(fieldErrors(er)).map(([k, v]) => [k.split('.').pop(), v])));
    }
  };

  // ---------------- SECURITY ----------------
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwErr, setPwErr] = useState({});
  const [pwBusy, setPwBusy] = useState(false);

  const changePw = async () => {
    setPwBusy(true);
    try {
      await api('/auth/password', {
        method: 'PATCH',
        body: { currentPassword: pw.current, newPassword: pw.next },
      });
      setPw({ current: '', next: '' });
      setPwErr({});
      toast('Password updated successfully', { tone: 'ok' });
    } catch (e) {
      setPwErr(fieldErrors(e));
      toast(e.message || 'Failed to update password', { tone: 'bad' });
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="page">
      <Header back />
      <SystemBanners />

      {/* Top Subheader */}
      <div className="profile-subhdr">
        <div className="col g4">
          <div className="row g8 ac">
            <h1 className="h3" style={{ margin: 0 }}>Business Management</h1>
            <span className="tag ok">Active Venture</span>
          </div>
          <span className="s13 muted">
            Configure your enterprise stores, unit economics, network constraints, and security.
          </span>
        </div>

        <div className="row g10 wrap ac">
          <Link to="/profile" className="btn out sm" title="Return to Profile">
            <Icon n="user-line" s={15} /> Profile
          </Link>
          <button className="btn ink sm glow" onClick={() => setAddBizModal(true)}>
            <Icon n="add-line" s={15} /> Add a Business
          </button>
        </div>
      </div>

      <main className="wrapx col g24" style={{ padding: '32px 28px 64px', maxWidth: 1040, margin: '0 auto' }}>
        {/* Business Hero Card */}
        <div className="business-hero-card">
          <div className="col g6">
            <div className="row g10 ac wrap">
              <span className="b s22" style={{ color: 'var(--text)' }}>
                {p.businessName || 'Business Venture'}
              </span>
              <span className="tag acc" style={{ fontSize: 13 }}>
                <Icon n={cat?.icon || 'store-line'} s={14} /> {cat?.name || 'Retail'}
              </span>
              {p.businessType && p.businessType.toLowerCase() !== 'fmcg' && (
                <span className="tag">{p.businessType}</span>
              )}
            </div>
            <p className="s13 muted" style={{ maxWidth: 640, margin: 0 }}>
              {p.businessActivity || 'Store locations, catchment revenue forecasting, and spatial network constraints.'}
            </p>
          </div>

          <div className="row g10 wrap ac">
            <button className="btn out sm" onClick={() => setCatModal(true)}>
              <Icon n="shuffle-line" s={14} /> Change Category
            </button>

            {/* "ADD STORES" BUTTON + DROPDOWN ONCLICK */}
            <button
              className={`btn ${addStoreOpen ? 'ink' : 'pri'} sm`}
              onClick={() => setAddStoreOpen(!addStoreOpen)}
              title="Add a new store outlet to this business"
            >
              <Icon n={addStoreOpen ? 'close-line' : 'add-line'} s={16} />
              Add Stores
              <Icon n={addStoreOpen ? 'arrow-up-s-line' : 'arrow-down-s-line'} s={16} />
            </button>
          </div>
        </div>

        {/* DROPDOWN PANEL FOR ADDING STORES */}
        {addStoreOpen && (
          <form className="add-store-panel col g16" onSubmit={handleCreateStore}>
            <div className="row sb ac wrap g8" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
              <div className="row g8 ac">
                <Icon n="store-2-line" s={18} c="var(--accent)" />
                <span className="b s15">Add Store to {p.businessName || 'Business'}</span>
              </div>
              <span className="s12 muted">Fill required store credentials &amp; location</span>
            </div>

            <div className="grid3">
              <div className="field">
                <label className="b s13">Store Outlet Name *</label>
                <div className="input">
                  <Icon n="building-line" s={16} c="var(--muted)" />
                  <input
                    autoFocus
                    value={storeForm.name}
                    onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                    placeholder="e.g. Karyakshetram - FC Road"
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label className="b s13">Store Category</label>
                <div className="input">
                  <Icon n="apps-line" s={16} c="var(--muted)" />
                  <select
                    value={storeForm.category}
                    onChange={(e) => setStoreForm({ ...storeForm, category: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.key} value={c.key}>{c.name}</option>
                    ))}
                  </select>
                  <Icon n="arrow-down-s-line" s={16} c="var(--muted)" />
                </div>
              </div>

              <div className="field">
                <label className="b s13">Locality Preset (Pune &amp; PCMC)</label>
                <div className="input">
                  <Icon n="map-pin-line" s={16} c="var(--muted)" />
                  <select
                    value={storeForm.locality}
                    onChange={(e) => onLocalityChange(e.target.value)}
                  >
                    {PUNE_LOCALITY_PRESETS.map((loc) => (
                      <option key={loc.name} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                  <Icon n="arrow-down-s-line" s={16} c="var(--muted)" />
                </div>
              </div>
            </div>

            <div className="grid3">
              <div className="field">
                <label className="b s13">Latitude</label>
                <div className="input">
                  <input
                    type="number"
                    step="0.0001"
                    value={storeForm.lat}
                    onChange={(e) => setStoreForm({ ...storeForm, lat: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label className="b s13">Longitude</label>
                <div className="input">
                  <input
                    type="number"
                    step="0.0001"
                    value={storeForm.lon}
                    onChange={(e) => setStoreForm({ ...storeForm, lon: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label className="b s13">Annual Revenue (₹)</label>
                <div className="input">
                  <span className="suf">₹</span>
                  <input
                    type="number"
                    value={storeForm.annualRevenue}
                    onChange={(e) => setStoreForm({ ...storeForm, annualRevenue: e.target.value })}
                    placeholder="Leave blank to auto-estimate"
                  />
                </div>
              </div>
            </div>

            <div className="row sb ac wrap g12" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <span className="s12 muted">
                Store will be automatically snapped to the nearest hexagonal spatial cell for cannibalisation analysis.
              </span>
              <div className="row g8">
                <button type="button" className="btn ghost sm" onClick={() => setAddStoreOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn ink sm" disabled={storeBusy}>
                  {storeBusy && <Icon n="loader-4-line" className="spin" s={14} />}
                  Create Store
                </button>
              </div>
            </div>
          </form>
        )}

        {/* SECTION 1: MY STORES */}
        <div className="card pad24 col g16" style={{ background: 'var(--bg)', borderRadius: 20, border: '1.5px solid var(--line)' }}>
          <div className="row sb ac wrap g12">
            <div className="row g10 ac">
              <div className="iconbtn fill" style={{ background: 'var(--accentSoft)', color: 'var(--accent)', width: 36, height: 36 }}>
                <Icon n="store-2-line" s={18} />
              </div>
              <div className="col">
                <span className="b s16">My Stores</span>
                <span className="s12 muted">Network stores for own-store cannibalisation and catchment models</span>
              </div>
            </div>

            <div className="row g8 wrap ac">
              <span className="tag ok">{stores?.length ?? 0} Stores active</span>
              <label className="btn out sm" title="Bulk CSV upload">
                <Icon n="upload-cloud-2-line" s={14} /> Replace all (CSV)
                <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => upload(e.target.files[0], 'replace')} />
              </label>
              <label className="btn out sm" title="Append additional stores via CSV">
                <Icon n="add-line" s={14} /> Append CSV
                <input type="file" accept=".csv" hidden onChange={(e) => upload(e.target.files[0], 'append')} />
              </label>
            </div>
          </div>

          {upRes && (
            <span className="s12 muted">
              Last CSV import: {upRes.valid} valid · {upRes.imputed} imputed · {upRes.excluded} excluded
            </span>
          )}

          {stores?.length === 0 ? (
            <Banner tone="info" icon="store-3-line">
              No stores loaded yet. Click <b>Add Stores</b> above or import a CSV to unlock cannibalisation and network analysis.
            </Banner>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 360, borderRadius: 12, border: '1px solid var(--line)' }}>
              <table className="t">
                <thead>
                  <tr>
                    <th>Store Name</th>
                    <th>Category</th>
                    <th>Annual Revenue</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stores?.map((s) => (
                    <tr key={s._id}>
                      <td className="b">{s.name}</td>
                      <td className="muted s12">{categories.find((c) => c.key === s.category)?.name || s.category}</td>
                      <td className="num">
                        {inr(s.annualRevenue)}
                        {s.revenueEstimated && <span className="tag warn" style={{ marginLeft: 6 }}>Estimated</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="iconbtn"
                          style={{ width: 30, height: 30 }}
                          onClick={() => delStore(s)}
                          aria-label={`Delete ${s.name}`}
                          title="Delete store"
                        >
                          <Icon n="delete-bin-line" s={15} c="var(--bad)" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 2: FORMAT & ECONOMICS */}
        <div className="card pad24 col g16" style={{ background: 'var(--bg)', borderRadius: 20, border: '1.5px solid var(--line)' }}>
          <div className="row sb ac wrap g12">
            <div className="row g10 ac">
              <div className="iconbtn fill" style={{ background: 'var(--accentSoft)', color: 'var(--accent)', width: 36, height: 36 }}>
                <Icon n="equalizer-line" s={18} />
              </div>
              <div className="col">
                <span className="b s16">Format &amp; Economics</span>
                <span className="s12 muted">Standard unit metrics that calibrate profit, tiers, and break-even rent</span>
              </div>
            </div>
            <span className="s12 muted hide-sm">
              {inrPlain(f.areaSqft)} sq ft · {Math.round((f.margin || 0) * 100)}% margin · {inr(f.opex)} opex
            </span>
          </div>

          <div className="grid3">
            <Field
              label="Store area"
              value={fmt.areaSqft}
              onChange={(v) => setFmt({ ...fmt, areaSqft: v })}
              suffix="sq ft"
              error={fmtErr.areaSqft}
            />
            <Field
              label="Gross margin"
              value={fmt.margin}
              onChange={(v) => setFmt({ ...fmt, margin: v })}
              suffix="%"
              error={fmtErr.margin}
            />
            <Field
              label="Operating cost / year"
              value={fmt.opex}
              onChange={(v) => setFmt({ ...fmt, opex: v })}
              suffix="₹"
              error={fmtErr.opex}
              help={inr(parseNum(fmt.opex))}
            />
            <Field
              label="Capex"
              value={fmt.capex}
              onChange={(v) => setFmt({ ...fmt, capex: v })}
              suffix="₹"
              error={fmtErr.capex}
              help={inr(parseNum(fmt.capex))}
            />
            <Field
              label="Staff (FTE)"
              value={fmt.staff}
              onChange={(v) => setFmt({ ...fmt, staff: v })}
              suffix="people"
            />
          </div>

          <Bar
            dirty={fmtDirty}
            onSave={saveFmt}
            onDiscard={() => {
              setFmt(initFmt());
              setFmtErr({});
            }}
            note="Changing economics re-scores profit, tiers, and break-even rent across Pune."
          />
        </div>

        {/* SECTION 3: GOALS & CONSTRAINTS */}
        <div className="card pad24 col g16" style={{ background: 'var(--bg)', borderRadius: 20, border: '1.5px solid var(--line)' }}>
          <div className="row sb ac wrap g12">
            <div className="row g10 ac">
              <div className="iconbtn fill" style={{ background: 'var(--accentSoft)', color: 'var(--accent)', width: 36, height: 36 }}>
                <Icon n="focus-3-line" s={18} />
              </div>
              <div className="col">
                <span className="b s16">Goals &amp; Constraints</span>
                <span className="s12 muted">Expansion parameters that drive algorithmic recommendation picks</span>
              </div>
            </div>
            {goalsDirty && <span className="tag warn">Editing · Unsaved</span>}
          </div>

          <div className="grid2">
            <Field
              label="Total budget"
              value={goals.budget}
              onChange={(v) => setGoals({ ...goals, budget: v })}
              suffix="₹"
              error={goalErr.budget || (goalsDirty && liveGoalErr.budget)}
              help={`${inr(parseNum(goals.budget))} · was ${inr(g.budget)}`}
            />
            <Field
              label="Maximum rent"
              value={goals.maxRent}
              onChange={(v) => setGoals({ ...goals, maxRent: v })}
              suffix="₹/sq ft/month"
              error={goalErr.maxRent || (goalsDirty && liveGoalErr.maxRent)}
              help={`Was ₹${g.maxRent ?? '—'}`}
            />
            <Field
              label="Minimum distance between picks"
              value={goals.minSpacingKm}
              onChange={(v) => setGoals({ ...goals, minSpacingKm: v })}
              suffix="km"
              error={goalErr.minSpacingKm || (goalsDirty && liveGoalErr.minSpacingKm)}
            />
            <Field
              label="Minimum downside profit"
              value={goals.minP10Profit}
              onChange={(v) => setGoals({ ...goals, minP10Profit: v })}
              suffix="₹/yr"
              error={goalErr.minP10Profit || (goalsDirty && liveGoalErr.minP10Profit)}
            />
            <Field
              label="Sites planned (k)"
              value={goals.k}
              onChange={(v) => setGoals({ ...goals, k: v })}
              error={goalErr.k || (goalsDirty && liveGoalErr.k)}
            />
            <Field
              label="Risk appetite"
              value={goals.risk}
              onChange={(v) => setGoals({ ...goals, risk: v })}
              options={[
                { value: 'conservative', label: 'Conservative' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'aggressive', label: 'Aggressive' },
              ]}
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <Check
              on={goals.excludeLowConfidence}
              onClick={() => setGoals({ ...goals, excludeLowConfidence: !goals.excludeLowConfidence })}
              label="Exclude low-confidence and empty-market sites from default recommendation picks"
            />
          </div>

          <Bar
            dirty={goalsDirty}
            onSave={saveGoals}
            disabled={Object.keys(liveGoalErr).length > 0}
            onDiscard={() => {
              setGoals(initGoals());
              setGoalErr({});
            }}
            note="Changing constraints re-scores your saved searches and dashboard picks."
          />
        </div>

        {/* SECTION 4: SECURITY */}
        <div className="card pad24 col g16" style={{ background: 'var(--bg)', borderRadius: 20, border: '1.5px solid var(--line)' }}>
          <div className="row g10 ac">
            <div className="iconbtn fill" style={{ background: 'var(--accentSoft)', color: 'var(--accent)', width: 36, height: 36 }}>
              <Icon n="lock-line" s={18} />
            </div>
            <div className="col">
              <span className="b s16">Security Credentials</span>
              <span className="s12 muted">Update your workspace password</span>
            </div>
          </div>

          <div className="grid2">
            <Field
              label="Current password"
              type="password"
              value={pw.current}
              onChange={(v) => setPw({ ...pw, current: v })}
              error={pwErr.currentPassword}
            />
            <Field
              label="New password"
              type="password"
              value={pw.next}
              onChange={(v) => setPw({ ...pw, next: v })}
              error={pwErr.newPassword}
              help="8+ characters with at least one number"
            />
          </div>

          <div className="row">
            <button
              className="btn ink sm"
              disabled={!pw.current || !pw.next || pwBusy}
              onClick={changePw}
            >
              {pwBusy && <Icon n="loader-4-line" className="spin" s={14} />} Update password
            </button>
          </div>
        </div>
      </main>

      <Footer />

      {/* "ADD A BUSINESS" MODAL */}
      <Modal open={addBizModal} onClose={() => setAddBizModal(false)} title="Register a New Business">
        <div className="col g16">
          <p className="s13 muted">
            Configure your new commercial entity. Its details will automatically become active and reflect in your Profile section.
          </p>

          <div className="field">
            <label className="b s13">Business / Enterprise Name *</label>
            <div className="input">
              <Icon n="building-2-line" s={16} c="var(--muted)" />
              <input
                autoFocus
                value={newBiz.name}
                onChange={(e) => setNewBiz({ ...newBiz, name: e.target.value })}
                placeholder="e.g. Chai Point Express"
                required
              />
            </div>
          </div>

          <div className="field">
            <label className="b s13">Primary Business Category</label>
            <div className="input">
              <Icon n="apps-line" s={16} c="var(--muted)" />
              <select
                value={newBiz.category}
                onChange={(e) => setNewBiz({ ...newBiz, category: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.name}</option>
                ))}
              </select>
              <Icon n="arrow-down-s-line" s={16} c="var(--muted)" />
            </div>
          </div>

          <div className="grid2">
            <div className="field">
              <label className="b s13">Operational Format</label>
              <div className="input">
                <Icon n="store-line" s={16} c="var(--muted)" />
                <input
                  value={newBiz.type}
                  onChange={(e) => setNewBiz({ ...newBiz, type: e.target.value })}
                  placeholder="e.g. Flagship Store, QSR, Boutique"
                />
              </div>
            </div>

            <div className="field">
              <label className="b s13">Store Footprint (sq ft)</label>
              <div className="input">
                <Icon n="ruler-line" s={16} c="var(--muted)" />
                <input
                  type="number"
                  value={newBiz.areaSqft}
                  onChange={(e) => setNewBiz({ ...newBiz, areaSqft: e.target.value })}
                  placeholder="e.g. 1200"
                />
              </div>
            </div>
          </div>

          <div className="field">
            <label className="b s13">Expansion Budget (₹)</label>
            <div className="input">
              <span className="suf">₹</span>
              <input
                type="number"
                value={newBiz.budget}
                onChange={(e) => setNewBiz({ ...newBiz, budget: e.target.value })}
                placeholder="e.g. 5000000"
              />
            </div>
          </div>

          <div className="field">
            <label className="b s13">What this business does (Offering)</label>
            <div className="input">
              <Icon n="chat-voice-line" s={16} c="var(--muted)" />
              <input
                value={newBiz.activity}
                onChange={(e) => setNewBiz({ ...newBiz, activity: e.target.value })}
                placeholder="e.g. Artisanal bakery and specialty beverage cafe"
              />
            </div>
          </div>

          <div className="row g8 jc" style={{ marginTop: 8 }}>
            <button className="btn ghost" onClick={() => setAddBizModal(false)}>
              Cancel
            </button>
            <button className="btn ink" disabled={newBizBusy || !newBiz.name.trim()} onClick={handleAddBusiness}>
              {newBizBusy && <Icon n="loader-4-line" className="spin" s={14} />} Register &amp; Set Active
            </button>
          </div>
        </div>
      </Modal>

      {/* CHANGE CATEGORY MODAL */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title="Change Business Category">
        <div className="col g14">
          <Banner tone="warn" icon="error-warning-line">
            Format, drivers, and constraints reset to the new category’s defaults. Your stores and saved locations remain.
          </Banner>
          <Field
            label="New Category"
            value={newCat}
            onChange={setNewCat}
            options={categories.map((c) => ({ value: c.key, label: c.name }))}
          />
          <div className="row g8 jc">
            <button className="btn ghost" onClick={() => setCatModal(false)}>
              Cancel
            </button>
            <button className="btn ink" disabled={newCat === p.category} onClick={changeCat}>
              Change category
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
