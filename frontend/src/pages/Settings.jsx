import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAction, useApp, useLoad } from '../lib/app';
import { d, inr } from '../lib/format';
import { Badge, Card, Loading, Tabs } from '../components/ui';

export default function Settings() {
  const { tab = 'connectors' } = useParams();
  const nav = useNavigate();
  const { user, cfg } = useApp();
  const admin = ['Admin', 'Fairness reviewer'].includes(user?.role);
  const tabs = [['connectors', 'Connectors'], ['ratecard', 'Rate card'], ['agents', 'Agents'], ['config', 'Configuration'], ...(admin ? [['escalations', 'Fairness escalations']] : []), ['profile', 'Profile']];
  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><div className="muted">Company-wide: connectors and the rate card apply to every course.</div></div></div>
      <Tabs value={tab} onChange={(t) => nav(`/settings/${t}`)} tabs={tabs} />
      {tab === 'connectors' && <Connectors />}
      {tab === 'ratecard' && <RateCard />}
      {tab === 'agents' && <Agents />}
      {tab === 'config' && <Config cfg={cfg} />}
      {tab === 'escalations' && <Escalations />}
      {tab === 'profile' && <Card title="Profile"><dl className="kv" style={{ gridTemplateColumns: '80px 1fr' }}><dt>Name</dt><dd>{user.name}</dd><dt>Email</dt><dd>{user.email}</dd><dt>Role</dt><dd>{user.role}</dd><dt>Title</dt><dd>{user.title}</dd></dl></Card>}
    </>
  );
}

function Connectors() {
  const { data, loading, reload } = useLoad(() => api.get('/settings/connectors'), []);
  const [run, busy] = useAction();
  if (loading && !data) return <Loading />;
  return (
    <Card>
      {data.map((c) => (
        <div key={c.id} className="row between" style={{ padding: '12px 0', borderBottom: '1px solid var(--ink-50)' }}>
          <div><div className="row"><b>{c.name}</b><span className="small muted">{c.kind}</span><Badge s={c.status} /></div><div className="small muted">{c.detail}</div>{c.last_sync && <div className="small muted">Last sync {d(c.last_sync)}{c.quota != null && ` · ${c.quota}% of daily quota`}</div>}</div>
          <div className="row">
            <button className="btn sm" disabled={busy} onClick={() => run(() => api.post(`/settings/connectors/${c.id}/test`)).then((r) => r && alert(r.ok ? 'Connection OK' : `Not connected (${r.status})`))}>Test</button>
            {!['Unsupported', 'Upload only'].includes(c.status) && <button className="btn sm" disabled={busy} onClick={() => { const token = prompt('Paste the new token (stored encrypted)'); if (token !== null) run(() => api.post(`/settings/connectors/${c.id}/connect`, { token }), 'Connected').then(reload); }}>{c.status === 'Connected' ? 'Reconnect' : 'Connect'}</button>}
          </div>
        </div>
      ))}
      <p className="small muted" style={{ marginTop: 12 }}>Data comes only from official APIs, source-authorised access, licensed vendors and uploads. No scraping. Tokens are encrypted at rest; alerts fire 7 days before expiry.</p>
    </Card>
  );
}

function RateCard() {
  const { data, loading } = useLoad(() => api.get('/settings/ratecard'), []);
  if (loading && !data) return <Loading />;
  return (
    <>
      <Card title="Tiers" right={<span className="small muted">A tier becomes Observed after {data.rule?.bookings} bookings across {data.rule?.courses} courses</span>}>
        <table><thead><tr><th>Tier</th><th>Followers</th><th>Low (₹/post)</th><th>High (₹/post)</th><th>Provenance</th><th>Bookings</th></tr></thead>
          <tbody>{data.tiers.map((t) => <tr key={t.id}><td><b>{t.tier}</b></td><td>{t.range_label}</td><td>{inr(t.lo)}</td><td>{inr(t.hi)}</td><td><Badge s={t.prov} /></td><td>{t.bookings} across {t.courses}</td></tr>)}</tbody></table>
      </Card>
      <Card title="Recent observations"><table><thead><tr><th>Date</th><th>Source</th><th>Course</th><th>Fee</th><th>Posts</th><th>Tier</th></tr></thead><tbody>{data.observations.map((o) => <tr key={o.id}><td>{d(o.date)}</td><td>{o.source}</td><td>{o.course}</td><td>{inr(o.rate)}</td><td>{o.posts}</td><td>{o.tier}</td></tr>)}</tbody></table></Card>
    </>
  );
}

