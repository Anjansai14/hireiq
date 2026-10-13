import React, { useState } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';

export default function Artifacts() {
  const { HQ, s } = useHQ();
  const film = HQ.film() || { id: 'f1', title: 'Data Engineering & Cloud DevOps' };

  const [tab, setTab] = useState('image');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(null);

  const data = (title) => {
    const slug = title.toLowerCase().replace(/\s+/g, '-');
    return [
      { id: 'a1', kind: 'image', name: 'Alumni testimonial card · Telugu', fmt: 'PNG', size: '1.4 MB', dims: '1080×1080', created: '2026-09-21', updated: '2026-10-02', thread: 'Forwardable cards for Warangal', prompt: 'WhatsApp-forwardable card in Telugu: Batch 3 alumnus quote, eligibility line, tagged QR to the Resolence page. No salary figures.', log: [['QR moved to bottom-right', '2026-10-02'], ['Created from alumni quote (consent on file)', '2026-09-21']] },
      { id: 'a2', kind: 'image', name: 'Eligibility carousel · 5 slides', fmt: 'PNG', size: '2.2 MB', dims: '1080×1350', created: '2026-09-26', updated: '2026-09-27', thread: 'Can you apply?', prompt: '5-slide carousel: graduation years, degree, aggregate, schedule, how to register. English with Telugu captions.', log: [['Slide 3 reworded: 60% aggregate', '2026-09-27'], ['Created', '2026-09-26']] },
      { id: 'a3', kind: 'image', name: 'Campus info-session poster · JNTUH', fmt: 'PNG', size: '1.1 MB', dims: '1080×1350', created: '2026-09-30', updated: '2026-10-01', thread: 'JNTUH info session', prompt: "Event poster for a 45-minute info session with the JNTUH Students' Forum on 4 Oct, tagged QR for registration.", log: [['Date and venue added', '2026-10-01'], ['Created', '2026-09-30']] },
      { id: 'a4', kind: 'image', name: 'Stipend forwardable card', fmt: 'PNG', size: '760 KB', dims: '1080×1080', created: '2026-10-03', updated: '2026-10-03', thread: 'Forwardable cards for Warangal', prompt: 'Card: "No fee · ₹2,500 a month while you learn · Batch 4 starts 16 Nov". Telugu first, English second.', log: [['Created', '2026-10-03']] },
      { id: 'v1', kind: 'video', name: 'Alumni testimonial cut · 45s', fmt: 'MP4', size: '22.6 MB', dims: '1080×1920', dur: '0:45', created: '2026-09-24', updated: '2026-09-29', thread: 'Alumni stories', prompt: "Cut Sai Kiran Reddy's interview to 45 seconds: where he started, his capstone, who should apply. Burned-in Telugu subtitles.", log: [['Subtitles corrected', '2026-09-29'], ['Created', '2026-09-24']] },
      { id: 'v2', kind: 'video', name: 'Syllabus walkthrough short · 60s', fmt: 'MP4', size: '28.1 MB', dims: '1080×1920', dur: '1:00', created: '2026-09-27', updated: '2026-09-27', thread: 'Can you apply?', prompt: 'One-minute short covering the 16 weeks of the syllabus, ending on the eligibility line and tracked link.', log: [['Created', '2026-09-27']] },
      { id: 'v3', kind: 'video', name: 'Live Q&A highlight · 90s', fmt: 'MP4', size: '41.3 MB', dims: '1920×1080', dur: '1:30', created: '2026-10-05', updated: '2026-10-05', thread: 'Answering placement doubts', prompt: 'Highlight from the live Q&A answering "Is it really free?" and "Is there a weekend batch?". No placement-rate claims.', log: [['Created', '2026-10-05']] },
      { id: 'r1', kind: 'report', name: 'Warangal campaign plan · v2', fmt: 'PDF', size: '290 KB', pages: 6, created: '2026-09-29', updated: '2026-09-29', thread: 'Why is Warangal engineering graduates behind?', prompt: 'Export the plan for Warangal engineering graduates: narratives, channels, sources and the frozen prediction. No contact details.', log: [['v2: shifted ₹40,000 to WhatsApp placement-cell cards', '2026-09-29'], ['v1 created', '2026-09-20']] },
      { id: 'r2', kind: 'report', name: 'Weekly enrolment funnel · week 40', fmt: 'PDF', size: '1.3 MB', pages: 5, created: '2026-10-06', updated: '2026-10-06', thread: 'Weekly summary', prompt: 'Weekly funnel per campaign, cohort and district: reach, clicks, registrations, screening enrolments, unattributed. Counts only.', log: [['Resolence counts refreshed 08:00', '2026-10-06'], ['Created', '2026-10-06']] },
      { id: 'r3', kind: 'report', name: 'Cost per enrolment vs ceiling', fmt: 'XLSX', size: '96 KB', pages: 2, created: '2026-10-04', updated: '2026-10-06', thread: 'Budget check', prompt: 'Compare spend per source with attributed enrolments and the ₹4,500 ceiling; flag sources above it.', log: [['Updated with Day 14 counts', '2026-10-06'], ['Created', '2026-10-04']] }
    ].map(a => ({ file: slug + '-' + a.id, ...a }));
  };

  const all = data(film.title).filter(a => !(s.artDeleted || []).includes(film.id + ':' + a.id));

  const look = (a) => {
    if (a.kind === 'video') return { bg: 'var(--ink-800)', fg: '#fff', icon: 'i-play', ratio: '16/10' };
    if (a.kind === 'report') return { bg: 'var(--ink-50)', fg: 'var(--ink-600)', icon: 'i-file', ratio: '16/10' };
    return { bg: 'var(--teal-50)', fg: 'var(--teal-700)', icon: 'i-image', ratio: '16/10' };
  };

  const tabsL = [
    ['image', 'Images', 'i-image', all.filter(a => a.kind === 'image').length],
    ['video', 'Video', 'i-play', all.filter(a => a.kind === 'video').length],
    ['report', 'Report', 'i-file', all.filter(a => a.kind === 'report').length]
  ];

  const list = all.filter(a => a.kind === tab && a.name.toLowerCase().includes(q.toLowerCase()));
  const sel = all.find(a => a.id === selId);

  const downloadArtifact = (a) => {
    const b = new Blob([
      `InfluenceIQ prototype placeholder for ${a.name}\nGenerated by Copilot · ${a.thread}\nPrompt: ${a.prompt}`
    ], { type: 'text/plain' });
    const x = document.createElement('a');
    x.href = URL.createObjectURL(b);
    x.download = a.file + '.txt';
    document.body.appendChild(x);
    x.click();
    x.remove();
    HQ.toast(`Downloading ${a.name}`);
  };

  const removeArtifact = (a) => {
    HQ.set(z => {
      z.artDeleted = (z.artDeleted || []).concat([film.id + ':' + a.id]);
    });
    setSelId(null);
    HQ.toast(`${a.name} deleted`);
  };

  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: '1240px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600, letterSpacing: '-.015em' }}>Artifacts</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-600)' }}>
            {film.title} · everything Copilot has generated for this course
          </p>
        </div>
        <div style={{ position: 'relative', width: '240px', maxWidth: '100%' }}>
          <span style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--ink-500)', display: 'flex' }}>
            <Icon name="i-search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search artifacts"
            style={{ width: '100%', height: '40px', padding: '0 12px 0 36px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--ink-100)', overflowX: 'auto', overflowY: 'hidden' }}>
        {tabsL.map(([k, label, ic, count]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: 0,
              background: 'none',
              padding: '10px 0',
              marginBottom: '-1px',
              borderBottom: tab === k ? '2px solid var(--teal-600)' : '2px solid transparent',
              color: tab === k ? 'var(--teal-800)' : 'var(--ink-600)',
              fontWeight: tab === k ? 600 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Icon name={ic} size={16} />
            {label} <span style={{ color: 'var(--ink-500)', fontWeight: 400 }}>{count}</span>
          </button>
        ))}
      </div>

      {/* Grid */}
      {!list.length ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--ink-500)', background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px' }}>
          Nothing here yet. Ask Copilot to generate one.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
          {list.map(a => {
            const visual = look(a);
            const metaStr = `${HQ.ds(a.created)} · ${a.fmt} · ${a.size}`;

            return (
              <div
                key={a.id}
                onClick={() => setSelId(a.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  textAlign: 'left',
                  padding: 0,
                  border: '1px solid var(--ink-100)',
                  borderRadius: '12px',
                  background: '#fff',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  color: 'inherit'
                }}
              >
                <div style={{ position: 'relative', aspectRatio: visual.ratio, background: visual.bg, display: 'grid', placeItems: 'center', color: visual.fg }}>
                  {a.kind === 'report' ? (
                    <div style={{ width: '62%', height: '78%', background: '#fff', borderRadius: '4px', boxShadow: 'var(--e-1)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ height: '6px', width: '70%', background: 'var(--ink-300)', borderRadius: '2px' }} />
                      <span style={{ height: '4px', width: '100%', background: 'var(--ink-100)', borderRadius: '2px' }} />
                      <span style={{ height: '4px', width: '90%', background: 'var(--ink-100)', borderRadius: '2px' }} />
                      <span style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '4px', paddingTop: '6px' }}>
                        <span style={{ flex: 1, height: '40%', background: 'var(--teal-100)' }} />
                        <span style={{ flex: 1, height: '70%', background: 'var(--teal-600)' }} />
                        <span style={{ flex: 1, height: '55%', background: 'var(--teal-100)' }} />
                        <span style={{ flex: 1, height: '90%', background: 'var(--teal-600)' }} />
                      </span>
                    </div>
                  ) : (
                    <Icon name={visual.icon} size={28} />
                  )}
                  {a.dur && (
                    <span style={{ position: 'absolute', right: '8px', bottom: '8px', height: '20px', padding: '0 6px', borderRadius: '4px', background: 'rgba(16,36,43,.75)', color: '#fff', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                      {a.dur}
                    </span>
                  )}
                </div>

                <div style={{ padding: '10px 8px 10px 14px', display: 'flex', gap: '4px', alignItems: 'center', minWidth: 0, borderTop: '1px solid var(--ink-100)' }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <b style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</b>
                    <span style={{ fontSize: '12px', color: 'var(--ink-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{metaStr}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadArtifact(a);
                    }}
                    aria-label="Download"
                    title="Download"
                    style={{ width: '32px', height: '32px', flex: 'none', border: 0, borderRadius: '6px', background: 'none', cursor: 'pointer', color: 'var(--ink-600)', display: 'grid', placeItems: 'center' }}
                  >
                    <Icon name="i-download" size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeArtifact(a);
                    }}
                    aria-label="Delete"
                    title="Delete"
                    style={{ width: '32px', height: '32px', flex: 'none', border: 0, borderRadius: '6px', background: 'none', cursor: 'pointer', color: 'var(--ink-600)', display: 'grid', placeItems: 'center' }}
                  >
                    <Icon name="i-trash" size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal View for Artifact */}
      {sel && (
        <div
          onClick={() => setSelId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(16,36,43,.45)', display: 'grid', placeItems: 'center', zIndex: 60, padding: '24px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '640px', maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: '16px', boxShadow: 'var(--e-3)', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ aspectRatio: look(sel).ratio, maxHeight: '360px', background: look(sel).bg, color: look(sel).fg, display: 'grid', placeItems: 'center', borderRadius: '16px 16px 0 0' }}>
              <Icon name={look(sel).icon} size={40} />
            </div>

            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: '18px', display: 'block' }}>{sel.name}</b>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>{HQ.ds(sel.created)} · {sel.fmt} · {sel.size}</span>
                </div>
                <button onClick={() => setSelId(null)} aria-label="Close" style={{ width: '32px', height: '32px', border: 0, borderRadius: '6px', background: 'none', cursor: 'pointer', color: 'var(--ink-500)', display: 'grid', placeItems: 'center' }}>
                  <Icon name="i-x" size={16} />
                </button>
              </div>

              <div style={{ padding: '12px 14px', background: 'var(--ink-50)', borderRadius: '8px', fontSize: '13px', color: 'var(--ink-700)' }}>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-500)', marginBottom: '4px' }}>Prompt</span>
                {sel.prompt}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', fontSize: '13px' }}>
                <div><span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-500)' }}>Format</span><b style={{ fontWeight: 600 }}>{sel.fmt}</b></div>
                <div><span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-500)' }}>Size</span><b style={{ fontWeight: 600 }}>{sel.size}</b></div>
                {sel.dims && <div><span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-500)' }}>Dimensions</span><b style={{ fontWeight: 600 }}>{sel.dims}</b></div>}
                {sel.dur && <div><span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-500)' }}>Duration</span><b style={{ fontWeight: 600 }}>{sel.dur}</b></div>}
                <div><span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-500)' }}>Created</span><b style={{ fontWeight: 600 }}>{HQ.ds(sel.created)}</b></div>
                <div><span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-500)' }}>From thread</span><b style={{ fontWeight: 600 }}>{sel.thread}</b></div>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-500)', marginBottom: '8px' }}>Updates</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sel.log.map(([t, d], idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', fontSize: '13px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--teal-600)', marginTop: '6px', flex: 'none' }} />
                      <span style={{ flex: 1 }}>{t}</span>
                      <span style={{ color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>{HQ.ds(d)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  onClick={() => removeArtifact(sel)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 14px', borderRadius: '8px', border: 0, background: 'none', color: 'var(--danger-600)', fontWeight: 600, cursor: 'pointer', marginRight: 'auto' }}
                >
                  <Icon name="i-trash" size={16} /> Delete
                </button>
                <button
                  onClick={() => {
                    setSelId(null);
                    HQ.set(z => {
                      z.copilotOpen = false;
                      z.route = { name: 'copilot' };
                    });
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Icon name="i-spark" size={16} /> Open in Copilot
                </button>
                <button
                  onClick={() => downloadArtifact(sel)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 16px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Icon name="i-download" size={16} /> Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
