import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, useToast } from '../lib/state.jsx';
import { fieldErrors } from '../lib/api.js';
import { Icon, ThemeToggle, Field, Banner, Check, AbstractArtBackground } from '../components/ui.jsx';

function strength(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || /[A-Z]/.test(p)) s++;
  return s;
}

const SAMPLE_EMAIL = 'userkaryakshetram@gmail.com';
const SAMPLE_PASSWORD = 'user@123';

export default function Auth({ mode }) {
  const signup = mode === 'signup';
  const { login, register } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get('next');
  const [f, setF] = useState({ name: '', email: '', password: '', accept: false, remember: true });
  const [errs, setErrs] = useState({});
  const [banner, setBanner] = useState(
    sp.get('expired') ? { tone: 'warn', text: 'Your session expired. Sign in again; we’ll take you back to the same page.' } : null
  );
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrs((e) => ({ ...e, [k]: undefined }));
  };


  const submit = async (e) => {
    e?.preventDefault?.();
    const local = {};
    if (signup && f.name.trim().length < 2) local.name = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) local.email = 'Enter a valid email address';
    if (signup && (f.password.length < 8 || !/\d/.test(f.password))) local.password = 'At least 8 characters with a number';
    if (!signup && !f.password) local.password = 'Enter your password';
    if (signup && !f.accept) local.accept = 'Please accept the terms to continue';
    setErrs(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    setBanner(null);
    try {
      const u = signup
        ? await register({ name: f.name, email: f.email, password: f.password, acceptTerms: true })
        : await login(f.email, f.password, f.remember);
      if (!u.profile?.completed) nav('/onboarding');
      else nav(next && next.startsWith('/') ? next : '/app');
    } catch (err) {
      const fe = fieldErrors(err);
      if (err.code === 'EMAIL_TAKEN') setBanner({ tone: 'warn', text: err.message, link: true });
      else if (['INVALID_CREDENTIALS', 'ACCOUNT_LOCKED'].includes(err.code)) setBanner({ tone: 'bad', text: err.message });
      else if (!Object.keys(fe).length) setBanner({ tone: 'bad', text: err.message });
      setErrs({
        name: fe.name,
        email: fe.email,
        password: err.code === 'INVALID_CREDENTIALS' ? 'Password is incorrect' : fe.password,
      });
    } finally {
      setBusy(false);
    }
  };

  const s = strength(f.password);

  return (
    <div className="page auth-page" style={{ position: 'relative', overflowX: 'hidden' }}>
      <AbstractArtBackground />
      <header className="hdr" style={{ position: 'relative', zIndex: 10 }}>
        <div className="hleft">
          <Link to="/" className="iconbtn auth-back-btn" aria-label="Back">
            <Icon n="arrow-left-line" />
          </Link>
        </div>
        <Link to="/" className="logo">
          Karyakshetram<i>.</i>
        </Link>
        <div className="hright">
          <ThemeToggle />
        </div>
      </header>

      <main className="auth-stage">
        <div className="auth-card-wrap">
          <form className="card pad32 col g16 auth-card" onSubmit={submit} noValidate>
            <div className="col g6">
              <h1 className="h2">{signup ? 'Create your account' : 'Sign in'}</h1>
              <p className="s13 muted">
                {signup
                  ? 'Five short steps after this set up your business profile.'
                  : 'Welcome back. Pick up where you left off.'}
              </p>
            </div>

            {banner && (
              <Banner tone={banner.tone} icon="error-warning-line">
                {banner.text} {banner.link && <Link to="/login" className="b">Sign in</Link>}
              </Banner>
            )}

            <button
              type="button"
              className="btn out lg"
              style={{ width: '100%' }}
              onClick={() =>
                toast('Google sign-in is not configured on this server yet. Use email.', {
                  tone: 'info',
                  icon: 'information-line',
                })
              }
            >
              <Icon n="google-fill" s={18} />
              Continue with Google
            </button>

            <div className="row g10 s12 muted">
              <span className="divider f1" />
              or
              <span className="divider f1" />
            </div>

            {signup && (
              <Field
                label="Full name"
                icon="user-line"
                value={f.name}
                onChange={set('name')}
                error={errs.name}
                inputProps={{ autoComplete: 'name' }}
              />
            )}

            <Field
              label="Work email"
              icon="mail-line"
              value={f.email}
              onChange={set('email')}
              error={errs.email}
              type="email"
              inputProps={{ autoComplete: 'email' }}
            />

            <div className="field">
              <label htmlFor="pw">Password</label>
              <div className={`input ${errs.password ? 'err' : ''}`}>
                <Icon n="lock-line" s={16} c="var(--muted)" />
                <input
                  id="pw"
                  type={show ? 'text' : 'password'}
                  value={f.password}
                  onChange={(e) => set('password')(e.target.value)}
                  autoComplete={signup ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="pw-toggle-btn"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  <Icon n={show ? 'eye-off-line' : 'eye-line'} s={16} c="var(--muted)" />
                </button>
              </div>

              {signup && f.password && (
                <div className="row g4">
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 2,
                        background: i <= s ? (s >= 3 ? 'var(--ok)' : 'var(--warn)') : 'var(--surface2)',
                      }}
                    />
                  ))}
                </div>
              )}

              {errs.password ? (
                <span className="help err">
                  <Icon n="error-warning-line" s={14} />
                  {errs.password}
                </span>
              ) : (
                signup && (
                  <span className="help">
                    {s >= 3 ? 'Strong' : s === 2 ? 'Fair' : 'Weak'} · 8+ characters with a number
                  </span>
                )
              )}
            </div>

            {signup ? (
              <div className="col g4">
                <Check
                  on={f.accept}
                  onClick={() => set('accept')(!f.accept)}
                  label={
                    <span className="muted s12" style={{ textAlign: 'left' }}>
                      I agree to the Terms and conditions of Karyakshetram retail intelligence.
                    </span>
                  }
                />
                {errs.accept && (
                  <span className="help err">
                    <Icon n="error-warning-line" s={14} />
                    {errs.accept}
                  </span>
                )}
              </div>
            ) : (
              <div className="row sb s13 ac">
                <Check on={f.remember} onClick={() => set('remember')(!f.remember)} label="Keep me signed in" />
                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={() =>
                    toast('Password reset email is not configured on this server. Ask an admin to reset it.', {
                      tone: 'info',
                      icon: 'information-line',
                    })
                  }
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button className="btn ink lg" style={{ width: '100%' }} disabled={busy}>
              {busy && <Icon n="loader-4-line" className="spin" />}
              {signup ? 'Create account' : 'Sign in'}
            </button>

            {!signup && (
              <div className="sample-cred-card">
                <div className="row g6 ac" style={{ marginBottom: 4 }}>
                  <span className="tag acc">Sample Credentials</span>
                  <span className="s12 muted">Fill these to test sign in</span>
                </div>
                <div className="row sb ac wrap g8 s12" style={{ borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
                  <span className="muted">
                    Email: <b style={{ color: 'var(--text)' }}>{SAMPLE_EMAIL}</b>
                  </span>
                  <span className="muted">
                    Password: <b style={{ color: 'var(--text)' }}>{SAMPLE_PASSWORD}</b>
                  </span>
                </div>
              </div>
            )}

            <div className="s13 muted" style={{ textAlign: 'center', marginTop: 4 }}>
              {signup ? (
                <>
                  Already have an account?{' '}
                  <Link
                    to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
                    className="auth-switch-link"
                  >
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  New to Karyakshetram?{' '}
                  <Link to="/signup" className="auth-switch-link">
                    Create an account
                  </Link>
                </>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

