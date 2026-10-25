import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fieldErrors } from '../lib/api.js';
import { useApp, useAuth, useToast } from '../lib/state.jsx';
import { inr, ROLE_LABEL, initials } from '../lib/format.js';
import { Header, Footer, SystemBanners } from '../components/Layout.jsx';
import { Icon, Modal, Banner } from '../components/ui.jsx';

export default function Profile() {
  const { user, saveProfile, logout, setUser } = useAuth();
  const { categories, saved } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const p = user?.profile || {};
  const cat = categories.find((c) => c.key === p.category);

  // Stores count
  const [storesCount, setStoresCount] = useState(0);
  useEffect(() => {
    api('/stores')
      .then((r) => setStoresCount(r.stores?.length || 0))
      .catch(() => setStoresCount(0));
  }, []);

  // Saved locations count
  const savedCount = saved?.size || 0;

  // ---------------- Personal Details State & Edit Mode ----------------
  const [editPersonal, setEditPersonal] = useState(false);
  const [personalForm, setPersonalForm] = useState({
    name: user?.name || '',
    role: p.role || 'owner',
  });
  const [personalBusy, setPersonalBusy] = useState(false);

  const savePersonal = async () => {
    if (!personalForm.name.trim()) {
      toast('Name cannot be empty', { tone: 'bad' });
      return;
    }
    setPersonalBusy(true);
    try {
      await saveProfile({
        name: personalForm.name.trim(),
        profile: {
          role: personalForm.role,
        },
      });
      setEditPersonal(false);
      toast('Personal details updated successfully', { tone: 'ok', icon: 'checkbox-circle-fill' });
    } catch (e) {
      toast(e.message || 'Failed to update personal details', { tone: 'bad' });
    } finally {
      setPersonalBusy(false);
    }
  };

  const cancelPersonal = () => {
    setPersonalForm({
      name: user?.name || '',
      role: p.role || 'owner',
    });
    setEditPersonal(false);
  };

  // ---------------- Business Details State & Edit Mode ----------------
  const [editBusiness, setEditBusiness] = useState(false);
  const [bizForm, setBizForm] = useState({
    businessName: p.businessName || '',
    businessActivity: p.businessActivity || '',
    businessType: p.businessType || '',
    budget: p.goals?.budget || '',
    areaSqft: p.format?.areaSqft || '',
  });
  const [bizBusy, setBizBusy] = useState(false);

  // Sync state if profile updates
  useEffect(() => {
    setPersonalForm({
      name: user?.name || '',
      role: p.role || 'owner',
    });
    setBizForm({
      businessName: p.businessName || '',
      businessActivity: p.businessActivity || '',
      businessType: p.businessType || '',
      budget: p.goals?.budget || '',
      areaSqft: p.format?.areaSqft || '',
    });
  }, [user]);

  const saveBusiness = async () => {
    if (!bizForm.businessName.trim()) {
      toast('Business name is required', { tone: 'bad' });
      return;
    }
    setBizBusy(true);
    try {
      const budgetNum = Number(bizForm.budget) || undefined;
      const areaNum = Number(bizForm.areaSqft) || undefined;
      await saveProfile({
        profile: {
          businessName: bizForm.businessName.trim(),
          businessActivity: bizForm.businessActivity.trim(),
          businessType: bizForm.businessType.trim(),
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
      setEditBusiness(false);
      toast('Business details updated successfully', { tone: 'ok', icon: 'checkbox-circle-fill' });
    } catch (e) {
      toast(e.message || 'Failed to update business details', { tone: 'bad' });
    } finally {
      setBizBusy(false);
    }
  };

  const cancelBusiness = () => {
    setBizForm({
      businessName: p.businessName || '',
      businessActivity: p.businessActivity || '',
      businessType: p.businessType || '',
      budget: p.goals?.budget || '',
      areaSqft: p.format?.areaSqft || '',
    });
    setEditBusiness(false);
  };

  // ---------------- Account Actions & Delete ----------------
  const [delModal, setDelModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [delBusy, setDelBusy] = useState(false);

  const deleteAccount = async () => {
    setDelBusy(true);
    try {
      await api('/profile', { method: 'DELETE' });
      logout();
      setUser(null);
      nav('/', { replace: true });
    } catch (e) {
      toast(e.message || 'Failed to delete account', { tone: 'bad' });
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <div className="page">
      <Header back />
      <SystemBanners />

      {/* Top Subheader with Business and Saved Locations Action Buttons */}
      <div className="profile-subhdr">
        <div className="col g4">
          <div className="row g8 ac">
            <h1 className="h3" style={{ margin: 0 }}>User Profile</h1>
            <span className="tag ok">Active Account</span>
          </div>
          <span className="s13 muted">
            Manage your personal credentials and key business overview at a glance.
          </span>
        </div>

        {/* Top-Right Action Buttons */}
        <div className="row g10 wrap ac">
          <Link to="/saved" className="btn out sm" title="View your bookmarked locations">
            <Icon n="bookmark-line" s={16} c="var(--accent)" />
            Saved Locations
            {savedCount > 0 && <span className="tag sm" style={{ marginLeft: 4 }}>{savedCount}</span>}
          </Link>

          <Link to="/business" className="btn ink sm glow" title="Manage your full business, stores, and format economics">
            <Icon n="building-2-line" s={16} />
            Business
            <Icon n="arrow-right-line" s={14} />
          </Link>
        </div>
      </div>

      <main className="wrapx col g24" style={{ padding: '32px 28px 64px', maxWidth: 960, margin: '0 auto' }}>
        {/* User Hero Banner */}
        <div className="card pad24 row sb wrap g20 ac" style={{ background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 20 }}>
          <div className="row g16 ac wrap">
            <div className="avatar" style={{ width: 68, height: 68, fontSize: 24, background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 18px rgba(123,30,46,0.25)' }}>
              {initials(user?.name)}
            </div>
            <div className="col g4">
              <div className="row g10 ac">
                <span className="b s18" style={{ color: 'var(--text)' }}>{user?.name}</span>
                <span className="tag acc">{ROLE_LABEL[p.role] || p.role || 'Business Owner'}</span>
              </div>
              <span className="s13 muted">{user?.email}</span>
              <span className="s12 b" style={{ color: 'var(--accent)' }}>
                {p.businessName ? `Company: ${p.businessName}` : 'No company specified'}
              </span>
            </div>
          </div>

          <div className="row g8">
            <button className="btn out sm" onClick={() => { logout(); nav('/login'); }} title="Sign out from this session">
              <Icon n="logout-box-r-line" s={15} /> Sign out
            </button>
          </div>
        </div>

        {/* SECTION 1: Personal Details */}
        <div className="profile-card-section">
          <div className="row sb ac wrap g12" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
            <div className="row g10 ac">
              <div className="iconbtn fill" style={{ background: 'var(--accentSoft)', color: 'var(--accent)', width: 36, height: 36 }}>
                <Icon n="user-3-line" s={18} />
              </div>
              <div className="col">
                <span className="b s16">Personal Details</span>
                <span className="s12 muted">Your personal account credentials and role</span>
              </div>
            </div>

            {!editPersonal ? (
              <button className="btn out sm" onClick={() => setEditPersonal(true)}>
                <Icon n="edit-line" s={14} /> Edit
              </button>
            ) : (
              <div className="row g8">
                <button className="btn ghost sm" onClick={cancelPersonal} disabled={personalBusy}>
                  Cancel
                </button>
                <button className="btn ink sm" onClick={savePersonal} disabled={personalBusy}>
                  {personalBusy ? <Icon n="loader-4-line" className="spin" s={14} /> : <Icon n="check-line" s={14} />}
                  Save Changes
                </button>
              </div>
            )}
          </div>

          {!editPersonal ? (
            /* View Mode */
            <div className="profile-info-grid">
              <div className="profile-info-tile">
                <span className="lbl">Full Name</span>
                <span className="val">{user?.name || '—'}</span>
              </div>

              <div className="profile-info-tile">
                <span className="lbl">Work Email</span>
                <span className="val row g6 ac">
                  <Icon n="mail-check-line" s={15} c="var(--ok)" />
                  {user?.email || '—'}
                </span>
              </div>

              <div className="profile-info-tile">
                <span className="lbl">Role / Designation</span>
                <span className="val">{ROLE_LABEL[p.role] || p.role || 'Business Owner'}</span>
              </div>

              <div className="profile-info-tile">
                <span className="lbl">Primary Territory</span>
                <span className="val row g6 ac">
                  <Icon n="map-pin-line" s={15} c="var(--accent)" />
                  Pune &amp; PCMC
                </span>
              </div>
            </div>
          ) : (
            /* Edit Mode */
            <div className="col g16" style={{ background: 'var(--surface)', padding: 18, borderRadius: 14, border: '1px solid var(--line)' }}>
              <div className="grid2">
                <div className="field">
                  <label className="b s13">Full Name *</label>
                  <div className="input">
                    <Icon n="user-line" s={16} c="var(--muted)" />
                    <input
                      autoFocus
                      value={personalForm.name}
                      onChange={(e) => setPersonalForm({ ...personalForm, name: e.target.value })}
                      placeholder="Your full name"
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="b s13">Role / Designation</label>
                  <div className="input">
                    <Icon n="briefcase-line" s={16} c="var(--muted)" />
                    <select
                      value={personalForm.role}
                      onChange={(e) => setPersonalForm({ ...personalForm, role: e.target.value })}
                    >
                      {Object.entries(ROLE_LABEL).map(([val, lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                      ))}
                    </select>
                    <Icon n="arrow-down-s-line" s={16} c="var(--muted)" />
                  </div>
                </div>
              </div>
              <span className="s12 muted">Email address is permanently bound to this workspace. Contact admin to change email.</span>
            </div>
          )}
        </div>

        {/* SECTION 2: Business at a Glance */}
        <div className="profile-card-section">
          <div className="row sb ac wrap g12" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
            <div className="row g10 ac">
              <div className="iconbtn fill" style={{ background: 'var(--accentSoft)', color: 'var(--accent)', width: 36, height: 36 }}>
                <Icon n="building-2-line" s={18} />
              </div>
              <div className="col">
                <span className="b s16">Business at a Glance</span>
                <span className="s12 muted">Primary company profile and key operational metrics</span>
              </div>
            </div>

            <div className="row g8 ac">
              {!editBusiness ? (
                <>
                  <Link to="/business" className="btn ghost sm" style={{ color: 'var(--accent)' }}>
                    Full Settings <Icon n="arrow-right-s-line" s={16} />
                  </Link>
                  <button className="btn out sm" onClick={() => setEditBusiness(true)}>
                    <Icon n="edit-line" s={14} /> Edit
                  </button>
                </>
              ) : (
                <>
                  <button className="btn ghost sm" onClick={cancelBusiness} disabled={bizBusy}>
                    Cancel
                  </button>
                  <button className="btn ink sm" onClick={saveBusiness} disabled={bizBusy}>
                    {bizBusy ? <Icon n="loader-4-line" className="spin" s={14} /> : <Icon n="check-line" s={14} />}
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>

          {!editBusiness ? (
            /* View Mode */
            <div className="col g20">
              <div className="profile-info-grid">
                <div className="profile-info-tile">
                  <span className="lbl">Company Name</span>
                  <span className="val" style={{ color: 'var(--accent)' }}>{p.businessName || 'Not configured'}</span>
                </div>

                <div className="profile-info-tile">
                  <span className="lbl">Primary Category</span>
                  <span className="val row g6 ac">
                    <Icon n={cat?.icon || 'store-2-line'} s={16} c="var(--accent)" />
                    {cat?.name || 'Retail'}
                  </span>
                </div>

                <div className="profile-info-tile">
                  <span className="lbl">Operational Format</span>
                  <span className="val">{p.businessType || 'Standard Retail Outlet'}</span>
                </div>

                <div className="profile-info-tile">
                  <span className="lbl">Business Offering</span>
                  <span className="val" style={{ fontSize: 13, fontWeight: 500 }}>
                    {p.businessActivity || 'Retail goods and customer service'}
                  </span>
                </div>
              </div>

              {/* 4 Key Business Metrics Tiles */}
              <div className="grid4">
                <div className="metric-pill-card">
                  <div className="metric-pill-icon">
                    <Icon n="store-3-line" />
                  </div>
                  <div className="col g2">
                    <span className="s11 muted b">STORE NETWORK</span>
                    <span className="b s16">{storesCount} {storesCount === 1 ? 'Store' : 'Stores'}</span>
                  </div>
                </div>

                <div className="metric-pill-card">
                  <div className="metric-pill-icon">
                    <Icon n="ruler-line" />
                  </div>
                  <div className="col g2">
                    <span className="s11 muted b">STORE FOOTPRINT</span>
                    <span className="b s16">{p.format?.areaSqft ? `${p.format.areaSqft} sq ft` : 'Standard'}</span>
                  </div>
                </div>

                <div className="metric-pill-card">
                  <div className="metric-pill-icon">
                    <Icon n="money-dollar-circle-line" />
                  </div>
                  <div className="col g2">
                    <span className="s11 muted b">EXPANSION BUDGET</span>
                    <span className="b s16">{p.goals?.budget ? inr(p.goals.budget) : 'Flexible'}</span>
                  </div>
                </div>

                <div className="metric-pill-card">
                  <div className="metric-pill-icon">
                    <Icon n="percent-line" />
                  </div>
                  <div className="col g2">
                    <span className="s11 muted b">GROSS MARGIN</span>
                    <span className="b s16">{p.format?.margin ? `${Math.round(p.format.margin * 100)}%` : 'Standard'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Edit Mode */
            <div className="col g16" style={{ background: 'var(--surface)', padding: 18, borderRadius: 14, border: '1px solid var(--line)' }}>
              <div className="grid2">
                <div className="field">
                  <label className="b s13">Company / Business Name *</label>
                  <div className="input">
                    <Icon n="building-2-line" s={16} c="var(--muted)" />
                    <input
                      autoFocus
                      value={bizForm.businessName}
                      onChange={(e) => setBizForm({ ...bizForm, businessName: e.target.value })}
                      placeholder="e.g. Chai Point Express"
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="b s13">Operational Format / Type</label>
                  <div className="input">
                    <Icon n="store-line" s={16} c="var(--muted)" />
                    <input
                      value={bizForm.businessType}
                      onChange={(e) => setBizForm({ ...bizForm, businessType: e.target.value })}
                      placeholder="e.g. Flagship Outlet, Boutique, QSR"
                    />
                  </div>
                </div>
              </div>

              <div className="field">
                <label className="b s13">What your business does (Offering)</label>
                <div className="input">
                  <Icon n="chat-voice-line" s={16} c="var(--muted)" />
                  <input
                    value={bizForm.businessActivity}
                    onChange={(e) => setBizForm({ ...bizForm, businessActivity: e.target.value })}
                    placeholder="e.g. Specialty coffee roasting and artisanal pastry cafe"
                  />
                </div>
              </div>

              <div className="grid2">
                <div className="field">
                  <label className="b s13">Store Footprint / Floor Area (sq ft)</label>
                  <div className="input">
                    <Icon n="ruler-line" s={16} c="var(--muted)" />
                    <input
                      type="number"
                      value={bizForm.areaSqft}
                      onChange={(e) => setBizForm({ ...bizForm, areaSqft: e.target.value })}
                      placeholder="e.g. 1200"
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="b s13">Target Expansion Budget (₹)</label>
                  <div className="input">
                    <Icon n="money-dollar-circle-line" s={16} c="var(--muted)" />
                    <input
                      type="number"
                      value={bizForm.budget}
                      onChange={(e) => setBizForm({ ...bizForm, budget: e.target.value })}
                      placeholder="e.g. 5000000"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: Account Controls & Danger Zone */}
        <div className="card pad20 row sb wrap g16 ac" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          <div className="col g4">
            <span className="b s14">Workspace Session</span>
            <span className="s12 muted">Sign out from this device or permanently delete your account and personal records.</span>
          </div>

          <div className="row g10 wrap">
            <button className="btn out sm" onClick={() => { logout(); nav('/login'); }}>
              <Icon n="logout-box-r-line" s={15} /> Log out
            </button>
            <button className="btn out danger sm" onClick={() => setDelModal(true)}>
              <Icon n="delete-bin-line" s={15} /> Delete Account
            </button>
          </div>
        </div>
      </main>

      <Footer />

      {/* Delete Account Modal */}
      <Modal open={delModal} onClose={() => setDelModal(false)} title="Delete your account?">
        <div className="col g14">
          <Banner tone="bad" icon="error-warning-line">
            This will permanently remove your user profile, uploads, and saved locations. This action cannot be undone.
          </Banner>
          <p className="s13 muted">
            Please type <b style={{ color: 'var(--text)' }}>DELETE</b> below to confirm account removal.
          </p>
          <div className="input">
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
            />
          </div>
          <div className="row g8 jc">
            <button className="btn ghost" onClick={() => setDelModal(false)}>
              Cancel
            </button>
            <button
              className="btn pri"
              disabled={confirmText !== 'DELETE' || delBusy}
              onClick={deleteAccount}
            >
              {delBusy && <Icon n="loader-4-line" className="spin" />} Delete Account
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
