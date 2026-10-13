/**
 * Campaign wizard — six steps, each backed by an agent:
 * 0 Objective & cohort (A4) · 1 Narrative (A5) · 2 Channels (A6) · 3 Influencers (A7)
 * 4 Content (A8) · 5 Review & create (A9 prediction + A10 compliance gate)
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApp, useLoad } from '../lib/app';
import { inr, n, range } from '../lib/format';
import { AgentLoader, Avatar, Badge, Card, Chips, ErrorBox, Field, Loading, Modal, Select } from '../components/ui';

const LOADERS = {
  cohort: ['Reading the brief and programme reads', 'Agent A4 · objective and cohort', ['Loading confirmed brief fields', 'Resolving districts to standard names (RM-05)', 'Checking past batches', 'Proposing cohorts with estimated size', 'Choosing what to ask you']],
  narratives: ['Suggesting narratives', 'Agent A5 · usually under 60 seconds', ['Building the context pack for the cohort', 'Generating candidates across narrative classes', 'Scoring resonance, objective fit and difference from competing programmes', 'Checking outcome claims (RR-H03), discrimination risk and consent']],
  channels: ['Planning channels', 'Agent A6 · prior × cohort behaviour × measurability', ['Loading the objective prior matrix', 'Weighting by how this cohort uses each channel', 'Applying measurability (1.0 measured, 0.8 tracked link, 0.6 manual)', "Locking the programme's own page as Anchor"]],
  rank: ['Ranking influence sources', 'Agent A7 · six-stage pipeline', ['Pool: Creator Bank sources on chosen channels', 'Gates: reliability, consent (RR-H06), followers, activity', 'Trust and reach in the cohort districts', 'Quality: engagement vs tier median', 'Fit: authority on the course skill domain', 'Portfolio: overlap-adjusted within budget']],
  content: ['Suggesting content', 'Agent A8 · personalised to the cohort', ["Reading each source's top posts", 'Personalising language, aspiration, benefit, format and CTA', 'Adding the tracked Resolence link and disclosure']],
  review: ['Predicting and checking', 'Agent A9 prediction · Agent A10 compliance and fairness gate', ['Predicting reach, clicks, registrations and enrolments per source', 'Discounting overlap in shared districts', 'Running the 13 governance and fairness checks']],
  create: ['Creating campaign', 'Freezing prediction v1', ['Re-running checks', 'Freezing the prediction', 'Creating sources, content and checkpoints']],
};

export default function Wizard() {
  const { id } = useParams();
  const nav = useNavigate();
  const { opts, toast } = useApp();
  const { data, loading, error, setData } = useLoad(() => api.get(`/campaigns/${id}/wizard`), [id]);
  const [busy, setBusy] = useState(null);
  const [view, setView] = useState(null);
  const [obj, setObj] = useState(null);
  const [sl, setSl] = useState(null);
  const [instr, setInstr] = useState('');

  useEffect(() => { if (data) { setObj(data.campaign); if (view == null) setView(typeof data.wizard.step === 'number' ? data.wizard.step : 5); } }, [data]); // eslint-disable-line
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (data.campaign.status !== 'Draft') { nav(`/campaigns/${id}`, { replace: true }); return null; }
  const { wizard: w, steps } = data;
  const c = data.campaign;

  const act = async (key, fn, next) => {
    setBusy(key);
    try { const r = await fn(); if (r?.wizard) setData(r); if (next != null) setView(next); return r; } catch (e) { toast(e.message, 'error'); return null; } finally { setBusy(null); }
  };
  const saveObj = (patch) => act(null, () => api.patch(`/campaigns/${id}/wizard/objective`, patch));
  const setO = (k, v) => setObj({ ...obj, [k]: v });
  const commit = (k) => () => obj[k] !== c[k] && saveObj({ [k]: obj[k] });

  if (busy && LOADERS[busy]) { const [t, a, s] = LOADERS[busy]; return <AgentLoader title={t} agent={a} steps={s} />; }

  // ---------------- step header
  const header = (
    <>
      <div className="page-head"><div><div className="small muted">New campaign · Draft saved</div><h1>{c.name}</h1></div><button className="btn" onClick={() => nav('/campaigns')}>Close</button></div>
      <div className="steps">
        {steps.map((s, i) => {
          const done = w.done?.includes(i), needs = w.needs?.includes(i);
          const reachable = i === 0 || w.done?.includes(i - 1) || done;
          return <button key={s} className={`stepper ${view === i ? 'on' : ''} ${done ? 'done' : ''} ${needs ? 'needs' : ''}`} disabled={!reachable} onClick={() => setView(i)}>{done ? '✓' : i + 1}. {s}{needs && <div className="small" style={{ color: 'var(--warning-800)' }}>Needs attention</div>}</button>;
        })}
      </div>
    </>
  );

  // ---------------- step 0
  if (view === 0) {
    const ok = obj.name && obj.objective && obj.budget && obj.markets?.length && obj.start_date && obj.end_date && obj.qual;
    const answered = (w.questions || []).every((q) => w.answers?.[q.k]);
    return (
      <>{header}
        <div className="grid" style={{ gridTemplateColumns: '1fr 320px' }}>
          <Card title="Objective and cohort">
            <p className="muted small" style={{ marginBottom: 12 }}>One cohort in one geography for this batch. Cohorts are aggregate groups; no individual can be targeted.</p>
            <div className="grid g2">
              <Field label="Campaign name" req><input className="input" value={obj.name || ''} onChange={(e) => setO('name', e.target.value)} onBlur={commit('name')} /></Field>
              <Field label="Objective" req><Select value={obj.objective} options={opts('objective')} onChange={(v) => { setO('objective', v); saveObj({ objective: v }); }} /></Field>
              <Field label="KPI" req><Select value={obj.kpi} options={opts('kpi')} onChange={(v) => { setO('kpi', v); saveObj({ kpi: v }); }} /></Field>
              <Field label="Target enrolments"><input className="input" type="number" value={obj.target || ''} onChange={(e) => setO('target', +e.target.value)} onBlur={commit('target')} /></Field>
              <Field label="Cost ceiling per enrolment (₹)"><input className="input" type="number" value={obj.ceiling || ''} onChange={(e) => setO('ceiling', +e.target.value)} onBlur={commit('ceiling')} /></Field>
              <Field label="Budget (₹)" req><input className="input" type="number" value={obj.budget || ''} onChange={(e) => setO('budget', +e.target.value)} onBlur={commit('budget')} /></Field>
            </div>
            <div className="stack" style={{ marginTop: 12 }}>
              <Field label="Districts" req><Chips value={obj.markets || []} options={opts('district')} onChange={(v) => { setO('markets', v); saveObj({ markets: v }); }} /></Field>
              <div className="grid g2">
                <Field label="Qualification" req><Select value={obj.qual} options={opts('qualification')} onChange={(v) => { setO('qual', v); saveObj({ qual: v }); }} /></Field>
                <Field label="Skill background"><Chips value={obj.skill_bg || []} options={opts('skill_background')} onChange={(v) => { setO('skill_bg', v); saveObj({ skill_bg: v }); }} /></Field>
                <Field label="Age band" help="Bands only, never exact ages"><Select value={obj.age_band} options={opts('age_band')} onChange={(v) => { setO('age_band', v); saveObj({ age_band: v }); }} /></Field>
                <Field label="Experience band"><Select value={obj.exp_band} options={opts('exp_band')} onChange={(v) => { setO('exp_band', v); saveObj({ exp_band: v }); }} /></Field>
              </div>
              <Field label="Languages"><Chips value={obj.languages || []} options={opts('language')} onChange={(v) => { setO('languages', v); saveObj({ languages: v }); }} /></Field>
              <div className="grid g2">
                <Field label="Start" req><input type="date" className="input" value={obj.start_date || ''} onChange={(e) => setO('start_date', e.target.value)} onBlur={commit('start_date')} /></Field>
                <Field label="End" req><input type="date" className="input" value={obj.end_date || ''} onChange={(e) => setO('end_date', e.target.value)} onBlur={commit('end_date')} /></Field>
              </div>
              <Field label="Hashtag"><input className="input" placeholder="#AppliedAIBatch4" value={(obj.hashtags || [])[0] || ''} onChange={(e) => setO('hashtags', e.target.value ? [e.target.value] : [])} onBlur={() => saveObj({ hashtags: obj.hashtags || [] })} /></Field>
              <Field label="Anything else the agents should know"><textarea className="input" value={obj.free_text || ''} onChange={(e) => setO('free_text', e.target.value)} onBlur={commit('free_text')} /></Field>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn primary" disabled={!ok} onClick={() => act('cohort', () => api.post(`/campaigns/${id}/wizard/cohort`))}>{w.cohort ? 'Re-check cohort' : 'Check cohort (Agent A4)'}</button>
            </div>
          </Card>
          <div>
            {w.cohort && (
              <Card title="Cohort">
                <div className="kpi"><div className="l">Estimated cohort size</div><div className="v">{n(w.cohort.size.size)}</div><div className="small muted">{w.cohort.size.stamp} · {w.cohort.size.basis} · minimum {n(w.cohort.min)}</div></div>
                {!w.cohort.size_ok && <div className="alert" style={{ background: 'var(--danger-100)', color: 'var(--danger-800)', marginTop: 8 }}>Below the minimum cohort size.</div>}
                {w.cohort.district_changes?.map((x, i) => <div key={i} className="small muted">RM-05: “{x.from}” → {x.to || 'dropped'}</div>)}
                {w.cohort.notes?.map((x, i) => <div key={i} className="small" style={{ marginTop: 6 }}>• {x}</div>)}
              </Card>
            )}
            {w.questions && (
              <Card title="Up to 3 questions">
                <div className="small muted" style={{ marginBottom: 8 }}>Agent A4 · rules-based; answers shape the narratives and source mix</div>
                {w.questions.map((q) => (
                  <Field key={q.k} label={q.q} help={q.why}><Select value={w.answers?.[q.k]} options={q.opts} placeholder="Select an answer" onChange={(v) => saveObj({ answers: { [q.k]: v } })} /></Field>
                ))}
                <button className="btn primary" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} disabled={!answered || !w.cohort?.size_ok} onClick={() => act('narratives', () => api.post(`/campaigns/${id}/wizard/narratives`, {}), 1)}>Suggest narratives</button>
              </Card>
            )}
          </div>
        </div>
      </>
    );
  }

  // ---------------- step 1
  if (view === 1) {
    const prim = (w.narrs || []).find((x) => x.role === 'Primary');
    return (
      <>{header}
        <Card title="Narrative" right={<div className="row"><input className="input" style={{ width: 280 }} placeholder="Tell Agent A5 what to change…" value={instr} onChange={(e) => setInstr(e.target.value)} /><button className="btn" onClick={() => act('narratives', () => api.post(`/campaigns/${id}/wizard/narratives`, { instruction: instr }))}>Rewrite</button></div>}>
          <p className="muted small" style={{ marginBottom: 12 }}>Select one narrative for this campaign. Scores are Inferred from resonance evidence minus risk. Held narratives assert a claim without Observed evidence (RR-H03).</p>
          <div className="grid g2">
            {(w.narrs || []).map((x) => (
              <div key={x.id} className={`sel-card ${x.role === 'Primary' ? 'on' : ''} ${x.held ? 'held' : ''}`}>
                <div className="row between"><Badge s="Inferred">{x.cls}</Badge>{x.score != null && <b style={{ color: x.score >= 75 ? 'var(--success-600)' : x.score >= 60 ? 'var(--warning-600)' : 'var(--danger-600)' }}>{x.score}</b>}</div>
                <h3 style={{ margin: '8px 0 4px' }}>{x.title}</h3>
                <div className="small" style={{ fontStyle: 'italic', marginBottom: 8 }}>{x.hook}</div>
                <dl className="kv"><dt>Who</dt><dd>{x.who}</dd><dt>Why</dt><dd>{x.why}</dd><dt>Risk</dt><dd style={{ color: x.risk?.startsWith('High') ? 'var(--danger-600)' : x.risk?.startsWith('Medium') ? 'var(--warning-800)' : 'inherit' }}>{x.risk}</dd><dt>Tone</dt><dd>{x.tone}</dd></dl>
                <button className="btn sm" style={{ marginTop: 10 }} disabled={x.held || x.role === 'Primary'} onClick={() => act(null, () => api.post(`/campaigns/${id}/wizard/narratives/select`, { id: x.id }))}>{x.held ? 'Held (RR-H03)' : x.role === 'Primary' ? 'Selected' : 'Select'}</button>
              </div>
            ))}
          </div>
        </Card>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <button className="btn" onClick={() => setView(0)}>Back</button>
          <button className="btn primary" disabled={!prim} onClick={() => act('channels', () => api.post(`/campaigns/${id}/wizard/channels`), 2)}>Plan channels</button>
        </div>
      </>
    );
  }

  // ---------------- step 2
  if (view === 2) {
    const chans = w.channels || [];
    const tot = chans.filter((r) => r.on).reduce((a, r) => a + r.share, 0);
    const upd = (name, patch) => act(null, () => api.patch(`/campaigns/${id}/wizard/channels`, { channels: [{ name, ...patch }] }));
    return (
      <>{header}
        <Card title="Channels" right={<Badge s={tot === 100 ? 'Pass' : 'Fail'}>Total {tot}%</Badge>}>
          <p className="muted small" style={{ marginBottom: 12 }}>Which channels suit this cohort, and why. Untick a channel to leave it out; edit shares so they total 100%.</p>
          <table><thead><tr><th /><th>Channel</th><th>Role</th><th>Formats</th><th>Measurement</th><th>Share</th><th>Why</th></tr></thead>
            <tbody>{chans.map((r) => (
              <tr key={r.name}>
                <td><input type="checkbox" checked={r.on} disabled={r.locked} onChange={(e) => upd(r.name, { on: e.target.checked })} /></td>
                <td><b>{r.name}</b></td><td><Badge s="Inferred">{r.role}</Badge></td><td className="small">{r.formats}</td><td className="small">{r.meas}</td>
                <td><input className="input" style={{ width: 70 }} type="number" defaultValue={r.share} disabled={r.locked || !r.on} onBlur={(e) => +e.target.value !== r.share && upd(r.name, { share: +e.target.value })} />%</td>
                <td className="small">{r.reason}</td>
              </tr>
            ))}</tbody></table>
        </Card>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <button className="btn" onClick={() => setView(1)}>Back</button>
          <button className="btn primary" disabled={tot !== 100} onClick={() => act('rank', () => api.post(`/campaigns/${id}/wizard/rank`), 3)}>Rank sources</button>
        </div>
      </>
    );
  }

  // ---------------- step 3
  if (view === 3) {
    const shortlist = w.shortlist || [];
    const inSl = (sid) => shortlist.find((x) => x.source_id === sid);
    const fees = shortlist.reduce((a, x) => a + (+x.fee || 0) * (+x.posts || 1), 0);
    return (
      <>{header}
        <div className="row between" style={{ marginBottom: 12 }}>
          <div className="muted small">Ranked trust first, then reach, quality and fit. Rationale uses only Creator Bank fields.</div>
          <div className="row"><span className="small"><b>{shortlist.length}</b> shortlisted · fees {inr(fees)} of {inr(c.budget)}</span><button className="btn" onClick={() => act(null, () => api.post(`/campaigns/${id}/wizard/portfolio`), null)}>Build portfolio for me</button></div>
        </div>
        <div className="stack">
          {(w.ranked?.list || []).map((r) => {
            const on = inSl(r.id);
            return (
              <div key={r.id} className={`sel-card ${on ? 'on' : ''}`}>
                <div className="row between">
                  <div className="row"><span className="muted">#{r.rank}</span><Avatar name={r.name} id={r.id} /><div><b>{r.name}</b> <Badge s={r.verdict === 'Strong fit' ? 'Pass' : r.verdict === 'Good fit' ? 'Confirmed' : 'Warning'}>{r.verdict}</Badge><div className="small muted">{r.handle} · {r.platform} · {r.type} · {n(r.followers)} · qualified reach {n(r.qualified_reach)}</div></div></div>
                  <div className="row"><span className="small">Score <b>{r.pct}</b> · Trust {r.trust_pct}% · Fit {r.fit_pct}%</span>
                    <button className={`btn sm ${on ? '' : 'primary'}`} onClick={() => (on ? act(null, () => api.post(`/campaigns/${id}/wizard/shortlist`, { source_id: r.id, remove: true })) : setSl({ source_id: r.id, name: r.name, type: r.type, posts: 1, fee: r.fee, deal_type: r.fee ? 'Paid' : 'Partnership' }))}>{on ? 'Remove' : 'Shortlist'}</button>
                    {on && <button className="btn sm" onClick={() => setSl({ ...on, name: r.name, type: r.type })}>Edit deal</button>}
                  </div>
                </div>
                <dl className="kv" style={{ marginTop: 8 }}><dt>Why</dt><dd>{r.why}</dd><dt>Where</dt><dd>{r.where}</dd><dt>What</dt><dd>{r.what}</dd><dt>Past</dt><dd>{r.past}</dd><dt>Fee est.</dt><dd>{inr(r.fee)} / post <Badge s={r.fee_stamp} /></dd></dl>
                {r.flags?.map((f) => <div key={f} className="small" style={{ color: 'var(--warning-800)' }}>▲ {f}</div>)}
              </div>
            );
          })}
        </div>
        {!!w.ranked?.blocked?.length && (
          <Card title={`${w.ranked.blocked.length} sources blocked by eligibility gates`} style={{ marginTop: 16 }}>
            {w.ranked.blocked.map((b) => <div key={b.id} className="row between small" style={{ padding: '6px 0' }}><span><b>{b.name}</b> · {b.handle}</span><span>{b.reason} <Badge s="Blocked">{b.rule}</Badge></span></div>)}
          </Card>
        )}
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <button className="btn" onClick={() => setView(2)}>Back</button>
          <button className="btn primary" disabled={!shortlist.length} onClick={() => act('content', () => api.post(`/campaigns/${id}/wizard/content`, {}), 4)}>Suggest content</button>
        </div>
        {sl && <ShortlistModal sl={sl} setSl={setSl} narrs={w.narrs} opts={opts} save={async () => { const r = await act(null, () => api.post(`/campaigns/${id}/wizard/shortlist`, sl)); if (r) setSl(null); }} />}
      </>
    );
  }

  // ---------------- step 4
  if (view === 4) {
    return (
      <>{header}
        <p className="muted small" style={{ marginBottom: 12 }}>Pick suggested posts for each source, up to the posts in its deal. Every post gets a tracked link; paid items carry #ad.</p>
        {(w.shortlist || []).map((s) => {
          const ct = w.content?.[s.source_id];
          if (!ct) return null;
          const name = (w.ranked?.list || []).find((r) => r.id === s.source_id)?.name || s.source_id;
          const toggle = (vid) => {
            const sel = ct.sel.includes(vid) ? ct.sel.filter((x) => x !== vid) : [...ct.sel, vid];
            act(null, () => api.post(`/campaigns/${id}/wizard/content/select`, { source_id: s.source_id, sel }));
          };
          return (
            <Card key={s.source_id} title={`${name} · ${ct.sel.length} selected · deal has ${s.posts} post${s.posts > 1 ? 's' : ''}`} right={<button className="btn sm" onClick={() => act('content', () => api.post(`/campaigns/${id}/wizard/content`, { source_id: s.source_id, instruction: prompt('What should Agent A8 change?') || undefined }))}>Rewrite</button>}>
              <div className="grid g3">
                {ct.vars.map((v) => (
                  <div key={v.id} className={`sel-card ${ct.sel.includes(v.id) ? 'on' : ''}`}>
                    <div className="row between"><Badge s="Inferred">{v.format}</Badge><span className="small muted">{v.dur}</span></div>
                    <h3 style={{ margin: '8px 0 4px' }}>{v.title}</h3>
                    {v.hook && <div className="small"><b>Hook</b> {v.hook}</div>}
                    {v.beats?.length > 0 && <ul className="small" style={{ paddingLeft: 16, margin: '6px 0' }}>{v.beats.map((b) => <li key={b.k}><b>{b.k}</b> {b.t}</li>)}</ul>}
                    {v.visual && <div className="small muted">{v.visual}</div>}
                    <div className="small" style={{ marginTop: 6, wordBreak: 'break-word' }}>{v.caption}</div>
                    <div className="row" style={{ marginTop: 6 }}>{Object.entries(v.checks).map(([k, val]) => <Badge key={k} s={val}>{k}: {val}</Badge>)}</div>
                    <button className="btn sm" style={{ marginTop: 8 }} onClick={() => toggle(v.id)}>{ct.sel.includes(v.id) ? 'Selected ✓' : 'Select'}</button>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <button className="btn" onClick={() => setView(3)}>Back</button>
          <button className="btn primary" onClick={() => act('review', () => api.post(`/campaigns/${id}/wizard/review`), 5)}>Review</button>
        </div>
      </>
    );
  }

  // ---------------- step 5
  const rv = w.review;
  if (!rv) return <>{header}<button className="btn primary" onClick={() => act('review', () => api.post(`/campaigns/${id}/wizard/review`))}>Run review</button></>;
  const p = rv.prediction;
  const fails = rv.checks.checks.filter((k) => k.status === 'Fail');
  return (
    <>{header}
      <p className="muted small" style={{ marginBottom: 12 }}>The prediction freezes when you create the campaign. Later plan versions keep it for final comparison.</p>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        {[['Screening enrolments', range(p.enrols)], ['Registrations', range(p.regs)], ['Tracked clicks', range(p.clicks)], ['Cost per enrolment', `${inr(p.cpi[0])}–${inr(p.cpi[1])}`]].map(([l, v]) => <div key={l} className="card kpi"><div className="row between"><span className="l">{l}</span><span className="stamp">Predicted</span></div><div className="v">{v}</div></div>)}
      </div>
      <div className="grid g2">
        <Card title="Shortlist and predicted enrolments" right={<span className="small muted">Confidence {p.conf} · {p.basis}</span>}>
          <table><thead><tr><th>Source</th><th>Posts</th><th>Fee</th><th>Enrolments</th><th>Share</th></tr></thead>
            <tbody>{rv.rows.map((r) => <tr key={r.source_id}><td>{r.name} <span className="small muted">· {r.platform}</span></td><td>{r.posts}</td><td>{inr(r.fee)}</td><td>{r.enrols[0]}–{r.enrols[1]}</td><td>{r.share}%</td></tr>)}
              <tr><td><b>Total</b></td><td><b>{p.posts}</b></td><td><b>{inr(p.fees)}</b></td><td><b>{p.enrols[0]}–{p.enrols[1]}</b></td><td className="small muted">overlap −{Math.round(p.overlap * 100)}%</td></tr></tbody></table>
        </Card>
        <Card title="Checks" right={<span className="small">{rv.checks.summary}</span>}>
          {rv.checks.checks.map((k) => <div key={k.label} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--ink-50)' }}><div><div className="small"><b>{k.label}</b></div><div className="small muted">{k.note}</div></div><Badge s={k.status} /></div>)}
        </Card>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
        <button className="btn" onClick={() => setView(4)}>Back</button>
        <div className="row">{fails.length > 0 && <span className="small" style={{ color: 'var(--danger-600)' }}>Resolve failing checks to create</span>}
          <button className="btn" onClick={() => act('review', () => api.post(`/campaigns/${id}/wizard/review`))}>Re-run checks</button>
          <button className="btn primary" disabled={fails.length > 0} onClick={async () => { setBusy('create'); try { await api.post(`/campaigns/${id}/wizard/create`); toast('Campaign created. Prediction frozen (v1).'); nav(`/campaigns/${id}`); } catch (e) { toast(e.message, 'error'); setBusy(null); } }}>Create campaign</button>
        </div>
      </div>
    </>
  );
}

function ShortlistModal({ sl, setSl, narrs, opts, save }) {
  const { lookup } = useApp();
  const inst = lookup('source_type').some((t) => t.code === sl.type && t.meta?.institutional);
  const set = (k, v) => setSl({ ...sl, [k]: v });
  return (
    <Modal title={`${sl.name} · deal`} onClose={() => setSl(null)} footer={<><button className="btn" onClick={() => setSl(null)}>Cancel</button><button className="btn primary" onClick={save}>Save and shortlist</button></>}>
      <div className="stack">
        <Field label="Narrative"><select className="input" value={sl.narrative_id || ''} onChange={(e) => set('narrative_id', e.target.value)}>{(narrs || []).filter((x) => x.role).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>
        <div className="grid g3">
          <Field label="Deal type"><Select value={sl.deal_type} options={opts('deal_type')} onChange={(v) => set('deal_type', v)} /></Field>
          <Field label="Posts"><input className="input" type="number" min={1} value={sl.posts} onChange={(e) => set('posts', +e.target.value)} /></Field>
          <Field label="Fee per post (₹)"><input className="input" type="number" value={sl.fee ?? ''} onChange={(e) => set('fee', +e.target.value)} /></Field>
        </div>
        <Field label="Payment terms"><Select value={sl.payment} options={opts('payment_terms')} onChange={(v) => set('payment', v)} /></Field>
        <Field label="Deliverables"><input className="input" value={sl.deliverables || ''} onChange={(e) => set('deliverables', e.target.value)} /></Field>
        {inst && (
          <div className="card" style={{ background: 'var(--warning-100)' }}>
            <b>Partnership and consent (RR-H06)</b>
            <p className="small">This is an institutional source. Record the relationship and its consent basis.</p>
            <div className="grid g2" style={{ marginTop: 8 }}>
              <Field label="Consent basis"><input className="input" value={sl.consent_basis || ''} onChange={(e) => set('consent_basis', e.target.value)} placeholder="MoU with Training & Placement Officer" /></Field>
              <Field label="Consent date"><input className="input" type="date" value={sl.consent_date || ''} onChange={(e) => set('consent_date', e.target.value)} /></Field>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
