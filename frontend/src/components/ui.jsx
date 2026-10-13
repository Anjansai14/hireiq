import { useEffect, useState } from 'react';
import { avatarColors, initials, tone } from '../lib/format';

export const Badge = ({ s, children }) => {
  const t = tone(s);
  return <span className="badge" style={{ background: t.bg, color: t.fg }}>{children || s}</span>;
};
export const Stamp = ({ s }) => <span className="stamp" title={{ Observed: 'Measured from a platform or Resolence', Inferred: 'Reasoned by an agent from evidence', Predicted: 'Model output' }[s] || ''}>{s}</span>;

export const Card = ({ title, right, children, style }) => (
  <div className="card" style={style}>
    {(title || right) && <div className="row between" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>{title}</h2>{right}</div>}
    {children}
  </div>
);

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs">
    {tabs.map(([k, label, badge]) => (
      <button key={k} className={`tab ${value === k ? 'on' : ''}`} onClick={() => onChange(k)}>
        {label}{badge ? <span className="badge" style={{ marginLeft: 6, background: 'var(--warning-100)', color: 'var(--warning-800)' }}>{badge}</span> : null}
      </button>
    ))}
  </div>
);

export const Modal = ({ title, onClose, children, footer, wide }) => (
  <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="modal" style={wide ? { maxWidth: 900 } : null}>
      <div className="row between" style={{ marginBottom: 12 }}><h2>{title}</h2><button className="btn sm" onClick={onClose}>✕</button></div>
      {children}
      {footer && <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>{footer}</div>}
    </div>
  </div>
);

export const Kpi = ({ l, v, sub, stamp }) => (
  <div className="card kpi">
    <div className="row between"><span className="l">{l}</span>{stamp && <Stamp s={stamp} />}</div>
    <div className="v">{v}</div>
    {sub && <div className="small muted">{sub}</div>}
  </div>
);

export const Avatar = ({ name, id, size = 32 }) => {
  const [bg, fg] = avatarColors(id || name);
  return <div className="avatar" style={{ background: bg, color: fg, width: size, height: size }}>{initials(name)}</div>;
};

export const Field = ({ label, help, err, req, badge, children }) => (
  <div className="field">
    {label && <label>{label}{req && <span style={{ color: 'var(--danger-600)' }}>*</span>}{badge}</label>}
    {children}
    {err ? <span className="err">{err}</span> : help ? <span className="help">{help}</span> : null}
  </div>
);

export const Select = ({ value, onChange, options, placeholder = 'Choose one' }) => (
  <select className="input" value={value || ''} onChange={(e) => onChange(e.target.value)}>
    <option value="">{placeholder}</option>
    {options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
);

export const Chips = ({ value = [], options, onChange }) => (
  <div className="chips">
    {options.map((o) => {
      const on = value.includes(o);
      return <button type="button" key={o} className={`chip ${on ? 'on' : ''}`} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}>{o}</button>;
    })}
  </div>
);

export const Empty = ({ children }) => <div className="empty">{children}</div>;
export const Spinner = () => <span className="spin" />;
export const Loading = () => <div className="empty"><Spinner /> Loading…</div>;
export const ErrorBox = ({ error }) => <div className="alert" style={{ background: 'var(--danger-100)', color: 'var(--danger-800)' }}>{error?.message || String(error)}</div>;

/** Agent progress panel: shows the agent's stages while the request runs. */
export function AgentLoader({ title, agent, steps }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 700); return () => clearInterval(t); }, [steps.length]);
  return (
    <div className="card loader">
      <h2>{title}</h2>
      <div className="small muted" style={{ marginBottom: 12 }}>{agent}</div>
      {steps.map((s, k) => <div key={s} className={`ln ${k < i ? 'done' : ''}`}>{k < i ? '✓' : k === i ? <Spinner /> : '○'} {s}</div>)}
    </div>
  );
}

export const AlertRow = ({ level, title, sub, onClick, cta }) => {
  const t = tone(level === 'danger' ? 'Fail' : 'Warning');
  return (
    <div className="alert" style={{ background: t.bg, color: t.fg, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <span>{level === 'danger' ? '●' : '▲'}</span>
      <div style={{ flex: 1 }}><b>{title}</b>{sub && <div className="small">{sub}</div>}</div>
      {cta && <span className="small" style={{ fontWeight: 600 }}>{cta} →</span>}
    </div>
  );
};

export const Bar = ({ v, max = 100 }) => <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, (v / (max || 1)) * 100))}%` }} /></div>;

/** Enrolments vs frozen prediction band (SVG, no chart library). */
export function BandChart({ series, height = 220 }) {
  if (!series) return null;
  const { pts, band } = series;
  const W = 760, H = height, P = 32;
  const maxY = Math.max(1, ...band.map((b) => b.hi), ...pts.map((p) => p.v)) * 1.1;
  const x = (i) => P + (i / Math.max(1, band.length - 1)) * (W - P * 2);
  const y = (v) => H - P - (v / maxY) * (H - P * 2);
  const area = band.map((b, i) => `${x(i)},${y(b.hi)}`).join(' ') + ' ' + [...band].reverse().map((b, i) => `${x(band.length - 1 - i)},${y(b.lo)}`).join(' ');
  const line = pts.map((p, i) => `${x(i)},${y(p.v)}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Enrolments vs frozen prediction">
      {ticks.map((t) => <g key={t}><line x1={P} x2={W - P} y1={y(t)} y2={y(t)} stroke="#EEF3F2" /><text x={4} y={y(t) + 4} fontSize="10" fill="#7F9190">{t}</text></g>)}
      <polygon points={area} fill="#CFEDE4" opacity=".7" />
      <polyline points={line} fill="none" stroke="#0F766E" strokeWidth="2.5" />
      {pts.length > 0 && <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1].v)} r="4" fill="#0F766E" />}
      <text x={P} y={H - 8} fontSize="10" fill="#7F9190">{band[0]?.day}</text>
      <text x={W - P} y={H - 8} fontSize="10" fill="#7F9190" textAnchor="end">{band[band.length - 1]?.day}</text>
    </svg>
  );
}
