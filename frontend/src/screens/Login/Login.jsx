import React, { useState } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';

export default function Login() {
  const { HQ, s } = useHQ();
  const [email, setEmail] = useState('anika.rao@peopletech.com');
  const [pw, setPw] = useState('password123');
  const [pw2, setPw2] = useState('');
  const [fullName, setFullName] = useState('');
  const [mode, setMode] = useState('signin');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loginErr, setLoginErr] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const isUser = !!s.user;
  const isModule = isUser && !s.module;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) return setLoginErr('Enter a valid work email address.');
    if (mode === 'signup' && !fullName.trim()) return setLoginErr('Enter your full name.');
    if (pw.length < 6) return setLoginErr(mode === 'signup' ? 'Use a password of at least 6 characters.' : 'Email or password is incorrect. Passwords have at least 6 characters.');
    if (mode === 'signup' && pw !== pw2) return setLoginErr('Passwords do not match.');

    setLoading(true);
    setLoginErr('');
    setForgotSent(false);

    setTimeout(() => {
      HQ.set(z => {
        z.user = {
          name: mode === 'signup' ? fullName.trim() : 'Anika Rao',
          email,
          role: 'Manager',
          title: 'Campaign manager'
        };
        z.module = 'hire';
        z.route = { name: 'dashboard' };
      });
      setLoading(false);
      HQ.toast(`Welcome back, ${mode === 'signup' ? fullName.trim().split(' ')[0] : 'Anika'}!`);
    }, 600);
  };

  // If already logged in and at module chooser
  if (isModule) {
    const firstName = (s.user?.name || '').split(' ')[0];
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: '32px', animation: 'fadein .3s', background: 'var(--ink-25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex' }}><Icon name="logo-mark" size={40} /></span>
          <span style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-.025em' }}>
            Influence<span style={{ color: 'var(--teal-600)' }}>IQ</span>
          </span>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 600, margin: '0 0 6px', letterSpacing: '-.015em' }}>
            Welcome back, {firstName}
          </h1>
          <p style={{ margin: 0, color: 'var(--ink-600)' }}>Choose a module. We'll remember it next time.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 320px))', gap: '20px' }}>
          {/* Screen IQ Card */}
          <button
            onClick={() => {
              HQ.toast('Screen IQ is the film release module. Opening Hire IQ for skilling.');
              HQ.set(z => {
                z.module = 'hire';
                z.route = { name: 'dashboard' };
              });
            }}
            style={{
              textAlign: 'left',
              background: '#fff',
              border: '1px solid var(--ink-100)',
              borderRadius: '16px',
              padding: '24px',
              cursor: 'pointer',
              boxShadow: 'var(--e-1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              transition: 'box-shadow .2s, border-color .2s'
            }}
          >
            <span style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--screen-tint)', color: 'var(--screen)', display: 'grid', placeItems: 'center' }}>
              <Icon name="i-scan" size={24} />
            </span>
            <span style={{ fontSize: '20px', fontWeight: 600 }}>Screen IQ</span>
            <span style={{ color: 'var(--ink-600)' }}>
              Film and release promotion: briefs, creator campaigns, tracking and insights.
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--teal-700)', fontWeight: 600 }}>
              Open Screen IQ <Icon name="i-arrow" size={16} />
            </span>
          </button>

          {/* Hire IQ Card */}
          <button
            onClick={() => {
              HQ.set(z => {
                z.module = 'hire';
                z.route = { name: 'dashboard' };
              });
            }}
            style={{
              textAlign: 'left',
              background: '#fff',
              border: '1px solid var(--hire)',
              borderRadius: '16px',
              padding: '24px',
              cursor: 'pointer',
              boxShadow: 'var(--e-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              transition: 'box-shadow .2s, border-color .2s'
            }}
          >
            <span style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--hire-tint)', color: 'var(--hire)', display: 'grid', placeItems: 'center' }}>
              <Icon name="i-brief" size={24} />
            </span>
            <span style={{ fontSize: '20px', fontWeight: 600 }}>Hire IQ</span>
            <span style={{ color: 'var(--ink-600)' }}>
              Skilling and hiring: course briefs, cohort micro-campaigns, tracked enrolments and insights.
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--teal-700)', fontWeight: 600 }}>
              Open Hire IQ <Icon name="i-arrow" size={16} />
            </span>
          </button>
        </div>

        <button
          onClick={() => HQ.set(z => { z.user = null; })}
          style={{ border: 0, background: 'none', color: 'var(--ink-500)', cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center' }}
        >
          <Icon name="i-logout" size={16} /> Sign out
        </button>
      </div>
    );
  }

  // Not logged in: Full Login Portal
  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)', background: '#fff' }}>
      {/* Left Column */}
      <div style={{ background: 'var(--ink-900)', color: '#fff', padding: '48px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex' }}><Icon name="logo-mark" size={36} /></span>
          <span style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-.025em' }}>
            Influence<span style={{ color: 'var(--teal-300)' }}>IQ</span>
          </span>
        </div>

        <div style={{ maxWidth: '460px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '28px', padding: '0 10px 0 6px', borderRadius: '8px', background: 'rgba(255,255,255,.08)', fontSize: '13px', fontWeight: 600, marginBottom: '20px' }}>
            <span style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'var(--screen)', display: 'grid', placeItems: 'center' }}>
              <Icon name="i-scan" size={13} />
            </span>
            Screen IQ · film and release promotion
          </div>
          <h1 style={{ fontSize: '40px', lineHeight: '48px', fontWeight: 600, letterSpacing: '-.02em', margin: '0 0 16px' }}>
            Decide which creators carry which story to which audience.
          </h1>
          <p style={{ fontSize: '16px', lineHeight: '26px', color: 'var(--ink-200)', margin: 0 }}>
            Plan a release campaign in minutes, track every post, and prove what it delivered, with every number stamped by how we know it.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '28px', fontSize: '13px', color: 'var(--ink-300)' }}>
          <span>Observed</span>
          <span>Inferred</span>
          <span>Predicted</span>
        </div>
      </div>

      {/* Right Column */}
      <div style={{ display: 'grid', placeItems: 'center', padding: '48px 32px' }}>
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '24px', lineHeight: '32px', fontWeight: 600, margin: '0 0 4px', letterSpacing: '-.01em' }}>
              {mode === 'signup' ? 'Create your account' : 'Sign in'}
            </h2>
            <p style={{ margin: 0, color: 'var(--ink-600)' }}>
              {mode === 'signup' ? 'Set up your InfluenceIQ work account.' : 'Use your InfluenceIQ work account.'}
            </p>
          </div>

          {loginErr && (
            <div style={{ display: 'flex', gap: '10px', padding: '12px 14px', borderRadius: '8px', background: 'var(--danger-100)', border: '1px solid #F2C6BF', color: 'var(--danger-800)' }}>
              <Icon name="i-alert" size={18} />
              <span>{loginErr}</span>
            </div>
          )}

          {forgotSent && (
            <div style={{ display: 'flex', gap: '10px', padding: '12px 14px', borderRadius: '8px', background: 'var(--success-100)', border: '1px solid #BFE3CE', color: 'var(--success-800)' }}>
              <Icon name="i-mail" size={18} />
              <span>Reset link sent to {email}. It expires in 30 minutes.</span>
            </div>
          )}

          {mode === 'signup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Full name</label>
              <input
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setLoginErr(''); }}
                placeholder="e.g. Anika Rao"
                style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Work email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setLoginErr(''); }}
              placeholder="name@company.com"
              style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Password</label>
              {mode !== 'signup' && (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!/^\S+@\S+\.\S+$/.test(email)) return setLoginErr('Enter your work email first, then choose Forgot password.');
                    setForgotSent(true);
                    setLoginErr('');
                  }}
                  style={{ fontSize: '13px', whiteSpace: 'nowrap', color: 'var(--teal-700)' }}
                >
                  Forgot password?
                </a>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={(e) => { setPw(e.target.value); setLoginErr(''); }}
                placeholder="At least 6 characters"
                style={{ width: '100%', height: '40px', padding: '0 40px 0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                aria-label="Show password"
                style={{ position: 'absolute', right: '4px', top: '4px', width: '32px', height: '32px', border: 0, background: 'none', borderRadius: '6px', cursor: 'pointer', color: 'var(--ink-500)', display: 'grid', placeItems: 'center' }}
              >
                <Icon name="i-eye" size={18} />
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Confirm password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={pw2}
                onChange={(e) => { setPw2(e.target.value); setLoginErr(''); }}
                placeholder="Repeat the password"
                style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
              />
            </div>
          )}

          <label style={{ display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={() => setRemember(!remember)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--teal-700)', margin: 0 }}
            />
            Remember me for 30 days
          </label>

          <button
            type="submit"
            style={{
              height: '48px',
              border: 0,
              borderRadius: '8px',
              background: 'var(--teal-700)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            {loading && <span style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', animation: 'spin .8s linear infinite' }}></span>}
            {loading ? (mode === 'signup' ? 'Creating account…' : 'Signing in…') : (mode === 'signup' ? 'Create account' : 'Sign in')}
          </button>

          <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink-600)' }}>
            {mode === 'signup' ? 'Already have an account?' : 'New to InfluenceIQ?'}{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setMode(mode === 'signup' ? 'signin' : 'signup');
                setLoginErr('');
                setForgotSent(false);
              }}
              style={{ fontWeight: 600, color: 'var(--teal-700)' }}
            >
              {mode === 'signup' ? 'Sign in' : 'Create an account'}
            </a>
          </p>

          <p style={{ margin: 0, fontSize: '12px', color: 'var(--ink-500)' }}>
            Prototype: any email and a password of 6+ characters works.
          </p>
        </form>
      </div>
    </div>
  );
}
