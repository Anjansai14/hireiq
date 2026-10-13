import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAction, useApp, useLoad } from '../lib/app';
import { d, inr, n } from '../lib/format';
import { Avatar, Badge, Bar, Card, ErrorBox, Field, Kpi, Loading, Tabs } from '../components/ui';

export default function SourceProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const { lookup } = useApp();
  const { data: s, loading, error, setData } = useLoad(() => api.get(`/sources/${id}`), [id]);
  const [tab, setTab] = useState('overview');
  const [run, busy] = useAction();
  const [consent, setConsent] = useState({ basis: '', date: '' });
  if (loading && !s) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const inst = lookup('source_type').some((t) => t.code === s.type && t.meta?.institutional);
  const top = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="page-head">
        <div className="row"><Avatar name={s.name} id={s.id} size={48} /><div>
          <div className="row"><h1>{s.name}</h1><Badge s={s.status} /></div>
          <div className="small muted">{s.handle} · {s.platform} · {s.acct} account · {s.type} · {s.tier}</div>
          <div className="small muted">Last updated {d(s.updated_on)} · next refresh {s.next_refresh || '—'} · source {s.data_source}</div>
        </div></div>
        <div className="row"><button className="btn" disabled={busy} onClick={() => run(() => api.post(`/sources/${id}/refresh`), 'Agent A3 refreshed this profile').then((r) => r && setData(r))}>{busy ? 'Refreshing…' : '↻ Refresh (Agent A3)'}</button><button className="btn" onClick={() => nav('/creators')}>Back</button></div>
      </div>
      {s.status_note && <div className="alert" style={{ background: 'var(--warning-100)', color: 'var(--warning-800)', marginBottom: 16 }}>{s.status_note}</div>}
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Kpi l={s.catchment ? 'Catchment' : 'Followers'} v={n(s.catchment || s.followers)} sub={s.catchment ? 'Uploaded' : `growth ${s.growth ?? '—'}%`} stamp={s.catchment ? null : 'Observed'} />
        <Kpi l="Median views" v={n(s.median_views)} sub={s.er ? `${s.er}% engagement` : 'tracked link only'} stamp="Observed" />
        <Kpi l="Attributed enrolments" v={s.attributed} sub="past batches" stamp="Observed" />
        <Kpi l="Fee per post" v={inr(s.rate)} sub={s.rate_src} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['overview', 'Overview'], ['content', 'Content'], ['commercials', 'Commercials'], ['activity', 'Activity']]} />
      {tab === 'overview' && (
        <div className="grid g2">
          <div>
            <Card title="Audience by district" right={<span className="stamp">Observed</span>}>{top(s.markets).map(([k, v]) => <div key={k} style={{ marginBottom: 6 }}><div className="row between small"><span>{k}</span><span>{v}%</span></div><Bar v={v} /></div>)}</Card>
            <Card title="Languages">{top(s.langs).map(([k, v]) => <div key={k} className="row between small"><span>{k}</span><span>{v}%</span></div>)}</Card>
          </div>
          <div>
            <Card title="Profile">
              <dl className="kv" style={{ gridTemplateColumns: '130px 1fr' }}>
                <dt>Affiliation</dt><dd>{s.affiliation || '—'}</dd><dt>Cohort</dt><dd>{s.cohort || '—'}</dd><dt>Tone</dt><dd>{s.tone} <span className="stamp">AI-inferred</span></dd>
                <dt>Content</dt><dd>{(s.content_types || []).join(', ')}</dd><dt>Formats</dt><dd>{(s.formats || []).join(', ')}</dd>
                <dt>Skill authority</dt><dd>{top(s.topics).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(' · ')}</dd>
                <dt>Verification</dt><dd>{s.verif}</dd><dt>Contact</dt><dd>{s.contact?.manager} {s.contact?.email && `· ${s.contact.email}`}</dd>
              </dl>
            </Card>
            {inst && (
              <Card title="Partnership and consent (RR-H06)" right={<Badge s={s.consent} />}>
                {s.consent === 'Recorded' ? <p className="small">{s.consent_basis} · {d(s.consent_date)}</p> : (
                  <>
                    <p className="small muted" style={{ marginBottom: 8 }}>No consent record. This source cannot move to Confirmed until consent is recorded.</p>
                    <div className="grid g2"><Field label="Consent basis"><input className="input" value={consent.basis} onChange={(e) => setConsent({ ...consent, basis: e.target.value })} /></Field><Field label="Consent date"><input className="input" type="date" value={consent.date} onChange={(e) => setConsent({ ...consent, date: e.target.value })} /></Field></div>
                    <button className="btn primary" style={{ marginTop: 8 }} disabled={!consent.basis || !consent.date || busy} onClick={() => run(() => api.post(`/sources/${id}/consent`, consent), 'Consent recorded').then((r) => r && setData(r))}>Record consent</button>
                  </>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
      {tab === 'content' && <Card title="Recent posts"><table><thead><tr><th>Title</th><th>Date</th><th>Format</th><th>Views</th><th>Clicks</th><th>ER</th></tr></thead><tbody>{s.recent.map((r) => <tr key={r.id}><td>{r.title}</td><td>{d(r.date)}</td><td>{r.format}</td><td>{n(r.views)}</td><td>{n(r.clicks)}</td><td>{r.er ? `${r.er}%` : '—'}</td></tr>)}</tbody></table></Card>}
      {tab === 'commercials' && (
        <>
          <Card title="History with this team"><table><thead><tr><th>Course</th><th>Campaign</th><th>Date</th><th>Status</th><th>Fee</th><th>Enrolments</th><th>Rating</th></tr></thead><tbody>{s.history.map((h) => <tr key={h.id}><td>{h.course}</td><td>{h.campaign}</td><td>{d(h.date)}</td><td><Badge s={h.status} />{h.note && <div className="small muted">{h.note}</div>}</td><td>{inr(h.fee)}</td><td>{h.enrols ?? '—'}</td><td>{h.rating ?? '—'}</td></tr>)}</tbody></table>{!s.history.length && <div className="muted">No history with this team.</div>}</Card>
          <Card title="Current bookings">{s.bookings.map((b) => <div key={b.id} className="row between" style={{ padding: '6px 0' }}><a onClick={() => nav(`/campaigns/${b.campaign_id}/sources/${b.id}`)}>{b.campaign}</a><Badge s={b.status} /></div>)}{!s.bookings.length && <div className="muted">Not on any campaign.</div>}</Card>
        </>
      )}
      {tab === 'activity' && <Card title="Activity">{s.activity.map((a, i) => <div key={i} className="small" style={{ padding: '4px 0' }}><span className="muted">{d(a.date)}</span> · {a.text}</div>)}</Card>}
    </>
  );
}