function Agents() {
  const { data, loading } = useLoad(() => Promise.all([api.get('/agents'), api.get('/agents/runs')]), []);
  if (loading && !data) return <Loading />;
  const [{ health, agents }, runs] = data;
  return (
    <div className="grid g2">
      <Card title="AI service" right={<Badge s={health.ok ? 'Connected' : 'Failed'} />}>
        <p className="small" style={{ marginBottom: 10 }}>{health.llm ? `LLM enabled (${health.model})` : 'Running in deterministic mode: set ANTHROPIC_API_KEY in ai-service/.env to enable Claude for A1, A2, A5, A8, A11, A12 and Copilot.'}</p>
        {(agents || []).map((a) => <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--ink-50)' }}><b>{a.id} · {a.name}</b> <span className="small muted">{a.kind}</span><div className="small muted">{a.doc}</div></div>)}
      </Card>
      <Card title="Recent agent runs">
        <table><thead><tr><th>Agent</th><th>Entity</th><th>ms</th><th>LLM</th><th>Status</th></tr></thead><tbody>{runs.slice(0, 40).map((r) => <tr key={r.id}><td>{r.agent}</td><td className="small">{r.entity_type} {r.entity_id}</td><td>{r.duration_ms}</td><td>{r.llm_used ? 'yes' : '—'}</td><td><Badge s={r.status === 'ok' ? 'Pass' : 'Fail'}>{r.status}</Badge></td></tr>)}</tbody></table>
      </Card>
    </div>
  );
}

function Config({ cfg }) {
  return (
    <div className="grid g2">
      <Card title="Lookups (from database)">
        {Object.entries(cfg.lookups).map(([k, v]) => <div key={k} style={{ marginBottom: 8 }}><b className="small">{k}</b><div className="small muted">{v.map((x) => x.label || x.code).join(' · ')}</div></div>)}
      </Card>
      <div>
        <Card title="Governance rules">{cfg.rules.map((r) => <div key={r.code} style={{ marginBottom: 8 }}><b>{r.code}</b> {r.title} <Badge s={r.enforcement === 'Refuse' || r.enforcement === 'Block' ? 'Fail' : 'Warning'}>{r.enforcement}</Badge><div className="small muted">{r.description}</div></div>)}</Card>
        <Card title="Thresholds">{Object.entries(cfg.settings).map(([k, v]) => <div key={k} className="small" style={{ marginBottom: 4 }}><b>{k}</b>: <span className="mono">{JSON.stringify(v)}</span></div>)}</Card>
      </div>
    </div>
  );
}

function Escalations() {
  const { data, loading, reload } = useLoad(() => api.get('/settings/escalations'), []);
  const [run] = useAction();
  if (loading && !data) return <Loading />;
  return (
    <Card title="Fairness escalations (RR-H01, RR-H02)">
      <table><thead><tr><th>When</th><th>Rule</th><th>Context</th><th>Request</th><th>Status</th><th /></tr></thead>
        <tbody>{data.map((e) => <tr key={e.id}><td className="small">{d(e.created_at)}</td><td>{e.rule_code}</td><td className="small">{e.context}</td><td className="small">{e.request}</td><td><Badge s={e.status === 'Open' ? 'Warning' : 'Pass'}>{e.status}</Badge></td><td>{e.status === 'Open' && <button className="btn sm" onClick={() => run(() => api.patch(`/settings/escalations/${e.id}`, { status: 'Reviewed' }), 'Marked reviewed').then(reload)}>Mark reviewed</button>}</td></tr>)}</tbody></table>
    </Card>
  );
}
