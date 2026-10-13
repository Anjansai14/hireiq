import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAction, useApp, useLoad } from '../lib/app';
import { d, inr, inrL, n, pct } from '../lib/format';
import { AlertRow, Badge, Bar, Card, ErrorBox, Kpi, Loading, Stamp } from '../components/ui';
import { linkFor } from '../components/Layout';

export default function Dashboard() {
  const { courseId } = useApp();
  const nav = useNavigate();
  const { data, loading, error, reload } = useLoad(() => Promise.all([api.get(`/courses/${courseId}/dashboard`), api.get(`/courses/${courseId}/alerts`)]), [courseId]);
  const [run, busy] = useAction();
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const [dash, { alerts }] = data;
  const c = dash.course;
  const rd = c.readiness;

  const newCampaign = async () => {
    const r = await run(() => api.post('/campaigns', { course_id: courseId, name: 'New campaign' }));
    if (r) nav(`/campaigns/${r.campaign.id}/wizard`);
  };
  const fmtKpi = (k) => (k.l.includes('Cost') || k.l.includes('spend') ? (k.l.includes('spend') ? inrL(k.v) : inr(k.v)) : n(k.v));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="small muted">{c.batch} · starts {d(c.batch_start)} · {c.provider}</div>
          <h1>{c.title}</h1>
        </div>
        <div className="row">
          <button className="btn" onClick={() => nav('/brief')}>Course brief</button>
          <button className="btn primary" onClick={newCampaign} disabled={busy || rd.refused}>＋ New campaign</button>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="l">Brief readiness</div>
          <div className="v">{rd.ok}/{rd.req}</div>
          <Bar v={rd.pct} />
          <div className="small muted" style={{ marginTop: 4 }}>required fields confirmed</div>
        </div>
        {dash.kpis.slice(0, 3).map((k) => <Kpi key={k.l} l={k.l} v={fmtKpi(k)} sub={k.sub} stamp={k.stamp} />)}
      </div>

      <div className="grid g2">
        <div>
          <Card title={`Needs attention · ${alerts.length}`}>
            {alerts.length ? alerts.map((a, i) => <AlertRow key={i} {...a} cta="Fix" onClick={() => nav(linkFor(a.link))} />) : <div className="muted">Nothing needs attention.</div>}
          </Card>
          <Card title="Funnel to screening enrolment" right={<Stamp s="Observed" />}>
            {dash.funnel.map((f, i) => (
              <div key={f.l} style={{ marginBottom: 10 }}>
                <div className="row between"><span>{f.l}</span><b>{n(f.v)} {i > 0 && <span className="small muted">({pct(f.rate)})</span>}</b></div>
                <Bar v={f.v} max={dash.funnel[0].v} />
              </div>
            ))}
          </Card>
          <Card title="What the cohort is saying" right={<Stamp s="Inferred" />}>
            <p>{dash.talk || <span className="muted">No comments analysed yet. Run Insights on a live campaign.</span>}</p>
          </Card>
        </div>
        <div>
          <Card title="Campaigns at a glance" right={<a onClick={() => nav('/campaigns')}>View all</a>}>
            {dash.campaigns.length ? dash.campaigns.map((k) => (
              <div key={k.id} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--ink-50)', cursor: 'pointer' }} onClick={() => nav(k.status === 'Draft' ? `/campaigns/${k.id}/wizard` : `/campaigns/${k.id}`)}>
                <div><b>{k.name}</b> <Badge s={k.status} /><div className="small muted">{k.asset || k.objective} · {d(k.start_date)} – {d(k.end_date)}</div></div>
                <div style={{ textAlign: 'right' }}>
                  <div><b>{k.enrols}</b> <span className="small muted">enrolments{k.pred ? ` · pred ${k.pred.enrols?.[0]}–${k.pred.enrols?.[1]}` : ''}</span></div>
                  {k.verdict && <Badge s={k.verdict} />}
                </div>
              </div>
            )) : <div className="muted">No campaigns for this course yet.</div>}
          </Card>
          <Card title="Programme reads" right={<button className="btn sm" disabled={busy} onClick={() => run(() => api.post(`/courses/${courseId}/reads/run`), 'Agent A2 refreshed the reads').then(reload)}>{busy ? 'Running…' : 'Run Agent A2'}</button>}>
            {c.reads.map((r) => (
              <div key={r.id} style={{ marginBottom: 12 }}>
                <div className="row"><h3>{r.title}</h3><Badge s={r.status} />{r.stale_note && <span className="small muted">{r.stale_note}</span>}</div>
                <ul style={{ paddingLeft: 18, marginTop: 4 }}>
                  {(r.items || []).map((it, i) => <li key={i} className="small" style={{ marginBottom: 3 }}>{it.t} <Badge s={it.stamp} /> <span className="muted">· {it.src}</span></li>)}
                </ul>
              </div>
            ))}
          </Card>
          <Card title="Activity">
            {c.activity.slice(0, 8).map((a) => <div key={a.id} className="small" style={{ marginBottom: 6 }}><span className="muted">{d(a.ts)}</span> · {a.text}</div>)}
          </Card>
        </div>
      </div>
    </>
  );
}
