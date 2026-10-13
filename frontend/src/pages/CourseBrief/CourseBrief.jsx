import React, { useState } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';

export default function CourseBrief() {
  const { state, HQ, currentCourse, go, set, toast } = useHQ();
  const film = currentCourse;
  const rd = HQ.readiness(film);
  const r = state.route;
  const tab = r.tab === 'files' ? 'files' : 'overview';

  const [form, setForm] = useState({ ...film.brief });
  const [readingLink, setReadingLink] = useState(false);
  const [uploading, setUploading] = useState(false);

  const files = state.files.filter(f => f.filmId === film.id);

  const handleFieldChange = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    HQ.set(x => {
      const f = x.films.find(q => q.id === film.id);
      if (f && f.brief) {
        f.brief[key] = val;
      }
    });
  };

  const handleReadLink = () => {
    setReadingLink(true);
    toast('Reading course website via search gate...');
    setTimeout(() => {
      setReadingLink(false);
      handleFieldChange('domain', 'AI/ML');
      handleFieldChange('level', 'Intermediate');
      handleFieldChange('duration', '16 weeks (8 weeks foundation + 8 weeks capstone)');
      toast('Course link read. Confirmed 3 fields from website.');
    }, 1500);
  };

  const handleUseSampleBrochure = () => {
    setUploading(true);
    toast('Parsing sample syllabus brochure...');
    setTimeout(() => {
      setUploading(false);
      handleFieldChange('eligibility', 'B.Tech/B.E. or MCA, graduated 2022–2026, 60% aggregate');
      handleFieldChange('stipend', '₹15,000/month during 8-week capstone');
      handleFieldChange('fee', 'Zero tuition fees (state-sponsored cohort)');
      toast('Sample brochure attached. Extracted eligibility and stipend policy.');
    }, 1200);
  };

  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: '1320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div>
        <button
          onClick={() => go('dashboard')}
          style={{ border: 0, background: 'none', color: 'var(--ink-500)', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '12px' }}
        >
          <Icon name="i-left" size={14} /> Dashboard
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: '32px', fontWeight: 600, letterSpacing: '-.015em' }}>
              {film.title}
            </h1>
            <div style={{ color: 'var(--ink-600)', fontSize: '14px' }}>
              {film.batch || 'Batch 4'} · starts {HQ.d(film.release)} · {film.provider || 'Nexa Skills Foundation'}
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '10px', padding: '12px 18px', minWidth: '200px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--ink-600)', marginBottom: '6px' }}>
              <span>Required fields</span>
              <b style={{ color: 'var(--ink-900)' }}>{rd.ok}/{rd.total}</b>
            </div>
            <div style={{ height: '6px', borderRadius: '999px', background: 'var(--ink-100)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${rd.pct}%`, background: rd.pct === 100 ? 'var(--success-600)' : 'var(--warning-600)', borderRadius: '999px' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--ink-100)', gap: '24px' }}>
        <button
          onClick={() => go('brief', { tab: 'overview' })}
          style={{
            border: 0,
            background: 'none',
            padding: '10px 0',
            fontSize: '14px',
            fontWeight: tab === 'overview' ? 600 : 500,
            color: tab === 'overview' ? 'var(--teal-800)' : 'var(--ink-600)',
            borderBottom: tab === 'overview' ? '2px solid var(--teal-600)' : '2px solid transparent',
            cursor: 'pointer'
          }}
        >
          Overview
        </button>
        <button
          onClick={() => go('brief', { tab: 'files' })}
          style={{
            border: 0,
            background: 'none',
            padding: '10px 0',
            fontSize: '14px',
            fontWeight: tab === 'files' ? 600 : 500,
            color: tab === 'files' ? 'var(--teal-800)' : 'var(--ink-600)',
            borderBottom: tab === 'files' ? '2px solid var(--teal-600)' : '2px solid transparent',
            cursor: 'pointer'
          }}
        >
          Files ({files.length})
        </button>
      </div>

      {tab === 'overview' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Helper Panels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: '16px' }}>
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
              <b style={{ fontSize: '15px', display: 'block', marginBottom: '4px' }}>Read the course link</b>
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--ink-600)' }}>
                We read the public course page and fill verified fields. Nothing is published until confirmed.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={form.courseLink || ''}
                  onChange={e => handleFieldChange('courseLink', e.target.value)}
                  placeholder="nexaskills.org/applied-ai"
                  style={{ flex: 1, height: '38px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', fontSize: '13px' }}
                />
                <button
                  onClick={handleReadLink}
                  disabled={readingLink}
                  style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Icon name="i-link" size={16} />
                  {readingLink ? 'Reading...' : 'Read link'}
                </button>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px dashed var(--ink-300)', borderRadius: '12px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--teal-50)', color: 'var(--teal-700)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                <Icon name="i-upload" size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: '15px', display: 'block', marginBottom: '2px' }}>Drop a brochure or syllabus</b>
                <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>PDF, Word or images. Outcome claims require evidence attachment.</span>
              </div>
              <button
                onClick={handleUseSampleBrochure}
                disabled={uploading}
                style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {uploading ? 'Parsing...' : 'Use sample brochure'}
              </button>
            </div>
          </div>

          {/* Form Fields Section 1: Course Info */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--e-1)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Course details</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Course name *</label>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--ink-100)', color: 'var(--ink-700)' }}>REQUIRED</span>
                </div>
                <input
                  value={form.courseName || ''}
                  onChange={e => handleFieldChange('courseName', e.target.value)}
                  style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Unique programme identifier per provider.</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Course link *</label>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--ink-100)', color: 'var(--ink-700)' }}>REQUIRED</span>
                </div>
                <input
                  value={form.courseLink || ''}
                  onChange={e => handleFieldChange('courseLink', e.target.value)}
                  style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>The public registration landing page.</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Skill domain *</label>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--ink-100)', color: 'var(--ink-700)' }}>REQUIRED</span>
                </div>
                <select
                  value={form.domain || 'AI/ML'}
                  onChange={e => handleFieldChange('domain', e.target.value)}
                  style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
                >
                  {HQ.SKILLS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Level *</label>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--ink-100)', color: 'var(--ink-700)' }}>REQUIRED</span>
                </div>
                <select
                  value={form.level || 'Intermediate'}
                  onChange={e => handleFieldChange('level', e.target.value)}
                  style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
                <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Stops an advanced course reaching a cohort that cannot enter it.</span>
              </div>
            </div>
          </div>

          {/* Form Fields Section 2: Eligibility & Outcome Claims */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--e-1)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Eligibility & claims</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Eligibility criteria *</label>
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--ink-100)', color: 'var(--ink-700)' }}>REQUIRED</span>
              </div>
              <input
                value={form.eligibility || ''}
                onChange={e => handleFieldChange('eligibility', e.target.value)}
                style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
                Qualification, graduation years, marks. Protected attributes (caste, religion, gender) are prohibited (RR-H02).
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Stipend details *</label>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--ink-100)', color: 'var(--ink-700)' }}>REQUIRED</span>
                </div>
                <input
                  value={form.stipend || ''}
                  onChange={e => handleFieldChange('stipend', e.target.value)}
                  style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Fee structure *</label>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--ink-100)', color: 'var(--ink-700)' }}>REQUIRED</span>
                </div>
                <input
                  value={form.fee || ''}
                  onChange={e => handleFieldChange('fee', e.target.value)}
                  style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Delivery mode *</label>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--ink-100)', color: 'var(--ink-700)' }}>REQUIRED</span>
                </div>
                <input
                  value={form.mode || ''}
                  onChange={e => handleFieldChange('mode', e.target.value)}
                  style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Duration *</label>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--ink-100)', color: 'var(--ink-700)' }}>REQUIRED</span>
                </div>
                <input
                  value={form.duration || ''}
                  onChange={e => handleFieldChange('duration', e.target.value)}
                  style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
                />
              </div>
            </div>

            {/* Outcome Claim Verification Alert */}
            <div style={{ padding: '14px 18px', borderRadius: '8px', background: 'var(--warning-100)', border: '1px solid #F6E3B4', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <Icon name="i-alert" size={18} style={{ color: 'var(--warning-800)', marginTop: '2px' }} />
              <div style={{ flex: 1, fontSize: '13px', color: 'var(--warning-800)' }}>
                <b style={{ display: 'block', marginBottom: '2px' }}>Outcome Claim: "85% placement rate" (RR-H03)</b>
                <span>Awaiting proof. Attach an audited placement report or batch track record in Files before using this claim in campaign narratives.</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Files Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ink-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ fontSize: '16px' }}>Attached documents & proofs</b>
              <button
                onClick={() => toast('Select file to upload (mock)')}
                style={{ height: '36px', padding: '0 14px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Icon name="i-upload" size={16} /> Upload file
              </button>
            </div>
            {files.map((fl, idx) => (
              <div
                key={fl.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 20px',
                  borderBottom: idx < files.length - 1 ? '1px solid var(--ink-100)' : 0
                }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--ink-50)', color: 'var(--ink-700)', display: 'grid', placeItems: 'center', flex: 'none', fontWeight: 700, fontSize: '11px' }}>
                  {fl.type}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: '14px', fontWeight: 600 }}>{fl.title}</b>
                  <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{fl.size} · Uploaded {HQ.d(fl.created)}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => toast(`Downloading ${fl.title}`)} style={{ border: 0, background: 'none', color: 'var(--ink-600)', cursor: 'pointer', padding: '6px' }}>
                    <Icon name="i-download" size={16} />
                  </button>
                  <button onClick={() => toast('Cannot delete verified compliance document', 'error')} style={{ border: 0, background: 'none', color: 'var(--ink-400)', cursor: 'pointer', padding: '6px' }}>
                    <Icon name="i-trash" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
