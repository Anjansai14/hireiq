import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAction, useApp, useLoad } from '../lib/app';
import { d } from '../lib/format';
import { Badge, Card, Loading, Spinner } from '../components/ui';

export default function Copilot() {
  const { courseId, course } = useApp();
  const threads = useLoad(() => api.get(`/copilot/threads?course=${courseId}`), [courseId]);
  const camps = useLoad(() => api.get(`/campaigns?course=${courseId}`), [courseId]);
  const [cur, setCur] = useState(null);
  const [text, setText] = useState('');
  const [scope, setScope] = useState('course');
  const [run, busy] = useAction();
  const end = useRef();

  useEffect(() => { if (threads.data?.length && !cur) api.get(`/copilot/threads/${threads.data[0].id}`).then(setCur); }, [threads.data]); // eslint-disable-line
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [cur?.messages?.length]);
  if (threads.loading && !threads.data) return <Loading />;

  const open = async (t) => setCur(await api.get(`/copilot/threads/${t.id}`));
  const newChat = async () => {
    const body = scope === 'course' ? { course_id: courseId, scope_type: 'course', scope_id: courseId } : { course_id: courseId, scope_type: 'campaign', scope_id: scope };
    const t = await run(() => api.post('/copilot/threads', body));
    if (t) { setCur(t); threads.reload(); }
  };
  const send = async (msg) => {
    const m = msg || text;
    if (!m.trim() || !cur) return;
    setText('');
    setCur({ ...cur, messages: [...cur.messages, { id: 'tmp', role: 'user', text: m }] });
    const r = await run(() => api.post(`/copilot/threads/${cur.id}/messages`, { text: m }));
    if (r) { setCur(r); threads.reload(); }
  };
  const decide = async (mid, decision) => { const r = await run(() => api.post(`/copilot/messages/${mid}/${decision}`), decision === 'accept' ? 'Proposal applied' : 'Proposal discarded'); if (r) setCur(r); };
  const suggestions = cur?.scope_type === 'campaign' ? ['Why is this campaign behind?', 'Who should we add for Warangal reach?', 'Summarise the campaign status'] : ['Draft a Telugu caption for the eligibility card', 'Generate a WhatsApp forwardable card', 'Which sources do you recommend?'];

  return (
    <div className="grid" style={{ gridTemplateColumns: '280px 1fr', alignItems: 'start' }}>
      <Card title="Copilot">
        <div className="stack">
          <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="course">Scope: {course?.title}</option>
            {(camps.data || []).filter((c) => c.status !== 'Draft').map((c) => <option key={c.id} value={c.id}>Scope: {c.name}</option>)}
          </select>
          <button className="btn primary" onClick={newChat}>＋ New chat</button>
          {(threads.data || []).map((t) => (
            <a key={t.id} className="item" style={{ display: 'block', padding: 8, borderRadius: 8, background: cur?.id === t.id ? 'var(--teal-50)' : '' }} onClick={() => open(t)}>
              <div style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{t.title}</div><div className="small muted">{t.scope} · {d(t.date)}</div>
            </a>
          ))}
        </div>
      </Card>
      <Card>
        {!cur ? <div className="empty">Start a new chat. Answers cite their sources; changes arrive as proposals you accept or discard.</div> : (
          <>
            <div className="row between" style={{ marginBottom: 12 }}><div><h2>{cur.title}</h2><div className="small muted">Scoped to {cur.scope} · Copilot never invents source handles</div></div></div>
            <div className="chat" style={{ minHeight: 360, maxHeight: '60vh', overflowY: 'auto', padding: 4 }}>
              {cur.messages.map((m) => (
                <div key={m.id} className={`msg ${m.role}`}>
                  {m.text}
                  {m.sources?.length > 0 && <div className="row" style={{ marginTop: 8 }}>{m.sources.map((s) => <span key={s} className="badge" style={{ background: 'var(--ink-50)', color: 'var(--ink-600)' }}>{s}</span>)}</div>}
                  {m.proposal?.concept && <div className="card" style={{ marginTop: 8, background: 'var(--hire-tint)' }}><b>Concept · {m.proposal.concept.title}</b><div className="small">{m.proposal.concept.desc}</div></div>}
                  {m.proposal?.action && (
                    <div className="card" style={{ marginTop: 8 }}>
                      <div className="row between"><b>Proposal</b><Badge s={m.proposal.status} /></div>
                      <div>{m.proposal.title}</div><div className="small muted">{m.proposal.detail}</div>
                      {m.proposal.status === 'Pending' && <div className="row" style={{ marginTop: 8 }}><button className="btn sm primary" disabled={busy} onClick={() => decide(m.id, 'accept')}>Accept</button><button className="btn sm" disabled={busy} onClick={() => decide(m.id, 'discard')}>Discard</button></div>}
                    </div>
                  )}
                </div>
              ))}
              {busy && <div className="msg ai"><Spinner /> Thinking…</div>}
              <div ref={end} />
            </div>
            <div className="row" style={{ marginTop: 10 }}>{suggestions.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}</div>
            <div className="row" style={{ marginTop: 10 }}>
              <input className="input" style={{ flex: 1 }} placeholder={`Ask about ${cur.scope}`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
              <button className="btn primary" disabled={busy || !text.trim()} onClick={() => send()}>Send</button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
