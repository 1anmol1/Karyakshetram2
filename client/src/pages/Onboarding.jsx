import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth, useApp, useToast } from '../lib/state.jsx';
import { Icon, ThemeToggle, AbstractArtBackground } from '../components/ui.jsx';

// Page 2: Business Formats & Operational Types
const BUSINESS_FORMATS = [
  { id: 'flagship', name: 'Flagship Retail Outlet', icon: 'store-3-line', desc: 'Prominent standalone showcase in high-traffic shopping districts' },
  { id: 'boutique', name: 'High-Street Boutique', icon: 't-shirt-2-line', desc: 'Curated lifestyle collections in pedestrian shopping hubs' },
  { id: 'qsr', name: 'QSR & Fast-Casual', icon: 'fire-line', desc: 'High-turnover dining with compact seating & rapid fulfillment' },
  { id: 'cloud-kitchen', name: 'Cloud Kitchen & Delivery', icon: 'restaurant-line', desc: 'Delivery-first kitchen hub with low frontage capex' },
  { id: 'franchise', name: 'Franchise Chain Outlet', icon: 'git-merge-line', desc: 'Scalable multi-unit concept with defined territory exclusivity' },
  { id: 'neighborhood', name: 'Neighborhood Mart', icon: 'shopping-basket-2-line', desc: 'Dense residential daily convenience & walking catchment' },
  { id: 'experience', name: 'D2C Experience Studio', icon: 'magic-line', desc: 'Interactive physical showroom driving omnichannel conversion' },
  { id: 'mall-anchor', name: 'Mall Atrium Anchor', icon: 'building-line', desc: 'High-visibility anchor destination capturing mall footfall' },
  { id: 'kiosk', name: 'Kiosk & Pop-Up Format', icon: 'apps-2-line', desc: 'Agile low-capex modular presence in prime transit corridors' },
  { id: 'transit', name: 'Commuter & Transit Hub', icon: 'train-line', desc: 'Metro station concourses & high-speed commuter junctions' },
  { id: 'wellness', name: 'Specialty Studio & Clinic', icon: 'heart-pulse-line', desc: 'Appointment-based personal care, diagnostics, or wellness' },
  { id: 'cafe-roastery', name: 'Artisanal Cafe & Bakery', icon: 'cup-line', desc: 'Specialty coffee lounge, pastry counter & community space' },
];

// Page 3: Retail Categories
const CATEGORY_ITEMS = [
  { key: 'restaurant', name: 'Restaurant & Dining', icon: 'restaurant-2-line', desc: 'Fine dining, casual dining, family bistros' },
  { key: 'cafe', name: 'Cafe & Beverage', icon: 'cup-line', desc: 'Specialty coffee, beverage bars, patisserie' },
  { key: 'pharmacy', name: 'Pharmacy & Wellness', icon: 'capsule-line', desc: 'Retail chemists, wellness, supplements' },
  { key: 'grocery', name: 'Grocery & Supermarket', icon: 'shopping-basket-2-line', desc: 'Daily essentials, organic food, mart' },
  { key: 'qsr', name: 'QSR & Fast Food', icon: 'fire-line', desc: 'Quick service, burgers, wraps, cloud kitchens' },
  { key: 'apparel', name: 'Fashion & Apparel', icon: 't-shirt-2-line', desc: 'Clothing boutique, footwear, accessories' },
  { key: 'bakery', name: 'Bakery & Desserts', icon: 'cake-3-line', desc: 'Artisanal breads, cakes, sweet treats' },
  { key: 'gym', name: 'Fitness & Gym', icon: 'run-line', desc: 'Fitness centers, yoga, pilates studios' },
  { key: 'salon', name: 'Salon & Spa', icon: 'scissors-cut-line', desc: 'Hair salon, beauty spa, grooming lounge' },
  { key: 'electronics', name: 'Electronics & Mobile', icon: 'tv-2-line', desc: 'Gadgets, smartphones, appliance retail' },
  { key: 'jewellery', name: 'Jewellery & Luxury', icon: 'vip-diamond-line', desc: 'Gold, diamonds, watches & lifestyle' },
  { key: 'diagnostics', name: 'Diagnostics & Clinic', icon: 'microscope-line', desc: 'Pathology labs, dental clinics, scan centers' },
];

