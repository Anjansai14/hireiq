import React, { useState } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';

export default function NewCourseModal({ onClose }) {
  const { HQ } = useHQ();
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [lang, setLang] = useState('Telugu');
  const [release, setRelease] = useState('');
  const [titleErr, setTitleErr] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      setTitleErr('Give the course a name.');
      return;
    }
    if (HQ.s.films.some(f => f.title.toLowerCase() === t.toLowerCase())) {
      setTitleErr('This provider already has a course with this name.');
      return;
    }

    setBusy(true);
    setTimeout(() => {
      const id = HQ.uid('f');
      const cleanLink = link.trim().replace(/^https?:\/\//, '');
      const B = (key, label, tier, value) => ({
        key,
        label,
        tier,
        value,
        source: value ? 'Entered' : '',
        status: value ? 'Confirmed' : 'Missing',
        date: HQ.TODAY
      });

      HQ.set(x => {
        x.films.push({
          id,
          title: t,
          batch: 'Batch 1',
          language: lang,
          release: release || '2027-02-01',
          provider: 'Nexa Skills Foundation',
          brief: {
            courseName: t,
            courseLink: cleanLink,
            domain: '',
            level: 'Beginner',
            eligibility: '',
            stipend: '',
            fee: '',
            mode: '',
            duration: '',
            targetAudience: '',
            intakeTarget: '100',
            costCeiling: '4000',
            budget: '500000',
            src: {}
          },
          flags: [
            { type: 'Outcome claims', status: 'Not checked', note: '' },
            { type: 'Institution endorsement', status: 'Not checked', note: '' },
            { type: 'Paid promotion', status: 'Not checked', note: '' }
          ],
          reads: [
            { key: 'public', title: 'Cohort demand and aspirations', status: 'Waiting', date: '', items: [] },
            { key: 'audience', title: 'Competing programmes and employers', status: 'Waiting', date: '', items: [] },
            { key: 'risk', title: 'What could go wrong', status: 'Waiting', date: '', items: [] }
          ],
          claims: []
        });
        x.filmId = id;
      });

      if (onClose) onClose();
      HQ.go('brief', { tab: 'overview' });
      HQ.toast(`${t} created. Read the course link or upload a brochure to fill the brief.`);
    }, 600);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(16,36,43,.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 70,
        padding: '24px'
      }}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: '500px',
          maxWidth: '100%',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: 'var(--e-3)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: '18px', display: 'block' }}>Add a course</b>
            <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
              Everything else can come later. You can read the course link on the next page.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: '32px', height: '32px', border: 0, borderRadius: '6px', background: 'none', cursor: 'pointer', color: 'var(--ink-500)', display: 'grid', placeItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-100)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <Icon name="i-x" size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirectio: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600 }}>Course name</label>
          <input
            autoFocus
            value={title}
            onChange={e => { setTitle(e.target.value); setTitleErr(''); }}
            placeholder="e.g. Cloud Support Associate"
            style={{ height: '40px', padding: '0 12px', border: `1px solid ${titleErr ? 'var(--danger-600)' : 'var(--ink-300)'}`, borderRadius: '8px' }}
          />
          {titleErr && <span style={{ fontSize: '12px', color: 'var(--danger-600)' }}>{titleErr}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600 }}>Course link</label>
          <input
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder="provider.org/course"
            style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Language</label>
            <select
              value={lang}
              onChange={e => setLang(e.target.value)}
              style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
            >
              <option>Telugu</option>
              <option>English</option>
              <option>Hindi</option>
              <option>Urdu</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Batch start date</label>
            <input
              type="date"
              value={release}
              onChange={e => setRelease(e.target.value)}
              style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            style={{
              height: '40px',
              padding: '0 16px',
              borderRadius: '8px',
              border: 0,
              background: 'var(--teal-700)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--teal-800)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--teal-700)'}
          >
            {busy && (
              <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', animation: 'spin .8s linear infinite' }}></span>
            )}
            Create course
          </button>
        </div>
      </form>
    </div>
  );
}
