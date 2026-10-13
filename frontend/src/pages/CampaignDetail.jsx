import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAction, useApp, useLoad } from '../lib/app';
import { d, ds, inr, inrL, n, pct, range } from '../lib/format';
import { AlertRow, Avatar, Badge, BandChart, Card, ErrorBox, Kpi, Loading, Modal, Select, Stamp, Tabs } from '../components/ui';

export default function CampaignDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { opts } = useApp();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'overview';
  const { data: c, loading, error, setData } = useLoad(() => api.get(`/campaigns/${id}`), [id]);
  const [run, busy] = useAction();
  const [add, setAdd] = useState(null);
  const [closing, setClosing] = useState(null);
  if (loading && !c) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (c.status === 'Draft') { nav(`/campaigns/${id}/wizard`, { replace: true }); return null; }

  const st = c.stats;
  const pe = c.pred_frozen?.enrols || [0, 0];
  const dg = c.diagnosis || {};
  const refresh = async () => { const r = await run(() => api.post(`/campaigns/${id}/insights/run`), 'Insights refreshed by Agents A11 and A12'); if (r) setData(r); };
  const move = async (mid, decision) => { const r = await run(() => api.post(`/campaigns/${id}/moves/${mid}/${decision}`), decision === 'accept' ? 'Move accepted · new plan version' : 'Move dismissed'); if (r) setData(r); };
  const addSource = async () => { const r = await run(() => api.post(`/campaigns/${id}/sources`, { source_id: add }), 'Source added as Identified'); if (r) { setData(r); setAdd(null); } };
  const close = async () => { const r = await run(() => api.post(`/campaigns/${id}/close`, { lessons: closing.split('\n').filter(Boolean) }), 'Campaign closed; results written to the Creator Bank'); if (r) { setData(r); setClosing(null); } };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row"><h1>{c.name}</h1><Badge s={c.status} /><span className="badge" style={{ background: 'var(--ink-50)' }}>Plan v{c.version}</span></div>
          <div className="small muted">{c.asset} · {c.objective} · {d(c.start_date)} – {d(c.end_date)} · owner {c.owner}</div>
        </div>
        <div className="row">
          {c.status === 'Live' && <button className="btn" disabled={busy} onClick={refresh}>{busy ? 'Running agents…' : '↻ Refresh insights'}</button>}
          <a className="btn" href={`/api/campaigns/${id}/export?format=csv`} onClick={async (e) => { e.preventDefault(); const r = await fetch(`/api/campaigns/${id}/export?format=csv`, { headers: { Authorization: `Bearer ${api.token.get()}` } }); const b = await r.blob(); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `${id}-plan.csv`; a.click(); }}>Export</a>
          {c.status === 'Live' && <button className="btn" onClick={() => setClosing('')}>Close campaign</button>}
        </div>
      </div>

      {dg.verdict && (
        <div className="alert" style={{ background: dg.verdict === 'Behind' ? 'var(--danger-100)' : 'var(--success-100)', color: dg.verdict === 'Behind' ? 'var(--danger-800)' : 'var(--success-800)', marginBottom: 16 }}>
          <b>{dg.verdict}</b><span style={{ flex: 1 }}>{dg.gap}</span>{dg.verdict === 'Behind' && <a onClick={() => setSp({ tab: 'insights' })}>See causes and fixes →</a>}
        </div>
      )}

      <Tabs value={tab} onChange={(t) => setSp({ tab: t })} tabs={[['overview', 'Overview'], ['influencers', 'Influencers', c.ccs.length], ['performance', 'Performance'], ['insights', 'Insights', c.moves.filter((m) => m.status === 'Open').length || ''], ['plan', 'Plan']]} />

      {tab === 'overview' && (
        <>
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <Kpi l="Screening enrolments" v={st.enrols} sub={`frozen range ${pe[0]}–${pe[1]}${c.unattributed ? ` · ${c.unattributed} unattributed` : ''}`} stamp="Observed" />
            <Kpi l="Registrations" v={n(st.regs)} sub={`${n(st.clicks)} tracked clicks · ${pct(st.regRate)} reg rate`} stamp="Observed" />
            <Kpi l="Cost per enrolment" v={inr(st.cpi)} sub={c.ceiling ? `ceiling ${inr(c.ceiling)}` : ''} stamp="Observed" />
            <Kpi l="Committed spend" v={inrL(st.committed)} sub={`${inrL(st.spent)} spent · ${inrL(c.budget)} budget`} stamp="Observed" />
          </div>
          <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <Card title="Enrolments vs frozen prediction" right={<span className="small muted">band = predicted range (v1) · line = actual</span>}><BandChart series={c.series} /></Card>
            <Card title="Checkpoints">
              {c.checkpoints.map((p) => <div key={p.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--ink-50)' }}><div><b>{p.label}</b> <span className="small muted">· {ds(p.date)}</span><div className="small muted">{p.note}</div></div>{p.verdict ? <Badge s={p.verdict} /> : <span className="small muted">upcoming</span>}</div>)}
            </Card>
          </div>
          <Card title="Campaign summary" right={<Stamp s="Inferred" />}><p>{c.summary || <span className="muted">Run insights to summarise what the cohort is saying.</span>}</p></Card>
        </>
      )}

      {tab === 'influencers' && (
        <Card title="Sources on this campaign" right={c.status === 'Live' && <button className="btn sm" onClick={() => setAdd('')}>＋ Add from Creator Bank</button>}>
          <table>
            <thead><tr><th>Source</th><th>Status</th><th>Deal</th><th>Posts</th><th>Clicks</th><th>Enrolments</th><th>Predicted</th><th>Content</th></tr></thead>
            <tbody>{c.ccs.map((x) => (
              <tr key={x.id} className="click" onClick={() => nav(`/campaigns/${id}/sources/${x.id}`)}>
                <td><div className="row"><Avatar name={x.name} id={x.source_id} /><div><b>{x.name}</b><div className="small muted">{x.platform} · {x.type}</div></div></div></td>
                <td><Badge s={x.status} />{x.late ? <div className="small" style={{ color: 'var(--danger-600)' }}>past post date</div> : null}</td>
                <td className="small">{x.deal_type || '—'}{x.rate != null && ` · ${inr(x.rate)} × ${x.deal_posts}`}</td>
                <td>{x.posts.length}/{x.deal_posts || 0}</td>
                <td>{n(x.stats.clicks)}</td><td><b>{x.stats.enrols}</b></td>
                <td className="small">{x.pred_enrols ? `${x.pred_enrols[0]}–${x.pred_enrols[1]}` : '—'}</td>
                <td className="small">{x.content.filter((k) => k.status === 'Approved').length}/{x.content.length} approved</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}

      {tab === 'performance' && (
        <>
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <Kpi l="Views" v={n(st.views)} sub={`reach ≈ ${n(st.reach)}`} stamp="Observed" />
            <Kpi l="Engagement rate" v={pct(st.er)} sub={`${n(st.eng)} engagements`} stamp="Observed" />
            <Kpi l="Positive sentiment" v={`${st.pos}%`} sub={`${st.neg}% negative`} stamp="Inferred" />
            <Kpi l="Enrolment rate" v={pct(st.enrolRate)} sub="of registrations" stamp="Observed" />
          </div>
          <Card title="Posts">
            <table><thead><tr><th>Post</th><th>Source</th><th>Date</th><th>Views</th><th>Clicks</th><th>Regs</th><th>Enrols</th><th>Fetch</th></tr></thead>
              <tbody>{c.ccs.flatMap((x) => x.posts.map((p) => (
                <tr key={p.id}><td><b>{p.title}</b><div className="small muted">{p.format}{p.manual ? ' · manual' : ''}</div></td><td className="small">{x.name}</td><td className="small">{ds(p.posted_on)}</td>
                  <td>{p.views == null ? <span className="small muted">link only</span> : n(p.views)}</td><td>{n(p.clicks)}</td><td>{n(p.regs)}</td><td><b>{p.enrols}</b></td><td><Badge s={p.fetch_status === 'OK' ? 'Pass' : 'Warning'}>{p.fetch_status}</Badge></td></tr>
              )))}</tbody></table>
          </Card>
          <Card title="Comments" right={<Stamp s="Inferred" />}>
            {c.comments.map((m) => <div key={m.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--ink-50)' }}><div>{m.text} {m.sentiment && <Badge s={m.sentiment} />} {m.theme && <span className="badge" style={{ background: 'var(--ink-50)' }}>{m.theme}</span>}</div>{m.translation && <div className="small muted">{m.translation}</div>}</div>)}
          </Card>
        </>
      )}

      {tab === 'insights' && (
        <div className="grid g2">
          <div>
            <Card title="Why" right={<span className="small muted">Agent A12 · {dg.when ? d(dg.when) : '—'}</span>}>
              {dg.text && <p style={{ marginBottom: 10 }}>{dg.text}</p>}
              {(dg.causes || []).map((x, i) => (
                <div key={i} style={{ marginBottom: 10 }}><div className="row between"><b>{x.label}</b><span>{x.share}%</span></div><div className="bar"><i style={{ width: `${x.share}%`, background: 'var(--warning-600)' }} /></div><div className="small muted" style={{ marginTop: 3 }}>{x.detail}</div></div>
              ))}
              {!dg.causes?.length && <div className="muted">No causes recorded yet.</div>}
            </Card>
            <Card title="Alerts">{c.alerts.length ? c.alerts.map((a) => <AlertRow key={a.id} level={a.level} title={`${a.kind}${a.rule_code && a.rule_code !== a.kind ? ` (${a.rule_code})` : ''}`} sub={a.text} />) : <div className="muted">No open alerts.</div>}</Card>
          </div>
          <Card title="Next moves" right={<span className="small muted">Accepting creates a new plan version; the frozen prediction is kept</span>}>
            {c.moves.map((m) => (
              <div key={m.id} className="sel-card" style={{ marginBottom: 10 }}>
                <div className="row between"><Badge s="Inferred">{m.type}</Badge><Badge s={m.status} /></div>
                <h3 style={{ margin: '6px 0' }}>{m.title}</h3>
                <div className="small"><b>{m.impact}</b> · {m.cost_label}</div>
                <div className="small muted" style={{ marginTop: 4 }}>{m.why}</div>
                {m.status === 'Open' && <div className="row" style={{ marginTop: 8 }}><button className="btn sm primary" disabled={busy} onClick={() => move(m.id, 'accept')}>Accept</button><button className="btn sm" disabled={busy} onClick={() => move(m.id, 'dismiss')}>Dismiss</button></div>}
              </div>
            ))}
            {!c.moves.length && <div className="muted">No moves proposed.</div>}
          </Card>
        </div>
      )}

      {tab === 'plan' && (
        <div className="grid g2">
          <div>
            <Card title="Frozen prediction (v1)" right={<span className="small muted">Confidence {c.pred_frozen?.conf}</span>}>
              {c.pred_frozen && <dl className="kv" style={{ gridTemplateColumns: '140px 1fr' }}>{[['Views', range(c.pred_frozen.views)], ['Reach', range(c.pred_frozen.reach)], ['Clicks', range(c.pred_frozen.clicks)], ['Registrations', range(c.pred_frozen.regs)], ['Enrolments', range(c.pred_frozen.enrols)], ['Cost per enrolment', `${inr(c.pred_frozen.cpi?.[0])}–${inr(c.pred_frozen.cpi?.[1])}`]].flatMap(([k, v]) => [<dt key={k}>{k}</dt>, <dd key={k + 'v'}>{v}</dd>])}</dl>}
              <div className="small muted" style={{ marginTop: 8 }}>{c.pred_frozen?.basis}</div>
            </Card>
            <Card title="Narratives">{c.narratives.map((x) => <div key={x.id} style={{ marginBottom: 8 }}><Badge s={x.role === 'Primary' ? 'Confirmed' : 'Waiting'}>{x.role}</Badge> <b>{x.title}</b><div className="small muted">{x.cls} · {x.hook}</div></div>)}</Card>
            <Card title="Channels">{c.channels.map((x) => <div key={x.name} className="row between small" style={{ padding: '4px 0' }}><span><b>{x.name}</b> · {x.role}</span><span>{x.share}% · {x.meas}</span></div>)}</Card>
          </div>
          <div>
            <Card title="Plan versions">{c.versions.map((v) => <div key={v.id} className="small" style={{ padding: '6px 0', borderBottom: '1px solid var(--ink-50)' }}><b>v{v.v}</b> · {d(v.date)} · {v.by_user}<div className="muted">{v.note}</div></div>)}</Card>
            {c.lessons?.length > 0 && <Card title="Lessons">{c.lessons.map((l, i) => <div key={i} className="small">• {l}</div>)}</Card>}
            <Card title="Cohort">
              <dl className="kv" style={{ gridTemplateColumns: '120px 1fr' }}><dt>Cohort</dt><dd>{c.cohort || c.asset}</dd><dt>Qualification</dt><dd>{c.qual}</dd><dt>Skill background</dt><dd>{(c.skill_bg || []).join(', ')}</dd><dt>Bands</dt><dd>{[c.age_band, c.exp_band].filter(Boolean).join(' · ')}</dd><dt>Districts</dt><dd>{(c.markets || []).join(', ')}</dd><dt>Languages</dt><dd>{(c.languages || []).join(', ')}</dd><dt>Hashtags</dt><dd>{(c.hashtags || []).join(' ')}</dd></dl>
            </Card>
          </div>
        </div>
      )}

      {add != null && <AddSource value={add} setValue={setAdd} onAdd={addSource} onClose={() => setAdd(null)} existing={c.ccs.map((x) => x.source_id)} opts={opts} />}
      {closing != null && (
        <Modal title="Close campaign" onClose={() => setClosing(null)} footer={<><button className="btn" onClick={() => setClosing(null)}>Cancel</button><button className="btn primary" onClick={close}>Close and write results</button></>}>
          <p className="small muted" style={{ marginBottom: 8 }}>Final enrolments are compared with the frozen range. Results are written to the Creator Bank (history, attributed enrolments) and the rate card.</p>
          <textarea className="input" placeholder="Lessons for the next batch, one per line" value={closing} onChange={(e) => setClosing(e.target.value)} />
        </Modal>
      )}
    </>
  );
}

function AddSource({ value, setValue, onAdd, onClose, existing }) {
  const { data } = useLoad(() => api.get('/sources'), []);
  const rows = (data || []).filter((s) => !existing.includes(s.id));
  return (
    <Modal wide title="Add from Creator Bank" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!value} onClick={onAdd}>Add as Identified</button></>}>
      <p className="small muted" style={{ marginBottom: 8 }}>Gates still apply. Sources with a gate cannot be confirmed until it is resolved.</p>
      <Select value={value} onChange={setValue} options={rows.map((s) => s.id)} placeholder="Choose a source" />
      <table style={{ marginTop: 10 }}><tbody>{rows.map((s) => <tr key={s.id} className="click" onClick={() => setValue(s.id)} style={{ background: value === s.id ? 'var(--teal-50)' : '' }}><td><b>{s.name}</b> <span className="small muted">{s.handle}</span></td><td>{s.platform}</td><td>{s.type}</td><td>{n(s.followers)}</td><td>{s.gate ? <Badge s="Blocked">{s.gate.rule}</Badge> : <Badge s="Pass">Eligible</Badge>}</td></tr>)}</tbody></table>
    </Modal>
  );
}