// Page 4: Common Retail Hurdles
const CHALLENGE_ITEMS = [
  { id: 'rent', label: 'High commercial rent & aggressive lock-ins', icon: 'money-dollar-circle-line', desc: 'Lease inflexibility and excessive security deposits' },
  { id: 'footfall', label: 'Unpredictable footfall & misleading counts', icon: 'walk-line', desc: 'Inflated weekend metrics masking weekday lulls' },
  { id: 'cannibalisation', label: 'Cannibalising our existing network stores', icon: 'git-merge-line', desc: 'Overlapping catchments eroding same-store sales' },
  { id: 'competition', label: 'Heavy competitor saturation in commercial hubs', icon: 'store-3-line', desc: 'Price wars and margin compression in hot corridors' },
  { id: 'demographics', label: 'Understanding true neighborhood affluence', icon: 'user-search-line', desc: 'Misjudging local disposable income and basket sizes' },
  { id: 'visibility', label: 'Securing prime frontage & vehicle parking', icon: 'eye-line', desc: 'Obstructed street facades and acute parking deficits' },
  { id: 'breakeven', label: 'Long capex payback & uncertain break-even', icon: 'scales-3-line', desc: 'Delayed unit-economics profitability past target dates' },
  { id: 'permits', label: 'Navigating municipal zoning & trade clearances', icon: 'shield-keyhole-line', desc: 'Regulatory delays and municipal signage constraints' },
];

const PRELOADER_MESSAGES = [
  'Calibrating 949 spatial hexagonal cells across Pune & PCMC…',
  'Synthesizing neighborhood demographic indices & spending power…',
  'Constructing competitor density vectors & pedestrian catchment friction…',
  'Formulating calibrated P10–P90 revenue distribution curves…',
  'Verifying cross-store cannibalisation and break-even rent thresholds…',
  'Your retail intelligence cockpit is ready.',
];

