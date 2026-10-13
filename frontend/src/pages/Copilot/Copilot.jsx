import React, { useState, useEffect, useRef } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';

export default function Copilot({ mode = 'page' }) {
  const { HQ, s } = useHQ();
  const r = s.route || {};
  const isPage = mode === 'page';
  const film = HQ.film() || { id: 'f1', title: 'Data Engineering & Cloud DevOps', release: '2026-11-15' };

  const [state, setState] = useState({
    input: '',
    thinking: false,
    thinkLabel: '',
    stream: null,
    streamLen: 0,
    scopeSel: null,
    atts: [],
    attOpen: false
  });

  const scrollRef = useRef(null);
  const docRef = useRef(null);
  const mediaRef = useRef(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [s.threads, state.thinking, state.streamLen]);

  const getScope = () => {
    if (state.scopeSel) return state.scopeSel;
    if (s.copilotCtx && r.name === 'wizard') return s.copilotCtx;
    if (r.name === 'campaign') return (HQ.camp(r.id) || {}).name || film.title;
    if (r.name === 'influencer') {
      const x = HQ.ccOf(r.campId, r.ccId);
      return x ? (HQ.creator(x.creatorId)?.name || 'Source') + ' · ' + (HQ.camp(r.campId)?.name || '') : film.title;
    }
    if (r.name === 'creator') return (HQ.creator(r.id) || {}).name || 'Creator Bank';
    if (r.name === 'wizard') return 'Create campaign';
    return film.title;
  };

  const scope = getScope();

  let thread = s.threads.find(t => t.id === s.activeThread) || s.threads[0];

  const getAnswer = (q, currentScope) => {
    const low = q.toLowerCase();
    const camps = s.campaigns.filter(c => c.filmId === film.id && c.status !== 'Draft');
    const k1 = camps.find(c => c.checkpoints.some(p => p.verdict === 'Behind'));

    if (/why is .* behind|\bbehind\b|diagnos/.test(low) && k1) {
      const d = k1.diagnosis;
      return {
        text: `${k1.name} is ${d.verdict}: ${d.gap}.\n\nTop causes by share of the gap:\n${d.causes.map((c, i) => `${i + 1}. ${c.label} (${c.share}%): ${c.detail}`).join('\n')}\n\nThe fastest fix is chasing the two confirmed sources who have not posted; it costs nothing extra.`,
        sources: [`Diagnosis · ${HQ.dt(d.when)}`, 'Frozen prediction v1', 'Metric snapshots']
      };
    }
    if (/individual|this candidate|this student|roll no|target (him|her)|phone|@\w+/.test(low)) {
      return {
        text: "I can't do that. HireIQ only reaches aggregate cohorts and never targets or isolates an individual candidate (RR-H01). The request has been logged with its basis. Individuals should use the standard enrolment channel: the programme's Resolence registration page.",
        sources: ['Governance rule RR-H01']
      };
    }
    if (/caste|religion|gender|women only|men only|disab/.test(low)) {
      return {
        text: "I can't segment or exclude by caste, religion, gender, disability or another protected attribute (RR-H02). The request has been logged and routed to the fairness reviewer. I can help define the cohort by district, qualification, skill background and age or experience band instead.",
        sources: ['Governance rule RR-H02']
      };
    }
    if (/fix warangal|warangal enrolments|placement cell/.test(low)) {
      return {
        text: 'Placement-cell and youth-forum broadcasts convert best for Warangal graduates: KITS Warangal Placement Cell turned 1,850 tracked clicks into 24 enrolments. Warangal Youth Forum is confirmed but has not posted. Moving the unused reel budget from Hyderabad Tech Jobs to a campus session at KITS Warangal is the strongest move for the remaining days.',
        sources: ['Diagnosis · Warangal engineering graduates', 'Resolence counts per tag'],
        proposal: k1 ? {
          title: 'Move ₹60,000 to a campus session at KITS Warangal',
          detail: `Predicted +10 to 18 enrolments. Creates plan v${k1.version + 1}; the original prediction is kept.`,
          kind: 'move',
          campId: k1.id,
          moveId: 'm2'
        } : null
      };
    }
    if (/(generate|make|create).*(poster|card|carousel|concept|creative)|forwardable card|carousel concept/.test(low)) {
      return {
        text: "Here is a WhatsApp-forwardable card concept built from the primary narrative. I can't produce final artwork here; treat it as a brief for your designer. It carries the tracked QR code and no placement or salary claims.",
        sources: ['Narrative: From Warangal campus to a data team', 'Course brief: Eligibility, Fee and stipend'],
        creative: {
          title: 'Nine months ago',
          desc: 'Square card. Batch 3 alumnus portrait (with consent), quote "9 months ago I was where you are." Below: "Free for eligible graduates · ₹2,500/month stipend · Batch 4 starts 16 Nov". Tagged QR bottom-right. Telugu with English technical terms.'
        }
      };
    }
    if (/(draft|write).*(caption|hook|script)/.test(low)) {
      return {
        text: 'Telugu (romanised): "B.Tech ayyaka next enti? Applied AI Batch 4 ki fee ledu, nelaki ₹2,500 stipend. Link lo register cheyyandi. #AppliedAIBatch4 #ad"\n(English: What after B.Tech? No fee for Applied AI Batch 4 and a ₹2,500 monthly stipend. Register through the link.)\n\nThe tracked link is added per post when the item is created.',
        sources: ['Course brief: Fee and stipend', 'Narrative hook']
      };
    }
    if (/(recommend|suggest).*(source|creator|influencer)|trusted by this cohort|^who should/.test(low)) {
      const top = HQ.rank({ objective: 'Getting onboarded', markets: ['Warangal', 'Hanumakonda'], languages: ['Telugu', 'English'] }).list.slice(0, 3);
      return {
        text: `Top eligible sources for ${film.title} in Warangal (trust first, then reach, quality and fit):\n${top.map((r, i) => `${i + 1}. ${r.c.name} (${r.c.type}, ${r.c.platform}): trust ${r.trustPct}%, ${r.c.attributed || 0} past enrolments, ${r.c.rate ? HQ.inr(r.c.rate) + '/post' : 'partnership'} (${r.c.rateSrc})`).join('\n')}\n\nBlocked: Placement Prep Telugu (backed out 2 of last 3) and SNIST Placement Cell (no consent record, RR-H06).`,
        sources: [`Creator Bank · ${s.creators.length} sources`, 'Rate card'],
        proposal: k1 ? {
          title: `Add ${top[0].c.name} to ${k1.name} as Identified`,
          detail: `Fee estimate ${top[0].c.rate ? HQ.inr(top[0].c.rate) + ' per post' : 'zero (partnership)'}. You can record the deal afterwards.`,
          kind: 'add',
          campId: k1.id,
          creatorId: top[0].c.id
        } : null
      };
    }
    if (/^summar|status report|overview of/.test(low)) {
      const lines = camps.map(c => {
        const cStat = HQ.campStats(c);
        const cp = c.checkpoints.filter(p => p.verdict).slice(-1)[0];
        return `· ${c.name} (${c.status}): ${cStat.enrols} screening enrolments${c.target ? ' of ' + c.target : ''}, ${cStat.regs} registrations, ${cStat.enrols ? HQ.inr(cStat.cpe) + ' per enrolment' : 'no enrolments yet'}${cp ? ', ' + cp.verdict + ' at ' + cp.label : ''}`;
      });
      return {
        text: `${film.title} ${film.batch || ''} starts ${HQ.d(film.release)} (${HQ.daysBetween(HQ.TODAY, film.release)} days).\n\n${lines.join('\n')}`,
        sources: ['Dashboard aggregation', `Resolence counts · ${HQ.dt(HQ.TODAY + 'T08:00')}`]
      };
    }

    const now = HQ.dt(HQ.TODAY + 'T' + new Date().toTimeString().slice(0, 5));
    const liveNote = `Live campaign data · ${now}`;
    const campStatsList = camps.map(c => ({ c, st: HQ.campStats(c) }));
    const tot = campStatsList.reduce((a, x) => ({
      clicks: a.clicks + (x.st.clicks || 0),
      regs: a.regs + (x.st.regs || 0),
      enrols: a.enrols + (x.st.enrols || 0),
      comments: a.comments + (x.st.comments || 0),
      committed: a.committed + (x.st.committed || 0),
      budget: a.budget + (x.c.budget || 0)
    }), { clicks: 0, regs: 0, enrols: 0, comments: 0, committed: 0, budget: 0 });

    if (/budget (left|remaining)|how much budget|spend so far/.test(low)) {
      return {
        text: `${film.title} spend right now:\n${campStatsList.map(x => `· ${x.c.name}: ${HQ.inrL(x.st.committed || 0)} committed of ${HQ.inrL(x.c.budget || 0)}${x.st.enrols ? ' · ' + HQ.inr(Math.round((x.st.committed || 0) / x.st.enrols)) + ' per enrolment' : ' · no enrolments yet'}`).join('\n')}\n\nTotal: ${HQ.inrL(tot.committed)} committed of ${HQ.inrL(tot.budget)}. ${tot.budget - tot.committed > 0 ? HQ.inrL(tot.budget - tot.committed) + ' is still free to move to the sources with the lowest cost per enrolment.' : 'The budget is fully committed.'}`,
        sources: ['Deals · rate card', liveNote]
      };
    }
    if (/how are enrolments|enrolment funnel|funnel/.test(low)) {
      return {
        text: `Funnel for ${film.title} so far:\n· Tracked clicks: ${HQ.n(tot.clicks)}\n· Registrations: ${HQ.n(tot.regs)}${tot.clicks ? ' (' + (tot.regs / tot.clicks * 100).toFixed(1) + '% of clicks)' : ''}\n· Screening enrolments: ${tot.enrols}${tot.regs ? ' (' + (tot.enrols / tot.regs * 100).toFixed(1) + '% of registrations)' : ''}${film.target ? '\n\nBatch target is ' + film.target + ' enrolments; ' + Math.max(0, film.target - tot.enrols) + ' to go.' : ''}`,
        sources: ['Resolence registrations', 'Tracked links', liveNote]
      };
    }
    if (/what are people saying|comment sentiment|most used words/.test(low)) {
      const pos = campStatsList.length ? Math.round(campStatsList.reduce((a, x) => a + (x.st.pos || 0), 0) / campStatsList.length) : 0;
      return {
        text: `Across ${HQ.n(tot.comments)} comments on ${film.title} posts, about ${pos}% are positive.\n\nMost used words: Eligibility (23%), Placement (20%), Free (16%), Apply link (13%), Salary (11%).\n\nThe main open question is who is eligible. A pinned comment with the eligible graduation years and qualifications would cut repeat questions.`,
        sources: ['Comment analysis', liveNote]
      };
    }
    if (/which source is performing best|top sources|best source/.test(low)) {
      const L = [];
      camps.forEach(c => c.ccs.forEach(xItem => {
        const ccSt = HQ.ccStats(xItem);
        L.push({ cr: HQ.creator(xItem.creatorId), s: ccSt });
      }));
      L.sort((a, b) => (b.s.enrols || 0) - (a.s.enrols || 0));
      if (!L.length || !L[0].s.enrols) {
        return {
          text: `No enrolments are attributed to a source yet for ${film.title}. I will rank sources as soon as the first enrolments come in.`,
          sources: [liveNote]
        };
      }
      return {
        text: `Top sources by screening enrolments:\n${L.slice(0, 3).map((xItem, i) => `${i + 1}. ${xItem.cr.name} (${xItem.cr.platform}): ${xItem.s.enrols} enrolments${xItem.s.cpi ? ', ' + HQ.inr(Math.round(xItem.s.cpi)) + ' per enrolment' : ''}`).join('\n')}`,
        sources: ['Resolence enrolment record', liveNote]
      };
    }
    if (/coming up this week|upcoming checkpoints/.test(low)) {
      const up = [];
      camps.forEach(c => (c.checkpoints || []).filter(p => !p.verdict && p.date >= HQ.TODAY).forEach(p => up.push({ c, p })));
      up.sort((a, b) => a.p.date < b.p.date ? -1 : 1);
      return {
        text: up.length ? `Coming up for ${film.title}:\n${up.slice(0, 4).map(xItem => `· ${HQ.ds(xItem.p.date)}: ${xItem.c.name}, ${xItem.p.label} checkpoint`).join('\n')}` : 'No checkpoints are scheduled. Create or launch a campaign to set them.',
        sources: ['Checkpoints', liveNote]
      };
    }
    if (/biggest risks/.test(low)) {
      return {
        text: `Current risks for ${film.title}:\n· Confirmed sources who have not posted yet.\n· Eligibility confusion in comments lowers registration-to-enrolment conversion.\n· Paid posts without #ad, or targeting by a protected attribute, will be blocked by the fairness check.\n· Institutional sources need recorded consent before posting.`,
        sources: ['Governance rules', liveNote]
      };
    }

    return {
      text: `For ${currentScope}: ask me about budget, the enrolment funnel, comments, top sources, upcoming checkpoints or risks, or ask me to recommend sources, draft a Telugu caption or generate a forwardable card.`,
      sources: []
    };
  };

  const handleSend = (textInput) => {
    let q = (textInput || state.input).trim();
    const atts = state.atts;
    if ((!q && !atts.length) || state.thinking || state.stream) return;
    if (!q) q = `Use the attached ${atts.length === 1 ? 'file' : atts.length + ' files'} as context.`;

    let tid = thread && (isPage || thread.scope === scope) ? thread.id : null;
    HQ.set(z => {
      if (!tid) {
        tid = HQ.uid('th');
        z.threads.unshift({ id: tid, title: q.slice(0, 48), scope, date: HQ.TODAY, messages: [] });
        z.activeThread = tid;
      }
      const targetThread = z.threads.find(x => x.id === tid);
      if (!targetThread.messages.length) targetThread.title = q.slice(0, 48);
      targetThread.messages.push({
        role: 'user',
        text: q,
        atts: atts.map(a => ({ name: a.name, kind: a.kind }))
      });
      atts.forEach(a => {
        z.files.unshift({
          id: HQ.uid('fl'),
          filmId: film.id,
          name: a.name,
          size: a.size,
          lane: a.kind === 'file' ? 'Brief material' : 'Brand assets',
          date: HQ.TODAY,
          by: 'Anika Rao',
          status: 'Uploaded via Copilot'
        });
      });
    });

    setState(prev => ({
      ...prev,
      input: '',
      atts: [],
      thinking: true,
      thinkLabel: /poster|creative|generate|image/i.test(q) ? 'Generating creative concept…' : `Reading ${scope} context and graph…`
    }));

    setTimeout(() => {
      const a = getAnswer(q, scope);
      HQ.set(z => {
        const targetThread = z.threads.find(x => x.id === tid);
        targetThread.messages.push({
          role: 'ai',
          text: a.text,
          sources: a.sources,
          proposal: a.proposal ? { ...a.proposal, status: 'Open' } : null,
          creative: a.creative || null
        });
        if (a.creative) {
          z.files.unshift({
            id: HQ.uid('fl'),
            filmId: film.id,
            name: 'copilot-concept-' + a.creative.title.toLowerCase().replace(/\s+/g, '-') + '.png',
            size: '1.1 MB',
            lane: 'Brand assets',
            date: HQ.TODAY,
            by: 'Copilot',
            status: 'Generated'
          });
        }
      });
      setState(prev => ({ ...prev, thinking: false }));
    }, 600);
  };

  const msgs = thread && (isPage || thread.scope === scope || !state.scopeSel) ? thread.messages : [];
  const showMsgs = (isPage || (thread && thread.scope === scope)) ? msgs : [];

  const sugg = (/Dashboard/.test(scope) || scope === film.title
    ? ['Why is Warangal engineering graduates behind?', 'Summarise campaigns', 'How are enrolments tracking?', 'How much budget is left?', 'What are people saying in comments?', 'Which source is performing best?', 'What is coming up this week?', 'Biggest risks right now', 'Fix Warangal enrolments', 'Generate a forwardable card']
    : /Create campaign/.test(scope)
    ? ['Which sources are trusted by this cohort?', 'Draft a Telugu hook', 'Generate a carousel concept']
    : ['Recommend sources', 'Draft a Telugu caption', 'How much budget is left?', 'What are people saying in comments?', 'Which source is performing best?', 'Generate a forwardable card']
  );

  return (
    <div style={{ display: 'flex', height: isPage ? 'calc(100vh - 60px)' : '100%', minHeight: 0, flex: 1 }}>
      {/* Threads Sidebar (Page Mode only) */}
      {isPage && (
        <div style={{ width: '280px', flex: 'none', borderRight: '1px solid var(--ink-100)', background: '#fff', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: '16px' }}>Copilot</b>
            <button
              onClick={() => {
                const id = HQ.uid('th');
                HQ.set(z => {
                  z.threads.unshift({ id, title: 'New chat', scope, date: HQ.TODAY, messages: [] });
                  z.activeThread = id;
                });
              }}
              style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center' }}
            >
              <Icon name="i-plus" size={14} /> New chat
            </button>
          </div>
          <div style={{ overflow: 'auto', padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {s.threads.map(t => (
              <button
                key={t.id}
                onClick={() => HQ.set(z => { z.activeThread = t.id; })}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  border: 0,
                  borderRadius: '8px',
                  background: thread && t.id === thread.id ? 'var(--teal-50)' : 'transparent',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
                  {t.scope} · {HQ.ds(t.date)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: isPage ? 'var(--ink-25)' : '#fff' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ink-100)', display: 'flex', alignItems: 'center', gap: '10px', background: '#fff' }}>
          <span style={{ color: 'var(--teal-700)', display: 'flex' }}>
            <Icon name="i-spark" size={18} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>{isPage ? (thread ? thread.title : 'New chat') : 'Copilot'}</div>
            <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Scoped to {scope}</div>
          </div>
          {!isPage && (
            <>
              <button
                onClick={() => HQ.set(z => { z.copilotOpen = false; z.route = { name: 'copilot' }; })}
                title="Open full page"
                style={{ width: '32px', height: '32px', border: 0, borderRadius: '6px', background: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-500)' }}
              >
                <Icon name="i-ext" size={16} />
              </button>
              <button
                onClick={() => HQ.set(z => { z.copilotOpen = false; })}
                aria-label="Close"
                style={{ width: '32px', height: '32px', border: 0, borderRadius: '6px', background: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-500)' }}
              >
                <Icon name="i-x" size={16} />
              </button>
            </>
          )}
        </div>

        {/* Messages List */}
        <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: 0 }}>
          {!showMsgs.length && !state.thinking && (
            <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start', maxWidth: '560px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--teal-50)', color: 'var(--teal-700)', display: 'grid', placeItems: 'center' }}>
                <Icon name="i-spark" size={22} />
              </div>
              <b style={{ fontSize: '18px' }}>Ask about {scope}</b>
              <p style={{ margin: 0, color: 'var(--ink-600)', fontSize: '13px' }}>
                Answers cite their sources. Changes arrive as proposals you accept or discard. Copilot never invents source handles.
              </p>
            </div>
          )}

          {showMsgs.map((m, i) => {
            const isAI = m.role === 'ai';
            const p = m.proposal;

            return (
              <div key={i} style={{ display: 'flex', justifyContent: isAI ? 'flex-start' : 'flex-end' }}>
                <div style={{ maxWidth: isAI ? '92%' : '80%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {m.atts && m.atts.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {m.atts.map((a, ai) => (
                        <span key={ai} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '28px', padding: '0 10px', borderRadius: '8px', background: '#fff', border: '1px solid var(--ink-100)', fontSize: '12px', maxWidth: '240px' }}>
                          <Icon name={a.kind === 'file' ? 'i-file' : a.kind === 'video' ? 'i-play' : 'i-image'} size={13} style={{ color: 'var(--ink-600)' }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ padding: '10px 14px', borderRadius: '12px', background: isAI ? '#fff' : 'var(--teal-700)', color: isAI ? 'var(--ink-900)' : '#fff', border: isAI ? '1px solid var(--ink-100)' : 0, fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {m.text}
                  </div>

                  {m.sources && m.sources.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {m.sources.map((src, si) => (
                        <span key={si} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '22px', padding: '0 8px', borderRadius: '6px', background: 'var(--ink-50)', border: '1px solid var(--ink-100)', fontSize: '11px', color: 'var(--ink-600)' }}>
                          <Icon name="i-link" size={11} /> {src}
                        </span>
                      ))}
                    </div>
                  )}

                  {p && (
                    <div style={{ background: '#fff', border: '1.5px solid var(--teal-600)', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ display: 'inline-flex', height: '20px', padding: '0 6px', borderRadius: '4px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '11px', fontWeight: 600, alignItems: 'center' }}>
                          Proposal
                        </span>
                        <b style={{ fontSize: '13px' }}>{p.title}</b>
                      </div>
                      <span style={{ fontSize: '13px', color: 'var(--ink-700)' }}>{p.detail}</span>
                      {p.status === 'Open' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              HQ.set(z => {
                                const t = z.threads.find(x => x.id === thread.id);
                                t.messages[i].proposal.status = 'Accepted';
                                if (p.kind === 'move' && p.campId) {
                                  const k = z.campaigns.find(q => q.id === p.campId);
                                  const mv = k.moves.find(q => q.id === p.moveId);
                                  if (mv && mv.status === 'Open') {
                                    mv.status = 'Accepted';
                                    k.version += 1;
                                    k.versions.push({ v: k.version, date: HQ.TODAY, by: 'Anika Rao via Copilot', note: `Accepted move: ${mv.title}.` });
                                    k.boosts = (k.boosts || []).concat([mv.cost]);
                                  }
                                }
                                if (p.kind === 'add' && p.campId) {
                                  const k = z.campaigns.find(q => q.id === p.campId);
                                  const cr = z.creators.find(q => q.id === p.creatorId);
                                  if (!k.ccs.some(x => x.creatorId === cr.id)) {
                                    k.ccs.push({
                                      id: HQ.uid('cc'),
                                      campId: k.id,
                                      creatorId: cr.id,
                                      narrative: (k.narratives[0] || {}).id,
                                      channel: cr.platform,
                                      status: 'Identified',
                                      deal: { rate: cr.rate, posts: 1, type: 'Paid', del: '1 post', start: HQ.TODAY, end: HQ.addDays(HQ.TODAY, 7), terms: '' },
                                      posts: [],
                                      content: [],
                                      log: [{ date: HQ.TODAY, text: 'Added via Copilot proposal' }],
                                      predViews: [Math.round(cr.mv * 0.62), Math.round(cr.mv * 1.45)]
                                    });
                                  }
                                }
                              });
                              HQ.toast('Proposal accepted and applied');
                            }}
                            style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => {
                              HQ.set(z => {
                                const t = z.threads.find(x => x.id === thread.id);
                                t.messages[i].proposal.status = 'Dismissed';
                              });
                              HQ.toast('Proposal discarded');
                            }}
                            style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                          >
                            Discard
                          </button>
                        </div>
                      ) : (
                        <span style={{ display: 'inline-flex', alignSelf: 'flex-start', height: '22px', padding: '0 8px', borderRadius: '999px', background: HQ.tone(p.status).bg, color: HQ.tone(p.status).fg, fontSize: '12px', fontWeight: 600, alignItems: 'center' }}>
                          {p.status}
                        </span>
                      )}
                    </div>
                  )}

                  {m.creative && (
                    <div style={{ display: 'flex', gap: '12px', background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '10px' }}>
                      <div style={{ width: '96px', height: '120px', borderRadius: '8px', background: 'var(--ink-900)', backgroundImage: 'repeating-linear-gradient(135deg,rgba(255,255,255,.06) 0 8px,transparent 8px 16px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '8px', color: '#fff', fontSize: '11px' }}>
                        <span style={{ color: 'var(--ink-300)' }}>Concept</span>
                        <b>{m.creative.title}</b>
                      </div>
                      <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <b>{m.creative.title}</b>
                        <span style={{ color: 'var(--ink-600)' }}>{m.creative.desc}</span>
                        <span style={{ fontSize: '12px', color: 'var(--success-800)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <Icon name="i-check" size={12} /> Saved to Files · Brand assets
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {state.thinking && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: 'var(--ink-500)' }}>
              <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid var(--teal-100)', borderTopColor: 'var(--teal-600)', animation: 'spin .8s linear infinite' }}></span>
              {state.thinkLabel}
            </div>
          )}
        </div>

        {/* Input & Suggestions */}
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--ink-100)', background: '#fff', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {sugg.slice(0, 4).map((label, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(label)}
                style={{ height: '28px', padding: '0 10px', borderRadius: '999px', border: '1px solid var(--ink-200)', background: '#fff', fontSize: '12px', cursor: 'pointer', color: 'var(--ink-700)' }}
              >
                {label}
              </button>
            ))}
          </div>

          <input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt" ref={docRef} onChange={(e) => {
            const files = Array.from(e.target.files || []).map(f => ({ id: HQ.uid('at'), name: f.name, size: f.size > 1e6 ? (f.size / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(f.size / 1e3)) + ' KB', kind: 'file' }));
            setState(prev => ({ ...prev, atts: prev.atts.concat(files), attOpen: false }));
          }} style={{ display: 'none' }} />

          <input type="file" multiple accept="image/*,video/*,audio/*" ref={mediaRef} onChange={(e) => {
            const files = Array.from(e.target.files || []).map(f => ({ id: HQ.uid('at'), name: f.name, size: f.size > 1e6 ? (f.size / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(f.size / 1e3)) + ' KB', kind: /^image\//.test(f.type) ? 'image' : 'video' }));
            setState(prev => ({ ...prev, atts: prev.atts.concat(files), attOpen: false }));
          }} style={{ display: 'none' }} />

          {state.atts.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {state.atts.map(a => (
                <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '30px', padding: '0 6px 0 8px', borderRadius: '8px', background: 'var(--ink-50)', border: '1px solid var(--ink-100)', fontSize: '12px', maxWidth: '240px' }}>
                  <Icon name={a.kind === 'file' ? 'i-file' : 'i-image'} size={14} style={{ color: 'var(--ink-600)' }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                  <button type="button" onClick={() => setState(prev => ({ ...prev, atts: prev.atts.filter(q => q.id !== a.id) }))} style={{ width: '20px', height: '20px', border: 0, background: 'none', cursor: 'pointer', color: 'var(--ink-500)', display: 'grid', placeItems: 'center' }}>
                    <Icon name="i-x" size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}
          >
            <div style={{ position: 'relative', flex: 'none' }}>
              <button
                type="button"
                onClick={() => setState(prev => ({ ...prev, attOpen: !prev.attOpen }))}
                aria-label="Attach"
                title="Attach file or media"
                style={{ width: '42px', height: '42px', borderRadius: '10px', border: '1px solid var(--ink-300)', background: '#fff', color: 'var(--ink-700)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
              >
                <Icon name="i-plus" size={18} />
              </button>

              {state.attOpen && (
                <>
                  <div onClick={() => setState(prev => ({ ...prev, attOpen: false }))} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                  <div style={{ position: 'absolute', left: 0, bottom: '50px', zIndex: 31, width: '220px', background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '10px', boxShadow: 'var(--e-2)', padding: '6px' }}>
                    <button
                      type="button"
                      onClick={() => docRef.current && docRef.current.click()}
                      style={{ width: '100%', display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 10px', border: 0, borderRadius: '6px', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <Icon name="i-file" size={16} />
                      <span>
                        <b style={{ fontWeight: 600, display: 'block', fontSize: '13px' }}>Upload file</b>
                        <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>PDF, DOCX, XLSX, CSV</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => mediaRef.current && mediaRef.current.click()}
                      style={{ width: '100%', display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 10px', border: 0, borderRadius: '6px', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <Icon name="i-image" size={16} />
                      <span>
                        <b style={{ fontWeight: 600, display: 'block', fontSize: '13px' }}>Upload media</b>
                        <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Images, video, audio</span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <textarea
              value={state.input}
              onChange={(e) => setState(prev => ({ ...prev, input: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask, or say 'generate a poster concept'"
              rows={1}
              style={{ flex: 1, minHeight: '42px', maxHeight: '120px', padding: '10px 12px', border: '1px solid var(--ink-300)', borderRadius: '10px', resize: 'none' }}
            />

            <button
              type="submit"
              aria-label="Send"
              style={{ width: '42px', height: '42px', borderRadius: '10px', border: 0, background: 'var(--teal-700)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            >
              <Icon name="i-send" size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
