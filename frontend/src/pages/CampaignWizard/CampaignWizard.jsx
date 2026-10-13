import React, { useState, useEffect } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';

export default function CampaignWizard() {
  const { state, HQ, currentCourse, go, set, toast } = useHQ();
  const film = currentCourse;
  const r = (state && state.route) || {};
  const campId = r.id || 'k4';
  const c = (state.campaigns || []).find(k => k.id === campId) || (state.campaigns || [])[0] || {};

  const DEFAULT_CHANNELS = [
    { ch: 'YouTube', format: 'Long video', share: 45 },
    { ch: 'Instagram', format: 'Reels', share: 30 },
    { ch: 'LinkedIn', format: 'Posts', share: 15 },
    { ch: 'WhatsApp', format: 'Community broadcast', share: 10 }
  ];
  const DEFAULT_SHORTLIST = [
    { creatorId: 'c1', posts: 1, fee: 120000, terms: '#ad in description & pinned comment' },
    { creatorId: 'c3', posts: 2, fee: 0, terms: 'Consent letter signed on file' },
    { creatorId: 'c4', posts: 2, fee: 15000, terms: 'No salary figures. Disclosure in first line.' }
  ];
  const DEFAULT_NARRS = [
    { id: 'n1', title: 'From college project to first product engineer', tag: 'Career outcome', hook: 'Final year project lo chestunna mistake idi. In-demand skills tho first job ela kottalo chudandi.', tone: 'Confident', score: 88, role: 'Primary' },
    { id: 'n2', title: 'Zero fee, merit stipend: state AI mission batch', tag: 'Stipend', hook: 'Fee ledu, ₹15,000 stipend kuda undi. Batch 4 screening criteria idi.', tone: 'Honest', score: 82, role: null },
    { id: 'n3', title: 'TASK verified syllabus: what regional GCCs actually test', tag: 'Institutional endorsement', hook: 'Hyderabad companies tier-2/3 colleges nunchi em expect chestunnayo chudandi.', tone: 'Reassuring', score: 78, role: null },
    { id: 'n4', title: 'Why 85% batch placed within 90 days', tag: 'Outcome claim', hook: 'Average package mariyu placement reality check.', tone: 'Energetic', score: 71, role: null, held: true }
  ];
  const wizBase = c.wiz || {};
  const wiz = {
    step: wizBase.step || 0,
    done: wizBase.done || [],
    answers: wizBase.answers || { q1: 'No', q2: 'No', q3: 'No' },
    targetEnrolments: wizBase.targetEnrolments || c.targetEnrolments || 60,
    costCeiling: wizBase.costCeiling || c.costCeiling || 4500,
    budget: wizBase.budget || c.budget || 400000,
    qualification: wizBase.qualification || 'B.Tech / B.E.',
    skill: wizBase.skill || 'CSE, IT, ECE',
    age: wizBase.age || '21–26 years',
    exp: wizBase.exp || '0–2 years experience',
    lang: wizBase.lang || 'Telugu',
    channels: wizBase.channels || DEFAULT_CHANNELS,
    shortlist: wizBase.shortlist || DEFAULT_SHORTLIST,
    narrs: wizBase.narrs || DEFAULT_NARRS
  };

  const initialStep = r.step !== undefined ? Math.max(0, Math.min(5, Number(r.step) - 1)) : (wiz.step || 0);
  const [step, setStep] = useState(initialStep);

  useEffect(() => {
    if (r.step !== undefined) {
      setStep(Math.max(0, Math.min(5, Number(r.step) - 1)));
    }
  }, [r.step]);
  const [campName, setCampName] = useState(c.name || 'Nalgonda and Khammam graduates');
  const [targetEnrolments, setTargetEnrolments] = useState(wiz.targetEnrolments || 60);
  const [costCeiling, setCostCeiling] = useState(wiz.costCeiling || 4500);
  const [budget, setBudget] = useState(wiz.budget || 400000);
  const [selectedState, setSelectedState] = useState(c.markets?.[0] || 'Telangana');
  const [channels, setChannels] = useState(wiz.channels);
  const [shortlist, setShortlist] = useState(wiz.shortlist || []);
  const [selectedNarr, setSelectedNarr] = useState(wiz.narrs?.find(n => n.role === 'Primary')?.id || 'n1');
  const [creating, setCreating] = useState(false);

  const steps = [
    'Objective and cohort',
    'Narrative',
    'Channels',
    'Influencers',
    'Content',
    'Review and create'
  ];

  const updateDraft = (patch) => {
    HQ.set(x => {
      const camp = x.campaigns.find(k => k.id === c.id);
      if (camp) {
        if (!camp.wiz) camp.wiz = {};
        Object.assign(camp.wiz, patch);
      }
    });
  };

  const handleNext = () => {
    if (step < 5) {
      const nextStep = step + 1;
      setStep(nextStep);
      updateDraft({ step: nextStep, done: [...new Set([...wiz.done, step])] });
    }
  };

  const handleBack = () => {
    if (step > 0) {
      const prevStep = step - 1;
      setStep(prevStep);
      updateDraft({ step: prevStep });
    } else {
      go('campaigns');
    }
  };

  const handleCreateCampaign = () => {
    setCreating(true);
    toast('Running governance checks and prediction freeze...');
    setTimeout(() => {
      HQ.set(x => {
        const camp = x.campaigns.find(k => k.id === c.id);
        if (camp) {
          camp.status = 'Live';
          camp.name = campName;
          camp.targetEnrolments = targetEnrolments;
          camp.costCeiling = costCeiling;
          camp.budget = budget;
          camp.spent = 0;
          camp.start = HQ.TODAY;
          camp.end = HQ.addDays(HQ.TODAY, 28);
          camp.checkpoints = [
            { label: '72 hours', verdict: 'On track', note: 'Initial launch' },
            { label: 'Day 7', verdict: null, note: 'Pending' },
            { label: 'Day 14', verdict: null, note: 'Pending' },
            { label: 'Close', verdict: null, note: `Target: ${targetEnrolments} enrolments` }
          ];
        }
      });
      setCreating(false);
      HQ.go('campaign', { id: c.id });
      HQ.toast(`${campName} created and launched!`);
    }, 1500);
  };

  // Channels recalculations
  const totalShare = channels.reduce((acc, ch) => acc + ch.share, 0);

  // Predictions calculation
  const totalFees = shortlist.reduce((acc, s) => {
    const cr = HQ.creator(s.creatorId);
    return acc + ((s.fee != null ? s.fee : cr?.rate || 0) * s.posts);
  }, 0);

  const predictedClicks = Math.round(budget / 22);
  const predictedRegs = Math.round(predictedClicks * 0.1);
  const predictedEnrols = Math.min(targetEnrolments, Math.round(predictedRegs * 0.08));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Top Stepper Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--ink-100)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={handleBack}
          style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--ink-200)', background: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
        >
          <Icon name="i-left" size={16} />
        </button>

        <div style={{ minWidth: '180px' }}>
          <b style={{ fontSize: '15px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
            {campName}
          </b>
          <span style={{ fontSize: '12px', color: 'var(--teal-700)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Icon name="i-check" size={12} /> Draft saved
          </span>
        </div>

        {/* Stepper Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, overflowX: 'auto', padding: '0 12px' }}>
          {steps.map((stLabel, idx) => {
            const on = step === idx;
            const done = idx < step;
            return (
              <button
                key={idx}
                onClick={() => setStep(idx)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '999px',
                  border: 0,
                  background: on ? 'var(--teal-50)' : 'transparent',
                  color: on ? 'var(--teal-800)' : done ? 'var(--ink-900)' : 'var(--ink-500)',
                  fontWeight: on ? 600 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: on ? 'var(--teal-700)' : done ? 'var(--teal-700)' : 'var(--ink-100)',
                  color: on || done ? '#fff' : 'var(--ink-500)',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'grid',
                  placeItems: 'center'
                }}>
                  {done ? '✓' : idx + 1}
                </span>
                {stLabel}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => HQ.set(x => { x.copilotOpen = true; })}
          style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--ink-200)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--teal-700)' }}
        >
          <Icon name="i-spark" size={16} /> Ask about this step
        </button>
      </div>

      {/* Main Step Form Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 100px', maxWidth: '1320px', width: '100%', margin: '0 auto' }}>
        {/* Step 0: Objective and Cohort */}
        {step === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '32px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 0 6px' }}>Objective and cohort</h1>
                <p style={{ margin: 0, color: 'var(--ink-600)', fontSize: '14px' }}>
                  One cohort in one geography for this batch. Cohorts are aggregate groups; no individual can be targeted (RR-H01).
                </p>
              </div>

              <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--e-1)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Campaign name</label>
                  <input
                    value={campName}
                    onChange={e => setCampName(e.target.value)}
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Objective</label>
                    <select
                      value="Getting onboarded"
                      disabled
                      style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: 'var(--ink-50)' }}
                    >
                      <option>Getting onboarded</option>
                      <option>Awareness</option>
                      <option>Engagement</option>
                    </select>
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Registrations and screening enrolments; cost per enrolment is primary KPI.</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>KPI</label>
                    <select
                      value="Screening enrolments"
                      disabled
                      style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: 'var(--ink-50)' }}
                    >
                      <option>Screening enrolments</option>
                    </select>
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Suggested for Getting onboarded: Screening enrolments</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Target enrolments</label>
                    <input
                      type="number"
                      value={targetEnrolments}
                      onChange={e => setTargetEnrolments(+e.target.value)}
                      style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Batch target 300 across all campaigns</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Cost ceiling per enrolment (₹)</label>
                    <input
                      type="number"
                      value={costCeiling}
                      onChange={e => setCostCeiling(+e.target.value)}
                      style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Brief ceiling ₹4,500</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Budget (₹)</label>
                    <input
                      type="number"
                      value={budget}
                      onChange={e => setBudget(+e.target.value)}
                      style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>₹4L · course budget ₹18,00,000</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>States</label>
                    <select
                      value={selectedState}
                      onChange={e => setSelectedState(e.target.value)}
                      style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
                    >
                      {HQ.STATES.map(st => <option key={st}>{st}</option>)}
                    </select>
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Course target area: Telangana</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Qualification</label>
                    <select
                      value={wiz.qualification}
                      onChange={e => updateDraft({ qualification: e.target.value })}
                      style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
                    >
                      <option>B.Tech / B.E.</option>
                      <option>MCA</option>
                      <option>Diploma</option>
                      <option>Any Graduate</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Skill background</label>
                    <select
                      value={wiz.skill}
                      onChange={e => updateDraft({ skill: e.target.value })}
                      style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
                    >
                      <option>CSE, IT, ECE</option>
                      <option>Mechanical, Civil</option>
                      <option>General Tech</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Age band</label>
                    <select
                      value={wiz.age}
                      onChange={e => updateDraft({ age: e.target.value })}
                      style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
                    >
                      <option>21–26 years</option>
                      <option>18–22 years</option>
                      <option>All ages</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Experience band</label>
                    <select
                      value={wiz.exp}
                      onChange={e => updateDraft({ exp: e.target.value })}
                      style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
                    >
                      <option>0–2 years experience</option>
                      <option>Freshers only</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Languages</label>
                    <select
                      value={wiz.lang}
                      onChange={e => updateDraft({ lang: e.target.value })}
                      style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
                    >
                      <option>Telugu</option>
                      <option>English</option>
                      <option>Hindi</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Context Card on Right */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--e-1)' }}>
                <b style={{ fontSize: '15px', display: 'block', marginBottom: '14px' }}>Context from the brief</b>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-500)' }}>Course</span>
                    <b style={{ fontWeight: 600 }}>{film.title}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-500)' }}>Batch</span>
                    <span>{film.batch} · 16 Nov</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-500)' }}>Domain</span>
                    <span>AI/ML · Intermediate</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-500)' }}>Mode</span>
                    <span>16 weeks · Hybrid</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-500)' }}>Days to batch start</span>
                    <b style={{ color: 'var(--hire)' }}>41</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-500)' }}>Batch target</span>
                    <b>300 enrolments</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-500)' }}>Other campaigns</span>
                    <span>3</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--ink-100)', paddingTop: '10px', marginTop: '4px' }}>
                    <span style={{ color: 'var(--ink-500)', display: 'block', marginBottom: '2px' }}>Eligibility</span>
                    <span style={{ color: 'var(--ink-800)', fontSize: '12px' }}>{film.brief?.eligibility}</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px 18px', borderRadius: '10px', background: 'var(--info-100)', color: 'var(--info-800)', fontSize: '13px', border: '1px solid #BDD5F2' }}>
                Drafts auto-save. Changing this step later marks Narrative, Channels and Influencers as Needs attention.
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Narrative */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 0 6px' }}>Narrative</h1>
                <p style={{ margin: 0, color: 'var(--ink-600)', fontSize: '14px' }}>
                  Select one narrative for this campaign. A higher score means a better match for your audience.
                </p>
              </div>
              <button
                onClick={() => toast('Re-evaluating narrative angles with audience signals...')}
                style={{ height: '36px', padding: '0 14px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Icon name="i-spark" size={16} /> Rewrite
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
              {wiz.narrs.map(narr => {
                const isSelected = selectedNarr === narr.id;
                return (
                  <div
                    key={narr.id}
                    onClick={() => {
                      if (narr.held) {
                        toast('RR-H03 Notice: 85% placement rate requires evidence attachment on the brief before narrative release', 'error');
                      }
                      setSelectedNarr(narr.id);
                      updateDraft({
                        narrs: wiz.narrs.map(q => ({ ...q, role: q.id === narr.id ? 'Primary' : null }))
                      });
                    }}
                    style={{
                      background: isSelected ? 'var(--teal-50)' : '#fff',
                      border: `2px solid ${isSelected ? 'var(--teal-600)' : 'var(--ink-200)'}`,
                      borderRadius: '12px',
                      padding: '20px',
                      boxShadow: 'var(--e-1)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', background: 'var(--ink-100)', color: 'var(--ink-700)' }}>
                        {narr.tag}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Match {narr.score}/100</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: 'var(--info-100)', color: 'var(--info-800)' }}>
                          {narr.tone}
                        </span>
                      </div>
                    </div>

                    <b style={{ fontSize: '17px', lineHeight: '22px', fontWeight: 600, color: 'var(--ink-900)' }}>
                      {narr.title}
                    </b>

                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-700)', lineHeight: '20px' }}>
                      "{narr.hook}"
                    </p>

                    {narr.held && (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: 'var(--warning-800)', background: 'var(--warning-100)', padding: '6px 10px', borderRadius: '6px' }}>
                        <Icon name="i-alert" size={14} /> Held for RR-H03 proof verification
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Channels */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 0 6px' }}>Channels</h1>
              <p style={{ margin: 0, color: 'var(--ink-600)', fontSize: '14px' }}>
                Allocate budget and post volume across channels. Sum must equal 100%.
              </p>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--e-1)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {channels.map((ch, idx) => {
                const chBudget = Math.round((budget * ch.share) / 100);
                return (
                  <div key={ch.ch} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <b style={{ fontSize: '15px' }}>{ch.ch}</b>
                        <span style={{ fontSize: '13px', color: 'var(--ink-500)', marginLeft: '8px' }}>({ch.format})</span>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>{HQ.inr(chBudget)}</span>
                        <span style={{ fontSize: '14px', fontWeight: 700, minWidth: '48px', textAlign: 'right' }}>{ch.share}%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={ch.share}
                      onChange={e => {
                        const next = [...channels];
                        next[idx].share = +e.target.value;
                        setChannels(next);
                        updateDraft({ channels: next });
                      }}
                      style={{ accentColor: 'var(--teal-700)', height: '6px', cursor: 'pointer' }}
                    />
                  </div>
                );
              })}

              <div style={{ borderTop: '1px solid var(--ink-100)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Total allocated</span>
                <b style={{ fontSize: '16px', color: totalShare === 100 ? 'var(--success-800)' : 'var(--danger-600)' }}>
                  {totalShare}% {totalShare !== 100 && '(Must equal 100%)'}
                </b>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Influencers / Sources */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 0 6px' }}>Influencers & Sources</h1>
              <p style={{ margin: 0, color: 'var(--ink-600)', fontSize: '14px' }}>
                Shortlist creators and institutional networks. College networks require consent records (RR-H06).
              </p>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ink-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: '15px' }}>Candidate sources ({(state.creators || []).length})</b>
                <span style={{ fontSize: '13px', color: 'var(--ink-500)' }}>{(shortlist || []).length} shortlisted</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--ink-25)', color: 'var(--ink-600)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 20px', width: '40px' }}></th>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Source</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Platform</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Type</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Followers</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Fee/post</th>
                      <th style={{ padding: '10px 20px', fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.creators || []).slice(0, 8).map(cr => {
                      const isSelected = (shortlist || []).some(s => s.creatorId === cr.id);
                      return (
                        <tr
                          key={cr.id}
                          onClick={() => {
                            let next;
                            if (isSelected) {
                              next = shortlist.filter(s => s.creatorId !== cr.id);
                            } else {
                              next = [...shortlist, { creatorId: cr.id, posts: 1, fee: cr.rate, terms: 'Standard terms' }];
                            }
                            setShortlist(next);
                            updateDraft({ shortlist: next });
                          }}
                          style={{ borderTop: '1px solid var(--ink-100)', cursor: 'pointer', background: isSelected ? 'var(--teal-50)' : '#fff' }}
                        >
                          <td style={{ padding: '12px 20px' }}>
                            <input type="checkbox" checked={isSelected} readOnly style={{ accentColor: 'var(--teal-700)' }} />
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <b style={{ display: 'block', fontWeight: 600 }}>{cr.name}</b>
                            <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{cr.handle}</span>
                          </td>
                          <td style={{ padding: '12px 12px' }}>{cr.platform}</td>
                          <td style={{ padding: '12px 12px' }}>{cr.type}</td>
                          <td style={{ padding: '12px 12px', fontWeight: 600 }}>{HQ.n(cr.followers)}</td>
                          <td style={{ padding: '12px 12px' }}>{HQ.inr(cr.rate)}</td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '6px', background: 'var(--success-100)', color: 'var(--success-800)', fontSize: '11px', fontWeight: 600 }}>
                              {cr.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Content */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 0 6px' }}>Content & Messaging</h1>
              <p style={{ margin: 0, color: 'var(--ink-600)', fontSize: '14px' }}>
                Review content deliverables, talking points and required paid-content disclosures (RR-H04).
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {shortlist.map(s => {
                const cr = HQ.creator(s.creatorId);
                const isPaid = s.fee > 0;
                return (
                  <div key={s.creatorId} style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--e-1)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <b style={{ fontSize: '16px' }}>{cr?.name}</b>
                        <span style={{ fontSize: '13px', color: 'var(--ink-500)', marginLeft: '8px' }}>({cr?.platform})</span>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: isPaid ? 'var(--warning-100)' : 'var(--info-100)', color: isPaid ? 'var(--warning-800)' : 'var(--info-800)' }}>
                        {isPaid ? '#ad Tag Required (RR-H04)' : 'Partnership (Organic)'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-600)' }}>Contract Terms & Deliverable</label>
                        <input
                          value={s.terms || ''}
                          onChange={e => {
                            const next = shortlist.map(q => q.creatorId === s.creatorId ? { ...q, terms: e.target.value } : q);
                            setShortlist(next);
                            updateDraft({ shortlist: next });
                          }}
                          style={{ height: '36px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-600)' }}>Post fee per item</label>
                        <input
                          type="number"
                          value={s.fee != null ? s.fee : cr?.rate || 0}
                          onChange={e => {
                            const next = shortlist.map(q => q.creatorId === s.creatorId ? { ...q, fee: +e.target.value } : q);
                            setShortlist(next);
                            updateDraft({ shortlist: next });
                          }}
                          style={{ height: '36px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 5: Review and Create */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 0 6px' }}>Review and create</h1>
              <p style={{ margin: 0, color: 'var(--ink-600)', fontSize: '14px' }}>
                The prediction freezes when you create the campaign. Later plan versions keep it for final comparison.
              </p>
            </div>

            {/* 4 Prediction KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
              <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Tracked clicks</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: 'var(--info-100)', color: 'var(--info-800)' }}>Predicted</span>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 600 }}>{HQ.n(predictedClicks * 0.8)}–{HQ.n(predictedClicks * 1.2)}</div>
                <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '4px' }}>Reach × CTR by channel</div>
              </div>

              <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Registrations</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: 'var(--info-100)', color: 'var(--info-800)' }}>Predicted</span>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 600 }}>{HQ.n(predictedRegs * 0.8)}–{HQ.n(predictedRegs * 1.2)}</div>
                <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '4px' }}>Clicks × registration rate</div>
              </div>

              <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Screening enrolments</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: 'var(--info-100)', color: 'var(--info-800)' }}>Predicted</span>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 600 }}>{predictedEnrols}–{Math.round(predictedEnrols * 1.25)}</div>
                <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '4px' }}>Target: {targetEnrolments}</div>
              </div>

              <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Cost per enrolment</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: 'var(--info-100)', color: 'var(--info-800)' }}>Predicted</span>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 600 }}>{HQ.inr(totalFees / Math.max(1, predictedEnrols))}</div>
                <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '4px' }}>Ceiling {HQ.inr(costCeiling)}</div>
              </div>
            </div>

            {/* Campaign Fit Card */}
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--e-1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <b style={{ fontSize: '16px' }}>How this campaign is likely to go</b>
                <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: 'var(--success-100)', color: 'var(--success-800)' }}>
                  On Track
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Campaign fit</div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--teal-700)' }}>84/100</div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-500)' }}>Trust, narrative, budget, target</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Average trust</div>
                  <div style={{ fontSize: '20px', fontWeight: 600 }}>88%</div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-500)' }}>{shortlist.length} shortlisted</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Narrative score</div>
                  <div style={{ fontSize: '20px', fontWeight: 600 }}>88</div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-500)' }}>College project to engineer</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Expected enrolments</div>
                  <div style={{ fontSize: '20px', fontWeight: 600 }}>{predictedEnrols}</div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-500)' }}>Target {targetEnrolments}</div>
                </div>
              </div>
            </div>

            {/* Governance Checklist Audit Table */}
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--e-1)' }}>
              <b style={{ fontSize: '16px', display: 'block', marginBottom: '14px' }}>Governance compliance check</b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { rule: 'RR-H01, RR-H02', status: 'Pass', text: 'Cohort is defined by district, qualification, skill background and bands only. No individual targeting or protected attributes.' },
                  { rule: 'RR-H03', status: selectedNarr === 'n4' ? 'Fail' : 'Pass', text: selectedNarr === 'n4' ? 'Selected narrative uses 85% placement rate claim which is awaiting evidence' : 'Narrative does not make unsubstantiated outcome claims' },
                  { rule: 'RR-H04', status: 'Pass', text: `${shortlist.filter(s => s.fee > 0).length} paid items tagged #ad; partnership items do not need it` },
                  { rule: 'RR-H06', status: 'Pass', text: 'Institutional sources shortlisted have consent record on file' },
                  { rule: 'RR-H07', status: 'Pass', text: 'No effectiveness or causal lift claims planned' }
                ].map((g, idx) => {
                  const t = HQ.tone(g.status);
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: idx < 4 ? '1px solid var(--ink-100)' : 0 }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: t.bg, color: t.fg, minWidth: '54px', textAlign: 'center' }}>
                        {g.status}
                      </span>
                      <b style={{ fontSize: '13px', minWidth: '120px' }}>{g.rule}</b>
                      <span style={{ fontSize: '13px', color: 'var(--ink-700)', flex: 1 }}>{g.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div style={{ position: 'fixed', bottom: 0, left: '232px', right: 0, height: '64px', background: '#fff', borderTop: '1px solid var(--ink-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', zIndex: 30 }}>
        <button
          onClick={handleBack}
          style={{ height: '40px', padding: '0 18px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </button>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', fontSize: '13px', color: 'var(--ink-600)' }}>
          <span>Budget <b>{HQ.inrL(budget)}</b></span>
          <span>Target <b>{targetEnrolments} enrolments</b></span>
        </div>

        {step < 5 ? (
          <button
            onClick={handleNext}
            style={{ height: '40px', padding: '0 20px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            Next: {steps[step + 1]} →
          </button>
        ) : (
          <button
            onClick={handleCreateCampaign}
            disabled={creating}
            style={{ height: '40px', padding: '0 24px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            {creating ? 'Creating campaign...' : 'Create campaign →'}
          </button>
        )}
      </div>
    </div>
  );
}
