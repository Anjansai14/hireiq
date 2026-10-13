import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../lib/app';
import { Field } from '../components/ui';

export default function Login() {
  const { login, user } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState('anika.rao@peopletech.com');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await login(email, pw); nav('/'); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div className="brand" style={{ color: '#fff', padding: 0 }}><span className="dot">IQ</span>Influence IQ</div>
        <h1 style={{ fontSize: 32, lineHeight: 1.2 }}>Hire IQ · skilling and hiring</h1>
        <p style={{ color: 'var(--ink-200)', maxWidth: 460 }}>Decide which trusted sources carry which story to which cohort. Plan a cohort micro-campaign in minutes, track every post to screening enrolments, and prove what it delivered, with every number stamped by how we know it.</p>
        <div className="row"><span className="badge" style={{ background: '#E6F5EC', color: '#14582F' }}>Observed</span><span className="badge" style={{ background: '#E6EFFA', color: '#183F6E' }}>Inferred</span><span className="badge" style={{ background: '#E6EFFA', color: '#183F6E' }}>Predicted</span></div>
      </div>
      <div className="login-form">
        <form onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 380 }}>
          <h1 style={{ marginBottom: 4 }}>Sign in</h1>
          <p className="muted" style={{ marginBottom: 16 }}>Use your Influence IQ work account.</p>
          <div className="stack">
            <Field label="Work email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="Password" err={err}><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} /></Field>
            <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <p className="small muted">Seeded accounts use the password <span className="mono">Hireiq@123</span>.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
