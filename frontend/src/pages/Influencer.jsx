/** One source on one campaign: profile & why, content plan (approve), deal, status pipeline, posts. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAction, useApp, useLoad } from '../lib/app';
import { d, ds, inr, n } from '../lib/format';
import { Avatar, Badge, Card, ErrorBox, Field, Loading, Select, Tabs } from '../components/ui';

export default function Influencer() {
  const { id, ccId } = useParams();
  const nav = useNavigate();
  const { opts } = useApp();
  const { data: c, loading, error, setData } = useLoad(() => api.get(`/campaigns/${id}`), [id]);
  const [tab, setTab] = useState('content');
  const [run, busy] = useAction();
  const [deal, setDeal] = useState(null);
  const [post, setPost] = useState({ title: '', url: '', posted_on: '', views: '', clicks: '', regs: '', enrols: '' });
  const [reason, setReason] = useState('');
  if (loading && !c) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const x = c.ccs.find((k) => k.id === ccId);
  if (!x) return <ErrorBox error="Source not on this campaign" />;
  const narr = c.narratives.find((k) => k.id === x.narrative_id);
  const dl = deal || { deal_type: x.deal_type, rate: x.rate, posts: x.deal_posts, deliverables: x.deliverables, deal_start: x.deal_start, deal_end: x.deal_end, terms: x.terms };

  const status = async (s) => { const r = await run(() => api.patch(`/campaigns/${id}/sources/${ccId}/status`, { status: s, reason }), `Status → ${s}`); if (r) setData(r); };
  const content = async (ci, s) => { const r = await run(() => api.patch(`/campaigns/${id}/sources/${ccId}/content/${ci}`, { status: s }), `Content → ${s}`); if (r) setData(r); };
  const saveDeal = async () => { const r = await run(() => api.patch(`/campaigns/${id}/sources/${ccId}/deal`, dl), 'Deal saved'); if (r) { setData(r); setDeal(null); } };
  const addPost = async () => {
    const body = { ...post, manual: true };
    ['views', 'clicks', 'regs', 'enrols'].forEach((k) => { body[k] = body[k] === '' ? null : +body[k]; });
    const r = await run(() => api.post(`/campaigns/${id}/sources/${ccId}/posts`, body), 'Post added');
    if (r) { setData(r); setPost({ title: '', url: '', posted_on: '', views: '', clicks: '', regs: '', enrols: '' }); }
  };

  return (
    <>
      <div className="page-head">
        <div className="row"><Avatar name={x.name} id={x.source_id} size={44} /><div><div className="row"><h1>{x.name}</h1><Badge s={x.status} /></div><div className="small muted">{x.handle} · {x.platform} · {x.type} · {x.tier} · {n(x.followers)} followers</div></div></div>
        <div className="row"><button className="btn" onClick={() => nav(`/creators/${x.source_id}`)}>Bank profile</button><button className="btn" onClick={() => nav(`/campaigns/${id}?tab=influencers`)}>Back to {c.name}</button></div>
      </div>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="l">Enrolments</div><div className="v">{x.stats.enrols}</div><div className="small muted">predicted {x.pred_enrols?.[0]}–{x.pred_enrols?.[1]}</div></div>
        <div className="card kpi"><div className="l">Clicks → regs</div><div className="v">{n(x.stats.clicks)}</div><div className="small muted">{n(x.stats.regs)} registrations</div></div>
        <div className="card kpi"><div className="l">Spent</div><div className="v">{inr(x.stats.spent)}</div><div className="small muted">of {inr(x.stats.total)} deal</div></div>
        <div className="card kpi"><div className="l">Tracking tag</div><div className="v mono" style={{ fontSize: 13 }}>{x.tracking_tag}</div><div className="small muted">ids only, no personal data</div></div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['content', 'Content plan', x.content.filter((k) => k.status !== 'Approved').length || ''], ['deal', 'Deal and commercials'], ['status', 'Status'], ['posts', 'Posts and performance', x.posts.length]]} />

      {tab === 'content' && (
        <>
          {narr && <Card title="Carries narrative"><b>{narr.title}</b> <span className="small muted">· {narr.cls} · {narr.hook}</span></Card>}
          <div className="grid g2" style={{ marginTop: 16 }}>
            {x.content.map((ci) => (
              <div key={ci.id} className="sel-card">
                <div className="row between"><Badge s="Inferred">{ci.format}</Badge><Badge s={ci.status} /></div>
                <h3 style={{ margin: '6px 0' }}>{ci.title}</h3>
                <div className="small"><b>Hook</b> {ci.hook}</div>
                <ul className="small" style={{ paddingLeft: 16, margin: '6px 0' }}>{(ci.beats || []).map((b, i) => <li key={i}>{typeof b === 'string' ? b : <><b>{b.k}</b> {b.t}</>}</li>)}</ul>
                <div className="small" style={{ wordBreak: 'break-word' }}>{ci.caption}</div>
                <div className="small muted mono" style={{ marginTop: 4 }}>{ci.link}</div>
                <div className="row" style={{ marginTop: 6 }}>{Object.entries(ci.checks || {}).map(([k, v]) => <Badge key={k} s={v}>{k}: {v}</Badge>)}<span className="small muted">due {ds(ci.due)}</span></div>
                <div className="row" style={{ marginTop: 8 }}>
                  {ci.status === 'Draft' && <button className="btn sm" disabled={busy} onClick={() => content(ci.id, 'In review')}>Send for review</button>}
                  {ci.status !== 'Approved' && <button className="btn sm primary" disabled={busy} onClick={() => content(ci.id, 'Approved')}>Approve</button>}
                </div>
              </div>
            ))}
            {!x.content.length && <div className="muted">No content items. Agent A8 drafts content in the wizard.</div>}
          </div>
        </>
      )}

      {tab === 'deal' && (
        <Card title="Deal">
          <div className="grid g3">
            <Field label="Deal type"><Select value={dl.deal_type} options={opts('deal_type')} onChange={(v) => setDeal({ ...dl, deal_type: v })} /></Field>
            <Field label="Fee per post (₹)"><input className="input" type="number" value={dl.rate ?? ''} onChange={(e) => setDeal({ ...dl, rate: +e.target.value })} /></Field>
            <Field label="Posts"><input className="input" type="number" value={dl.posts ?? ''} onChange={(e) => setDeal({ ...dl, posts: +e.target.value })} /></Field>
            <Field label="Start"><input className="input" type="date" value={dl.deal_start || ''} onChange={(e) => setDeal({ ...dl, deal_start: e.target.value })} /></Field>
            <Field label="Post by"><input className="input" type="date" value={dl.deal_end || ''} onChange={(e) => setDeal({ ...dl, deal_end: e.target.value })} /></Field>
            <Field label="Deliverables"><input className="input" value={dl.deliverables || ''} onChange={(e) => setDeal({ ...dl, deliverables: e.target.value })} /></Field>
          </div>
          <div style={{ marginTop: 12 }}><Field label="Terms"><textarea className="input" value={dl.terms || ''} onChange={(e) => setDeal({ ...dl, terms: e.target.value })} /></Field></div>
          <div className="row between" style={{ marginTop: 12 }}><span>Total <b>{inr((dl.rate || 0) * (dl.posts || 0))}</b></span><button className="btn primary" disabled={!deal || busy} onClick={saveDeal}>Save deal</button></div>
        </Card>
      )}

      {tab === 'status' && (
        <div className="grid g2">
          <Card title="Move status">
            <p className="small muted" style={{ marginBottom: 8 }}>Confirmed needs a recorded deal. Institutional sources need a consent record first (RR-H06).</p>
            <div className="chips">{opts('source_status').map((s) => <button key={s} className={`chip ${x.status === s ? 'on' : ''}`} disabled={busy || x.status === s} onClick={() => status(s)}>{s}</button>)}</div>
            <div style={{ marginTop: 10 }}><Field label="Reason (required for Declined / Backed out)"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>
          </Card>
          <Card title="Log">{x.log.map((l) => <div key={l.id} className="small" style={{ padding: '4px 0' }}><span className="muted">{d(l.date)}</span> · {l.text}</div>)}</Card>
        </div>
      )}

      {tab === 'posts' && (
        <>
          <Card title="Posts">
            <table><thead><tr><th>Post</th><th>Date</th><th>Views</th><th>Clicks</th><th>Regs</th><th>Enrols</th></tr></thead>
              <tbody>{x.posts.map((p) => <tr key={p.id}><td><b>{p.title}</b><div className="small muted">{p.url}</div></td><td>{ds(p.posted_on)}</td><td>{n(p.views)}</td><td>{n(p.clicks)}</td><td>{n(p.regs)}</td><td><b>{p.enrols}</b></td></tr>)}</tbody></table>
          </Card>
          <Card title="Add post link">
            <p className="small muted" style={{ marginBottom: 8 }}>Add the link when a post goes live; it must belong to this source's account. Metrics refresh from official APIs, or enter them manually (LinkedIn, WhatsApp).</p>
            <div className="grid g4">
              <Field label="Title"><input className="input" value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} /></Field>
              <Field label="URL"><input className="input" value={post.url} onChange={(e) => setPost({ ...post, url: e.target.value })} /></Field>
              <Field label="Posted on"><input className="input" type="date" value={post.posted_on} onChange={(e) => setPost({ ...post, posted_on: e.target.value })} /></Field>
              <Field label="Views"><input className="input" type="number" value={post.views} onChange={(e) => setPost({ ...post, views: e.target.value })} /></Field>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button className="btn primary" disabled={!post.title || busy} onClick={addPost}>Add post</button></div>
          </Card>
        </>
      )}
    </>
  );
}