export default function Onboarding() {
  const { step: stepParam } = useParams();
  const initStep = Math.min(4, Math.max(1, Number(stepParam) || 1));
  const [step, setStep] = useState(initStep);
  const [direction, setDirection] = useState('forward');
  const nav = useNavigate();
  const toast = useToast();
  const { user, saveProfile } = useAuth();
  const { setCategory } = useApp();

  const [form, setForm] = useState({
    name: user?.name || '',
    businessName: user?.profile?.businessName || '',
    businessActivity: user?.profile?.businessActivity || '',
    businessType: user?.profile?.businessType || '',
    categories: user?.profile?.categories?.length
      ? user.profile.categories
      : [user?.profile?.category || 'grocery'],
    challengesNote: user?.profile?.challengesNote || '',
    challenges: user?.profile?.challenges || [
      'High commercial rent & aggressive lock-ins',
      'Unpredictable footfall & misleading counts',
    ],
  });

  const [err, setErr] = useState('');
  const [preloaderIdx, setPreloaderIdx] = useState(0);
  const [progress, setProgress] = useState(18);

  const toggleCategory = (key) => {
    setForm((f) => {
      const exists = f.categories.includes(key);
      const updated = exists ? f.categories.filter((c) => c !== key) : [...f.categories, key];
      return { ...f, categories: updated.length ? updated : [key] };
    });
  };

  const selectFormat = (fmt) => {
    setForm((f) => ({
      ...f,
      businessType: fmt.name,
      businessActivity: f.businessActivity.trim() ? f.businessActivity : fmt.desc,
    }));
  };

  const toggleChallenge = (label) => {
    setForm((f) => {
      const exists = f.challenges.includes(label);
      const updated = exists ? f.challenges.filter((c) => c !== label) : [...f.challenges, label];
      return { ...f, challenges: updated };
    });
  };

  const goNext = () => {
    setErr('');
    if (step === 1) {
      if (!form.name.trim()) {
        setErr('Please introduce yourself with your name');
        return;
      }
      if (!form.businessName.trim()) {
        setErr('Please enter the name of your company');
        return;
      }
      setDirection('forward');
      setStep(2);
    } else if (step === 2) {
      if (!form.businessActivity.trim()) {
        setErr('Please tell us what your business does');
        return;
      }
      if (!form.businessType.trim()) {
        setErr('Please select or specify the type / format of your business');
        return;
      }
      setDirection('forward');
      setStep(3);
    } else if (step === 3) {
      if (!form.categories.length) {
        setErr('Please select at least one retail category');
        return;
      }
      setDirection('forward');
      setStep(4);
    } else if (step === 4) {
      startPreloaderAndFinish();
    }
  };

  const goBack = () => {
    setErr('');
    if (step > 1) {
      setDirection('backward');
      setStep((s) => s - 1);
    }
  };

  const startPreloaderAndFinish = () => {
    setDirection('forward');
    setStep('preloader');

    const primaryCategory = form.categories[0] || 'grocery';
    setCategory(primaryCategory);

    saveProfile({
      name: form.name.trim(),
      profile: {
        businessName: form.businessName.trim(),
        businessActivity: form.businessActivity.trim(),
        businessType: form.businessType.trim(),
        categories: form.categories,
        category: primaryCategory,
        challengesNote: form.challengesNote.trim(),
        challenges: form.challenges,
        completed: true,
        onboardingStep: 5,
      },
    }).catch((e) => {
      console.warn('Profile save note:', e);
    });
  };

  // Preloader interval animation
  useEffect(() => {
    if (step !== 'preloader') return undefined;

    const interval = setInterval(() => {
      setPreloaderIdx((i) => (i + 1) % PRELOADER_MESSAGES.length);
      setProgress((p) => Math.min(100, p + 16));
    }, 450);

    const redirectTimer = setTimeout(() => {
      toast('Welcome to Karyakshetram!', { tone: 'ok', icon: 'checkbox-circle-fill' });
      nav('/app', { replace: true });
    }, 2800);

    return () => {
      clearInterval(interval);
      clearTimeout(redirectTimer);
    };
  }, [step, nav, toast]);

  // Column-major 2-column split: items flow top-to-bottom in each column
  const toColMajor = (arr) => {
    const half = Math.ceil(arr.length / 2);
    return { col1: arr.slice(0, half), col2: arr.slice(half) };
  };
  const { col1: fmtCol1, col2: fmtCol2 } = toColMajor(BUSINESS_FORMATS);
  const { col1: catCol1, col2: catCol2 } = toColMajor(CATEGORY_ITEMS);
  const { col1: chalCol1, col2: chalCol2 } = toColMajor(CHALLENGE_ITEMS);

  return (
    <div className="ob-page">
      {/* Abstract Background Design in Light and Dark Mode */}
      <AbstractArtBackground />

      {/* Top Header */}
      <header className="ob-hdr">
        <div className="hleft">
          <span className="logo" style={{ fontSize: 22 }}>
            Karyakshetram<i>.</i>
          </span>
        </div>

        <div className="ob-stepper">
          {[1, 2, 3, 4].map((s) => (
            <span
              key={s}
              className={`ob-step-dot ${
                step === s || step === 'preloader'
                  ? 'active'
                  : typeof step === 'number' && s < step
                  ? 'done'
                  : ''
              }`}
              title={`Step ${s} of 4`}
            />
          ))}
          <span className="s12 b muted" style={{ marginLeft: 6 }}>
            {typeof step === 'number' ? `Step ${step} of 4` : 'Finishing setup'}
          </span>
        </div>

        <div className="hright">
          <ThemeToggle />
          <button
            type="button"
            className="btn ghost sm"
            onClick={startPreloaderAndFinish}
            title="Skip to dashboard"
          >
            Skip
          </button>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="ob-stage">
        {step === 'preloader' ? (
          <div className="ob-preloader-stage ob-anim-forward">
            <div className="ob-preloader-visual">
              <div className="ob-orbit-outer" />
              <div className="ob-orbit-middle" />
              <div className="ob-orbit-core">
                <div className="ob-orbit-radar-sweep" />
                <Icon n="radar-line" />
              </div>
            </div>

            <div className="col g8 ac">
              <div className="ob-telemetry-badge">
                <span className="ob-pulse-dot" /> SPATIAL ENGINE ACTIVE
              </div>
              <h1 className="ob-preloader-title">Calibrating Workspace</h1>
              <p className="ob-preloader-status">{PRELOADER_MESSAGES[preloaderIdx]}</p>
            </div>

            <div className="ob-progress-track">
              <div className="ob-progress-bar" style={{ width: `${progress}%` }}>
                <div className="ob-progress-shimmer" />
              </div>
            </div>

            <div className="row sb w100 s12 muted" style={{ maxWidth: '100%', padding: '0 4px' }}>
              <span>Synthesizing catchment models</span>
              <span className="mono b" style={{ color: 'var(--text)' }}>{progress}%</span>
            </div>
          </div>
        ) : (
          <div className={`ob-center-box ${direction === 'forward' ? 'ob-anim-forward' : 'ob-anim-backward'}`}>
            {/* Step 1: Name and Business Name */}
            {step === 1 && (
              <>
                <div className="ob-hero">
                  <span className="ob-badge">
                    <Icon n="user-smile-line" s={14} /> Welcome to Karyakshetram
                  </span>
                  <h1 className="ob-title">Let’s get you started</h1>
                  <p className="ob-sub">
                    Tell us your name and your company name. We tailor every spatial model and catchment metric to your brand.
                  </p>
                </div>

                {err && (
                  <div className="panel pad12 row g8 s13" style={{ background: 'var(--badSoft)', color: 'var(--bad)', borderRadius: 14 }}>
                    <Icon n="error-warning-line" s={18} />
                    <span>{err}</span>
                  </div>
                )}

                <div className="ob-inputs-card">
                  <div className="ob-field">
                    <label className="ob-label">Your Name</label>
                    <div className="ob-input-wrap">
                      <Icon n="user-3-line" s={18} c="var(--muted)" />
                      <input
                        autoFocus
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Introduce yourself"
                        onKeyDown={(e) => e.key === 'Enter' && goNext()}
                      />
                    </div>
                  </div>

                  <div className="ob-field">
                    <label className="ob-label">Name of your company</label>
                    <div className="ob-input-wrap">
                      <Icon n="building-2-line" s={18} c="var(--muted)" />
                      <input
                        value={form.businessName}
                        onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                        placeholder="Name of your company"
                        onKeyDown={(e) => e.key === 'Enter' && goNext()}
                      />
                    </div>
                  </div>

                  <div className="ob-actions">
                    <span className="s13 muted">Only two quick details to start</span>
                    <button type="button" className="ob-btn ink" onClick={goNext}>
                      Continue <Icon n="arrow-right-line" s={16} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: What you do & Type of business + 2 Zig-Zag Auto-Scrolling Rows */}
            {step === 2 && (
              <>
                <div className="ob-hero">
                  <span className="ob-badge">
                    <Icon n="briefcase-4-line" s={14} /> Venture Details
                  </span>
                  <h1 className="ob-title">Tell us about your business</h1>
                  <p className="ob-sub">
                    Describe your business offering and choose your operational format to calibrate catchment footfall.
                  </p>
                </div>

                {err && (
                  <div className="panel pad12 row g8 s13" style={{ background: 'var(--badSoft)', color: 'var(--bad)', borderRadius: 14 }}>
                    <Icon n="error-warning-line" s={18} />
                    <span>{err}</span>
                  </div>
                )}

                {/* Two Fillups Card */}
                <div className="ob-inputs-card">
                  <div className="ob-field">
                    <label className="ob-label">What does your business do?</label>
                    <div className="ob-input-wrap">
                      <Icon n="store-2-line" s={18} c="var(--muted)" />
                      <input
                        autoFocus
                        value={form.businessActivity}
                        onChange={(e) => setForm({ ...form, businessActivity: e.target.value })}
                        placeholder="Tell us what you do..."
                        onKeyDown={(e) => e.key === 'Enter' && goNext()}
                      />
                    </div>
                  </div>

                  <div className="ob-field">
                    <label className="ob-label">Type / Format of your business</label>
                    <div className="ob-input-wrap">
                      <Icon n="git-branch-line" s={18} c="var(--muted)" />
                      <input
                        value={form.businessType}
                        onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                        placeholder="Tell us more about what you do..."
                        onKeyDown={(e) => e.key === 'Enter' && goNext()}
                      />
                    </div>
                  </div>
                </div>

                {/* 2-column vertical grid (column-major order) */}
                <div className="ob-grid-2col" style={{ marginTop: 6 }}>
                  <div className="ob-grid-col">
                    {fmtCol1.map((fmt) => {
                      const active = form.businessType.toLowerCase() === fmt.name.toLowerCase();
                      return (
                        <div
                          key={fmt.id}
                          className={`ob-card ${active ? 'on' : ''}`}
                          onClick={() => selectFormat(fmt)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="ob-card-icon"><Icon n={fmt.icon} /></div>
                          <div className="ob-card-body">
                            <span className="ob-card-title">{fmt.name}</span>
                            <span className="ob-card-sub">{fmt.desc}</span>
                          </div>
                          <div className="ob-card-check">{active && <Icon n="check-line" s={14} />}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="ob-grid-col">
                    {fmtCol2.map((fmt) => {
                      const active = form.businessType.toLowerCase() === fmt.name.toLowerCase();
                      return (
                        <div
                          key={fmt.id}
                          className={`ob-card ${active ? 'on' : ''}`}
                          onClick={() => selectFormat(fmt)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="ob-card-icon"><Icon n={fmt.icon} /></div>
                          <div className="ob-card-body">
                            <span className="ob-card-title">{fmt.name}</span>
                            <span className="ob-card-sub">{fmt.desc}</span>
                          </div>
                          <div className="ob-card-check">{active && <Icon n="check-line" s={14} />}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="ob-actions">
                  <button type="button" className="ob-btn out" onClick={goBack}>
                    <Icon n="arrow-left-line" s={16} /> Back
                  </button>
                  <button type="button" className="ob-btn ink" onClick={goNext}>
                    Continue <Icon n="arrow-right-line" s={16} />
                  </button>
                </div>
              </>
            )}

            {/* Step 3: Checkboxes in 2 Zig-Zag Auto-Scrolling Rows (Row Major Order) */}
            {step === 3 && (
              <>
                <div className="ob-hero">
                  <span className="ob-badge">
                    <Icon n="apps-2-line" s={14} /> Retail Sectors
                  </span>
                  <h1 className="ob-title">What is your business all about?</h1>
                  <p className="ob-sub">
                    Select all sectors that apply. We construct competitive clusters and anchor synergies tailored to these categories.
                  </p>
                </div>

                {err && (
                  <div className="panel pad12 row g8 s13" style={{ background: 'var(--badSoft)', color: 'var(--bad)', borderRadius: 14 }}>
                    <Icon n="error-warning-line" s={18} />
                    <span>{err}</span>
                  </div>
                )}

                {/* 2-column vertical grid (column-major order) */}
                <div className="ob-grid-2col">
                  <div className="ob-grid-col">
                    {catCol1.map((cat) => {
                      const active = form.categories.includes(cat.key);
                      return (
                        <div
                          key={cat.key}
                          className={`ob-card ${active ? 'on' : ''}`}
                          onClick={() => toggleCategory(cat.key)}
                          role="checkbox"
                          aria-checked={active}
                          tabIndex={0}
                        >
                          <div className="ob-card-icon"><Icon n={cat.icon} /></div>
                          <div className="ob-card-body">
                            <span className="ob-card-title">{cat.name}</span>
                            <span className="ob-card-sub">{cat.desc}</span>
                          </div>
                          <div className="ob-card-check">{active && <Icon n="check-line" s={14} />}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="ob-grid-col">
                    {catCol2.map((cat) => {
                      const active = form.categories.includes(cat.key);
                      return (
                        <div
                          key={cat.key}
                          className={`ob-card ${active ? 'on' : ''}`}
                          onClick={() => toggleCategory(cat.key)}
                          role="checkbox"
                          aria-checked={active}
                          tabIndex={0}
                        >
                          <div className="ob-card-icon"><Icon n={cat.icon} /></div>
                          <div className="ob-card-body">
                            <span className="ob-card-title">{cat.name}</span>
                            <span className="ob-card-sub">{cat.desc}</span>
                          </div>
                          <div className="ob-card-check">{active && <Icon n="check-line" s={14} />}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="ob-actions">
                  <button type="button" className="ob-btn out" onClick={goBack}>
                    <Icon n="arrow-left-line" s={16} /> Back
                  </button>
                  <button type="button" className="ob-btn ink" onClick={goNext}>
                    Continue ({form.categories.length} selected) <Icon n="arrow-right-line" s={16} />
                  </button>
                </div>
              </>
            )}

            {/* Step 4: Challenges with top fillup + aesthetic cards */}
            {step === 4 && (
              <>
                <div className="ob-hero">
                  <span className="ob-badge">
                    <Icon n="compass-3-line" s={14} /> Expansion Hurdles
                  </span>
                  <h1 className="ob-title">What challenges do you face?</h1>
                  <p className="ob-sub">
                    Highlight friction points you deal with so Karyakshetram surfaces the right sensitivity and risk analyses.
                  </p>
                </div>

                {err && (
                  <div className="panel pad12 row g8 s13" style={{ background: 'var(--badSoft)', color: 'var(--bad)', borderRadius: 14 }}>
                    <Icon n="error-warning-line" s={18} />
                    <span>{err}</span>
                  </div>
                )}

                {/* Top Fillup for custom challenges */}
                <div className="ob-inputs-card" style={{ padding: '26px 28px', gap: 12 }}>
                  <div className="ob-field">
                    <label className="ob-label">Your biggest retail challenge right now</label>
                    <div className="ob-input-wrap">
                      <Icon n="chat-voice-line" s={18} c="var(--muted)" />
                      <input
                        autoFocus
                        value={form.challengesNote}
                        onChange={(e) => setForm({ ...form, challengesNote: e.target.value })}
                        placeholder="e.g. High commercial rent, cannibalising our stores, unpredictable footfall..."
                      />
                    </div>
                  </div>
                  <span className="s12 muted">Select common industry challenges below:</span>
                </div>

                {/* 2-column vertical grid (column-major order) */}
                <div className="ob-grid-2col">
                  <div className="ob-grid-col">
                    {chalCol1.map((ch) => {
                      const active = form.challenges.includes(ch.label);
                      return (
                        <div
                          key={ch.id}
                          className={`ob-card sm ${active ? 'on' : ''}`}
                          onClick={() => toggleChallenge(ch.label)}
                          role="checkbox"
                          aria-checked={active}
                          tabIndex={0}
                        >
                          <div className="ob-card-icon"><Icon n={ch.icon} /></div>
                          <div className="ob-card-body">
                            <span className="ob-card-title">{ch.label}</span>
                            <span className="ob-card-sub">{ch.desc}</span>
                          </div>
                          <div className="ob-card-check">{active && <Icon n="check-line" s={13} />}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="ob-grid-col">
                    {chalCol2.map((ch) => {
                      const active = form.challenges.includes(ch.label);
                      return (
                        <div
                          key={ch.id}
                          className={`ob-card sm ${active ? 'on' : ''}`}
                          onClick={() => toggleChallenge(ch.label)}
                          role="checkbox"
                          aria-checked={active}
                          tabIndex={0}
                        >
                          <div className="ob-card-icon"><Icon n={ch.icon} /></div>
                          <div className="ob-card-body">
                            <span className="ob-card-title">{ch.label}</span>
                            <span className="ob-card-sub">{ch.desc}</span>
                          </div>
                          <div className="ob-card-check">{active && <Icon n="check-line" s={13} />}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="ob-actions">
                  <button type="button" className="ob-btn out" onClick={goBack}>
                    <Icon n="arrow-left-line" s={16} /> Back
                  </button>
                  <button type="button" className="ob-btn ink" onClick={goNext}>
                    Complete Setup
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
