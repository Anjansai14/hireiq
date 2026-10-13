import React, { useState, useEffect, useRef } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';

export default function SourceDetail() {
  const { HQ, s } = useHQ();
  const r = s.route || {};
  const c = HQ.camp(r.campId);
  const x = c && HQ.ccOf(r.campId, r.ccId);

  const [state, setState] = useState({
    reason: null,
    rText: '',
    brief: false,
    editing: null,
    drafting: false,
    gen: null,
    deal: null,
    url: '',
    urlErr: '',
    busy: false,
    tk: null,
    tkErr: ''
  });

  if (!c || !x) {
    return (
      <div style={{ padding: '24px 32px 48px', maxWidth: '1240px' }}>
        <button
          onClick={() => HQ.go('campaigns')}
          style={{
            border: 0,
            background: 'none',
            padding: 0,
            color: 'var(--ink-600)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '13px',
            marginBottom: '16px'
          }}
        >
          <Icon name="i-left" size={16} /> Not found · Influencers
        </button>
        <div style={{ color: 'var(--ink-500)', fontSize: '14px' }}>Source not found for this campaign.</div>
      </div>
    );
  }

  const cr = HQ.creator(x.creatorId);
  const tab = r.tab || 'profile';
  const live = c.status === 'Live';
  const st = HQ.ccStats(x);
  const rk = (HQ.rank({ objective: c.objective, markets: c.markets, languages: c.languages })?.list || []).find(q => q.c?.id === cr?.id);
  const narr = (c.narratives || []).find(n => n.id === x.narrative) || c.narratives?.[0] || { title: '—' };
  const inst = HQ.isInst(cr);
  const consentOk = cr.consent === 'Recorded';
  const notConsent = cr.consent !== 'Recorded';
  const consentNote = consentOk
    ? `Consent recorded · ${cr.consentBasis || ''}${cr.consentDate ? ' · ' + HQ.d(cr.consentDate) : ''}`
    : 'No consent record. This source cannot move to Confirmed until consent is recorded (RR-H06).';

  const recordConsent = () => {
    HQ.set(z => {
      const q = z.creators.find(o => o.id === cr.id);
      q.consent = 'Recorded';
      q.consentBasis = q.consentBasis || 'Written consent from the institution, recorded by Anika Rao';
      q.consentDate = HQ.TODAY;
      q.activity.unshift({ date: HQ.TODAY, text: 'Institution consent recorded' });
    });
    HQ.set(z => {
      const k = z.campaigns.find(q => q.id === c.id);
      const cc = k.ccs.find(q => q.id === x.id);
      cc.log.push({ date: HQ.TODAY, text: 'Consent recorded for ' + cr.name });
    });
    HQ.toast('Consent recorded for ' + cr.name);
  };

  const back = () => HQ.go('campaign', { id: c.id, tab: 'influencers' });
  const statuses = HQ.STATUSES;
  const status = x.status;
  const stT = HQ.tone(x.status);
  const ro = !live;

  const setStatus = (newStatus, reasonText) => {
    const prev = x.status;
    HQ.set(z => {
      const k = z.campaigns.find(q => q.id === c.id);
      const cc = k.ccs.find(q => q.id === x.id);
      cc.status = newStatus;
      if (reasonText) cc.reason = reasonText;
      cc.log.push({
        date: HQ.TODAY,
        text: `Status ${prev} → ${newStatus}${reasonText ? ': ' + reasonText : ''}`
      });
      if (reasonText) {
        const creator = z.creators.find(q => q.id === cc.creatorId);
        creator.history.push({
          film: HQ.film(k.filmId).title,
          campaign: k.name,
          date: HQ.TODAY,
          status: newStatus,
          note: reasonText
        });
        creator.activity.unshift({
          date: HQ.TODAY,
          text: `${newStatus} on ${k.name}: ${reasonText}`
        });
      }
    });
    HQ.toast(`Status → ${newStatus}`);
  };

  const onStatusSelectChange = (e) => {
    const val = e.target.value;
    if (val === 'Declined' || val === 'Backed out') {
      setState(prev => ({ ...prev, reason: val, rText: '' }));
    } else {
      setStatus(val);
    }
  };

  const goProfile = () => HQ.go('creator', { id: cr.id });

  const tabs = [
    ['profile', 'Profile and why'],
    ['content', `Content plan${x.content?.length ? ` (${x.content.length})` : ''}`],
    ['deal', 'Deal and commercials'],
    ['status', 'Status'],
    ['posts', `Posts and performance${x.posts?.length ? ` (${x.posts.length})` : ''}`]
  ].map(([k, label]) => ({
    key: k,
    label,
    go: () => HQ.go('influencer', { campId: c.id, ccId: x.id, tab: k }),
    active: tab === k || (k === 'posts' && tab === 'performance')
  }));

  // Profile Data
  const flw = cr.followers;
  const seedN = cr.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const langList = Object.keys(cr.langs || {});
  const pd = {
    url: cr.platform === 'YouTube' ? 'https://youtube.com/' + cr.handle : cr.platform === 'Instagram' ? 'https://instagram.com/' + cr.handle.replace('@', '') : cr.platform === 'WhatsApp' ? '#' : 'https://' + cr.handle,
    counts: [
      { l: cr.catchment ? 'Catchment (Uploaded)' : cr.platform === 'YouTube' ? 'Subscribers' : 'Followers', v: HQ.n(cr.catchment || flw) },
      { l: cr.platform === 'YouTube' ? 'Subscribed to' : 'Following', v: HQ.n(120 + seedN % 900) },
      { l: cr.platform === 'YouTube' ? 'Videos' : 'Posts', v: HQ.n(240 + seedN * 7 % 1800) }
    ],
    bio: cr.bio || `${cr.type} on ${cr.platform} sharing ${(cr.content || []).join(', ').toLowerCase()} in ${langList.join(' and ') || 'regional languages'}. ${cr.tone} voice.${cr.affiliation ? ' ' + cr.affiliation + '.' : ''}`,
    rows: [
      { l: 'Handle', v: cr.handle },
      { l: 'Platform', v: cr.platform },
      { l: 'Source type', v: cr.type },
      { l: 'Affiliation', v: cr.affiliation || '—' },
      { l: 'Top cohort', v: cr.cohort || '—' },
      { l: 'Languages', v: langList.join(', ') || '—' },
      { l: 'Consent', v: cr.consent + (cr.consentDate ? ' · ' + HQ.ds(cr.consentDate) : '') },
      { l: 'Tier', v: cr.tier }
    ]
  };

  const pf = {
    why: rk ? rk.why : 'Blocked by eligibility gate',
    where: rk ? rk.where : cr.platform,
    what: rk ? rk.what : '',
    past: rk ? rk.past : '',
    narr: x.narrative,
    narrs: (c.narratives || []).map(n => ({ id: n.id, title: (n.role ? n.role + ': ' : '') + n.title })),
    setNarr: (e) => {
      const val = e.target.value;
      HQ.set(z => {
        const k = z.campaigns.find(q => q.id === c.id);
        const cc = k.ccs.find(q => q.id === x.id);
        cc.narrative = val;
      });
      HQ.toast('Narrative updated');
    },
    stats: [
      { l: 'Trust with this cohort', v: rk ? rk.trustPct + '%' : '—', stamp: 'Inferred · affiliation, past enrolments, audience affinity' },
      { l: 'Past enrolments', v: String(cr.attributed || 0), stamp: 'Observed · Resolence, earlier batches' },
      { l: 'Fit score', v: rk ? rk.fitPct + '%' : '—', stamp: 'Inferred' },
      { l: 'Qualified reach', v: rk ? HQ.n(rk.qr) : '—', stamp: 'Inferred · RM-04' }
    ],
    pred: (x.predEnrols || [0, 0]).join('–') + ' enrolments',
    postsN: x.deal ? x.deal.posts : 1,
    flags: (rk?.flags || []).concat(cr.status === 'Partial' ? [cr.partialNote] : [])
  };

  // Content Plan State & Actions
  const items = x.content || [];
  const setItem = (id, patch) => {
    HQ.set(z => {
      const k = z.campaigns.find(q => q.id === c.id);
      const cc = k.ccs.find(q => q.id === x.id);
      const target = cc.content.find(q => q.id === id);
      if (target) Object.assign(target, patch);
    });
  };

  const handleDraftWithAI = () => {
    if (state.drafting) return;
    setState(prev => ({ ...prev, drafting: true }));
    setTimeout(() => {
      const n = x.deal ? x.deal.posts : 1;
      const lang = Object.keys(cr.langs || {})[0] || 'Telugu';
      const film = HQ.film(c.filmId);
      const reg = (film.brief.find(b => b.key === 'regLink') || {}).value || 'https://resolence.in/ai-ml';
      const paid = x.deal ? x.deal.rate > 0 : cr.rate > 0;
      HQ.set(z => {
        const k = z.campaigns.find(q => q.id === c.id);
        const cc = k.ccs.find(q => q.id === x.id);
        cc.content = Array.from({ length: n }, (_, i) => ({
          id: HQ.uid('ci'),
          title: `${cr.formats[i % cr.formats.length]} ${i + 1}: ${narr.title}`,
          format: cr.formats[i % cr.formats.length],
          lang,
          hook: (narr.hook || '') + (lang === 'Telugu' ? ' / "B.Tech ayyaka next enti?" (What after B.Tech?)' : ''),
          beats: [
            'Hook in the first 2 seconds',
            'What the programme teaches (from the syllabus only)',
            'Who is eligible and when the batch starts',
            'Call to action: register through the tracked link'
          ],
          caption: `${narr.title}. ${film.title} ${film.batch || ''} registrations are open. ${c.hashtags.join(' ')}${paid ? ' #ad' : ''}`,
          tags: c.hashtags.concat(paid ? ['#ad'] : []),
          cta: c.objective === 'Audience' ? 'Join the WhatsApp community' : 'Register for screening',
          link: `${reg}?t=hq-${c.id}-${cr.id}-${i + 1}`,
          disclosure: paid,
          status: 'Draft',
          due: x.deal ? HQ.addDays(x.deal.start, i * 3 + 2) : HQ.TODAY,
          checks: { spoiler: 'Pass', claims: 'Pass', disclosure: paid ? 'Pass' : 'Not required', link: 'Pass' }
        }));
        cc.log.push({ date: HQ.TODAY, text: `Content plan drafted (${n} items)` });
      });
      setState(prev => ({ ...prev, drafting: false }));
      HQ.toast(`${n} content items drafted in ${lang}`);
    }, 1200);
  };

  // Deal state
  const d = state.deal || (x.deal ? {
    rate: String(x.deal.rate),
    posts: String(x.deal.posts),
    type: x.deal.type,
    del: x.deal.del,
    start: x.deal.start,
    end: x.deal.end,
    terms: x.deal.terms
  } : {
    rate: String(cr.rate),
    posts: '1',
    type: 'Paid',
    del: '',
    start: HQ.TODAY,
    end: HQ.addDays(HQ.TODAY, 7),
    terms: ''
  });

  const setD = (k) => (e) => {
    const val = k === 'rate' || k === 'posts' ? e.target.value.replace(/[^\d]/g, '') : e.target.value;
    setState(prev => ({ ...prev, deal: { ...d, [k]: val } }));
  };

  const tier = (HQ.s.rateTiers || []).find(t => t.tier === cr.tier) || {};
  const rateVal = +d.rate || 0;
  const dl = {
    rate: d.rate,
    posts: d.posts,
    type: d.type,
    del: d.del,
    start: d.start,
    end: d.end,
    terms: d.terms,
    total: HQ.inr(rateVal * (+d.posts || 0)),
    tier: (inst ? 'Institutional' : cr.tier) + ' (' + (inst ? 'partnership' : tier.range || 'Custom') + ')',
    band: inst ? 'Zero fee unless you record one' : HQ.inr(tier.lo) + ' – ' + HQ.inr(tier.hi) + ' per post',
    prov: inst ? 'Observed' : tier.prov,
    provT: HQ.tone(inst ? 'Observed' : tier.prov),
    bookings: inst ? 'Partnerships are recorded at zero fee or in kind' : `${tier.bookings || 0} bookings across ${tier.films || 0} batches`,
    vs: inst ? (rateVal ? 'Fee recorded for an institutional partnership' : 'Partnership at zero fee') : rateVal > (tier.hi || 0) ? `Above the band by ${HQ.inr(rateVal - tier.hi)}` : rateVal < (tier.lo || 0) ? 'Below the band' : 'Inside the band',
    vsC: rateVal > (tier.hi || 0) ? 'var(--warning-800)' : 'var(--success-800)',
    past: (cr.history || []).filter(h => h.fee).map(h => ({ l: `${h.film} · ${h.campaign}`, v: HQ.inr(h.fee) })),
    noPast: !(cr.history || []).some(h => h.fee),
    save: (e) => {
      e.preventDefault();
      if ((!rateVal && d.type !== 'Partnership' && d.type !== 'Barter') || !(+d.posts)) {
        return HQ.toast('Rate and number of posts are required (rate can be 0 for a Partnership)', 'error');
      }
      if (inst && cr.consent !== 'Recorded') {
        return HQ.toast("Record the institution's consent first (RR-H06)", 'error');
      }
      if (d.end < d.start) {
        return HQ.toast('Post-by date must be after the start', 'error');
      }
      HQ.set(z => {
        const k = z.campaigns.find(q => q.id === c.id);
        const cc = k.ccs.find(q => q.id === x.id);
        cc.deal = { rate: rateVal, posts: +d.posts, type: d.type, del: d.del, start: d.start, end: d.end, terms: d.terms };
        cc.log.push({
          date: HQ.TODAY,
          text: rateVal ? `Deal recorded: ${HQ.inr(rateVal)} × ${d.posts} = ${HQ.inr(rateVal * d.posts)}` : `Partnership recorded: ${d.posts} posts at zero fee`
        });
        const base = cr.mv || (cr.catchment || 1000) * 0.5;
        cc.predViews = [Math.round(base * 0.62 * d.posts), Math.round(base * 1.45 * d.posts)];
        z.rateObs.unshift({ date: HQ.TODAY, creator: cr.id, film: HQ.film(k.filmId).title, rate: rateVal, posts: +d.posts, tier: cr.tier });
        const c2 = z.creators.find(q => q.id === cr.id);
        c2.rate = rateVal;
        c2.rateSrc = inst && !rateVal ? 'Partnership' : 'Observed';
        c2.activity.unshift({ date: HQ.TODAY, text: `Rate updated to ${HQ.inr(rateVal)} (deal on ${k.name})` });
        const t2 = z.rateTiers.find(t => t.tier === cr.tier);
        if (t2) {
          t2.bookings = (t2.bookings || 0) + 1;
          if (t2.prov === 'Illustrative' && t2.bookings >= 3 && t2.films >= 2) t2.prov = 'Observed';
        }
        if (['Identified', 'Approached', 'Negotiating'].includes(cc.status)) {
          cc.log.push({ date: HQ.TODAY, text: `Status ${cc.status} → Confirmed` });
          cc.status = 'Confirmed';
        }
      });
      setState(prev => ({ ...prev, deal: null }));
      HQ.toast(rateVal ? `Deal saved: ${HQ.inr(rateVal * d.posts)}. Rate card updated.` : 'Partnership saved. Committed budget unchanged.');
    }
  };

  // Status Stepper
  const flow = ['Identified', 'Approached', 'Negotiating', 'Confirmed', 'Content in review', 'Live', 'Delivered'];
  const ix = flow.indexOf(x.status);
  const exited = ix < 0;
  const sp = {
    steps: flow.map((l, i) => ({
      l,
      n: i < ix || (i === ix && l === 'Delivered') ? '✓' : String(i + 1),
      bg: i < ix ? 'var(--teal-700)' : i === ix ? 'var(--teal-50)' : '#fff',
      fg: i < ix ? '#fff' : i === ix ? 'var(--teal-800)' : 'var(--ink-400)',
      bd: i <= ix ? 'var(--teal-700)' : 'var(--ink-200)',
      line: i === 0 ? 'transparent' : i <= ix ? 'var(--teal-700)' : 'var(--ink-200)',
      fw: i === ix ? 700 : 500,
      c: i <= ix ? 'var(--ink-900)' : 'var(--ink-500)'
    })),
    canNext: live && !exited && ix < flow.length - 1,
    nextLabel: flow[ix + 1],
    next: () => {
      if (flow[ix + 1] === 'Confirmed' && !x.deal) return HQ.toast('Record the deal first', 'error');
      if (flow[ix + 1] === 'Confirmed' && inst && cr.consent !== 'Recorded') return HQ.toast('Consent recorded is required before Confirmed for institutional sources (RR-H06)', 'error');
      setStatus(flow[ix + 1]);
    },
    canExit: live && !exited && x.status !== 'Delivered',
    decline: () => setState(prev => ({ ...prev, reason: 'Declined', rText: '' })),
    backout: () => setState(prev => ({ ...prev, reason: 'Backed out', rText: '' })),
    log: (x.log || []).slice().reverse().map(l => ({ date: HQ.ds(l.date), text: l.text }))
  };

  // Tracking & Performance
  const tr = x.tracking || {};
  const td = state.tk || {
    tag: tr.hashtag || '',
    tags: (tr.tags ? [tr.hashtag].concat(tr.tags.filter(q => q !== tr.hashtag)).filter(Boolean) : (x.tags || []).slice()),
    links: (tr.links || [].concat(tr.yt ? [{ p: 'YouTube', u: tr.yt }] : [], tr.ig ? [{ p: 'Instagram', u: tr.ig }] : [])).slice(),
    np: cr.platform === 'Instagram' ? 'Instagram' : 'YouTube',
    nu: '',
    nt: ''
  };

  const setTd = (patch) => setState(prev => ({ ...prev, tk: { ...td, ...patch }, tkErr: '' }));

  const tk = {
    tag: td.tag,
    np: td.np,
    nu: td.nu,
    nt: td.nt,
    err: state.tkErr || '',
    note: tr.savedAt ? `Saved ${HQ.ds(tr.savedAt)}` : 'Added after the campaign is created',
    links: td.links.map((l, i) => ({
      p: l.p,
      u: l.u,
      rm: () => setTd({ links: td.links.filter((_, j) => j !== i) })
    })),
    tags: td.tags.map((h, i) => ({
      t: h,
      rm: () => setTd({ tags: td.tags.filter((_, j) => j !== i) })
    })),
    addLink: () => {
      const u = td.nu.trim();
      if (!u) return setState(prev => ({ ...prev, tkErr: 'Paste a link first.' }));
      const ok = td.np === 'YouTube' ? /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(u) : /^https?:\/\/(www\.)?instagram\.com\//i.test(u);
      if (!ok) return setState(prev => ({ ...prev, tkErr: td.np === 'YouTube' ? 'The YouTube link must start with https://youtube.com or https://youtu.be' : 'The Instagram link must start with https://instagram.com' }));
      if (td.links.some(l => l.u === u)) return setState(prev => ({ ...prev, tkErr: 'This link is already added.' }));
      setTd({ links: td.links.concat([{ p: td.np, u }]), nu: '' });
    },
    addTag: () => {
      let h = td.nt.trim().replace(/\s+/g, '');
      if (!h) return setState(prev => ({ ...prev, tkErr: 'Type a hashtag first.' }));
      if (h[0] !== '#') h = '#' + h;
      if (!/^#[\w\u0C00-\u0CFF\u0900-\u097F]{2,}$/.test(h)) return setState(prev => ({ ...prev, tkErr: 'Hashtags use letters, numbers or underscores only.' }));
      const k1 = HQ.camp(c.id);
      const dup = k1.ccs.find(q => q.id !== x.id && ((q.tags || []).concat(q.tracking ? [q.tracking.hashtag] : [])).some(z => (z || '').toLowerCase() === h.toLowerCase()));
      if (dup) return setState(prev => ({ ...prev, tkErr: h + ' is already used by another influencer in this campaign.' }));
      if (td.tags.some(q => (q || '').toLowerCase() === h.toLowerCase())) return setState(prev => ({ ...prev, tkErr: h + ' is already added.' }));
      setTd({ tags: td.tags.concat([h]), nt: '' });
    },
    save: () => {
      if (!td.tags.length) return setState(prev => ({ ...prev, tkErr: 'Add at least one unique hashtag.' }));
      const t = td.tags[0];
      const links = td.links.slice();
      const tags = td.tags.slice();
      const fresh = links.filter(l => !(x.posts || []).some(p => p.url === l.u));
      HQ.set(z => {
        const k = z.campaigns.find(q => q.id === c.id);
        const cc = k.ccs.find(q => q.id === x.id);
        cc.tracking = { hashtag: t, tags: tags.slice(1), links, yt: (links.find(l => l.p === 'YouTube') || {}).u || '', ig: (links.find(l => l.p === 'Instagram') || {}).u || '', savedAt: HQ.TODAY };
        cc.tags = tags.slice();
        fresh.forEach(l => {
          const views = Math.round((cr.mv || 1000) * 0.18);
          const e2 = (cr.er || 3) / 100;
          cc.posts.push({
            id: HQ.uid('p'),
            title: (cc.content[cc.posts.length] || {}).title || 'New post on ' + l.p,
            format: l.p === 'Instagram' ? 'Reel' : 'Video',
            date: HQ.TODAY,
            views,
            likes: Math.round(views * e2 * 0.86),
            comments: Math.round(views * e2 * 0.055),
            shares: null,
            saves: null,
            sent: [70, 24, 6],
            intent: Math.round(views * 0.0012),
            clicks: Math.round(views * 0.02),
            regs: Math.round(views * 0.002),
            enrols: 0,
            lastFetch: HQ.TODAY + 'T' + new Date().toTimeString().slice(0, 5),
            fetch: 'OK',
            url: l.u
          });
        });
        if (fresh.length && ['Confirmed', 'Content in review', 'Approached', 'Negotiating', 'Identified'].includes(cc.status)) {
          cc.log.push({ date: HQ.TODAY, text: `Status ${cc.status} → Live` });
          cc.status = 'Live';
        }
        cc.log.push({ date: HQ.TODAY, text: 'Tracking set: ' + t + (tags.length > 1 ? ' + ' + (tags.length - 1) + ' more hashtags' : '') + (links.length ? ' · ' + links.length + ' links' : '') });
      });
      setState(prev => ({ ...prev, tk: null, tkErr: '' }));
      HQ.toast(`Tracking saved for ${cr.name} · ${t}${fresh.length ? ` · ${fresh.length} posts linked` : ''}`);
    }
  };

  const pe = x.predEnrols || [0, 1];
  const mx = Math.max(pe[1], st.enrols || 0) * 1.15 || 1;
  const mid = (pe[0] + pe[1]) / 2;
  const peData = {
    kpis: [
      { l: 'Tracked clicks', v: HQ.n(st.clicks), sub: `${st.posts} posts · ${st.views ? HQ.n(st.views) + ' views' : 'clicks only'}` },
      { l: 'Registrations', v: HQ.n(st.regs), sub: `${(st.regRate || 0).toFixed(1)}% of clicks` },
      { l: 'Screening enrolments', v: String(st.enrols || 0), sub: `${(st.enrolRate || 0).toFixed(1)}% of registrations` },
      { l: 'Spent', v: HQ.inr(st.spent), sub: `of ${HQ.inr(st.total)} deal` },
      { l: 'Cost per enrolment', v: st.enrols && st.spent ? HQ.inr(st.cpe) : st.enrols ? '₹0 (partnership)' : '—', sub: 'Spent ÷ screening enrolments' }
    ],
    bandL: (pe[0] / mx) * 100,
    bandW: ((pe[1] - pe[0]) / mx) * 100,
    actL: Math.min(99, ((st.enrols || 0) / mx) * 100),
    range: `${pe[0]}–${pe[1]}`,
    actual: `${st.enrols || 0}${st.posts ? ` (${st.enrols >= mid ? '+' : ''}${Math.round(((st.enrols || 0) / mid - 1) * 100)}% vs mid)` : ''}`,
    max: String(Math.round(mx))
  };

  const briefText = [
    `SOURCE BRIEF · ${HQ.film(c.filmId).title.toUpperCase()} · ${c.name}`,
    '',
    `Source: ${cr.name} (${cr.handle}, ${cr.platform}, ${cr.type})`,
    `Narrative: ${narr.title}`,
    `Hook: ${narr.hook || ''}`,
    `Deliverables: ${x.deal ? x.deal.del + ' (' + x.deal.posts + ' posts)' : 'TBC'}`,
    `Post window: ${x.deal ? HQ.d(x.deal.start) + ' to ' + HQ.d(x.deal.end) : 'TBC'}`,
    `Hashtags: ${(c.hashtags || []).join(' ')}${x.deal && x.deal.rate ? ' #ad' : ''}`,
    'Tracked link: use the link given for each post; it attributes registrations to you',
    '',
    'Do:',
    '- Describe the programme from the course brief only',
    '- Put #ad or "Paid partnership" in the first line of paid posts',
    `- Speak in your own ${cr.tone ? cr.tone.toLowerCase() : 'authentic'} voice`,
    '',
    "Don't:",
    '- Promise jobs, placement rates or salaries',
    '- Address or single out any individual',
    '- Mention caste, religion, gender or disability',
    '',
    'Content plan:'
  ].concat(items.map((it, i) => `${i + 1}. ${it.title} (due ${HQ.d(it.due)})\n   Hook: ${it.hook}\n   Caption: ${it.caption}`)).join('\n');

  return (
    <div style={{ padding: '24px 32px 48px', maxWidth: '1240px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <button
        onClick={back}
        style={{
          border: 0,
          background: 'none',
          padding: 0,
          color: 'var(--ink-600)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '13px',
          alignSelf: 'flex-start'
        }}
      >
        <Icon name="i-left" size={16} /> {c.name} · Influencers
      </button>

      {/* Header */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: cr.av ? cr.av[0] : 'var(--teal-100)',
            color: cr.av ? cr.av[1] : 'var(--teal-800)',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 600,
            fontSize: '22px',
            flex: 'none'
          }}
        >
          {cr.initials}
        </span>
        <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 'none', minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.25,
                fontSize: '26px',
                fontWeight: 600,
                letterSpacing: '-.01em'
              }}
            >
              {cr.name}
            </h1>
            {cr.verif === 'Verified' && (
              <span style={{ color: 'var(--teal-700)', display: 'flex' }}>
                <Icon name="i-shield" size={18} />
              </span>
            )}
          </div>
          <div style={{ color: 'var(--ink-600)' }}>
            {cr.handle} · {cr.platform} · {cr.type} · {cr.tier} · {cr.catchment ? HQ.n(cr.catchment) + ' catchment' : HQ.n(cr.followers)} followers
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={status}
            onChange={onStatusSelectChange}
            disabled={ro}
            style={{
              height: '40px',
              padding: '0 12px',
              border: `1.5px solid ${stT.fg}`,
              borderRadius: '999px',
              background: stT.bg,
              color: stT.fg,
              fontWeight: 600
            }}
          >
            {statuses.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>

          <button
            onClick={goProfile}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '40px',
              padding: '0 14px',
              borderRadius: '8px',
              border: '1px solid var(--ink-300)',
              background: '#fff',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Icon name="i-users" size={16} /> Bank profile
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--ink-100)', overflowX: 'auto', overflowY: 'hidden' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={t.go}
            style={{
              flex: 'none',
              whiteSpace: 'nowrap',
              border: 0,
              background: 'none',
              padding: '10px 0',
              marginBottom: '-1px',
              borderBottom: t.active ? '2px solid var(--teal-600)' : '2px solid transparent',
              color: t.active ? 'var(--teal-800)' : 'var(--ink-600)',
              fontWeight: t.active ? 600 : 500,
              cursor: 'pointer'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Institutional Banner */}
      {inst && (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 16px', borderRadius: '10px', background: '#fff', border: '1px solid var(--ink-100)', fontSize: '13px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--teal-700)', flex: 'none' }}>
            <Icon name="i-shield" size={18} />
          </span>
          <span style={{ flex: 1, minWidth: '220px' }}>
            <b style={{ display: 'block', fontSize: '14px' }}>Institutional source · partnership and consent (RR-H06)</b>
            {consentNote}
          </span>
          {notConsent && (
            <button
              onClick={recordConsent}
              style={{
                height: '36px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 0,
                background: 'var(--teal-700)',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Record consent
            </button>
          )}
        </div>
      )}

      {/* TAB 1: Profile & Why */}
      {tab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: '20px', alignItems: 'start', animation: 'fadein .2s' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--e-1)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flex: 'none' }}>
                <b style={{ fontSize: '16px', minWidth: 0 }}>Why this source</b>
                <span style={{ display: 'inline-flex', flex: 'none', height: '20px', padding: '0 6px', borderRadius: '4px', background: 'var(--info-100)', color: 'var(--info-800)', fontSize: '11px', fontWeight: 600, alignItems: 'center' }}>
                  Inferred · Agent A7
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '8px 12px', fontSize: '14px' }}>
                <span style={{ color: 'var(--ink-500)' }}>Why</span>
                <span>{pf.why}</span>
                <span style={{ color: 'var(--ink-500)' }}>Where</span>
                <span>{pf.where}</span>
                <span style={{ color: 'var(--ink-500)' }}>What</span>
                <span>{pf.what}</span>
                <span style={{ color: 'var(--ink-500)' }}>Past</span>
                <span>{pf.past}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--ink-100)' }}>
                <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Carries narrative</span>
                <select
                  value={pf.narr}
                  onChange={pf.setNarr}
                  style={{ flex: 1, height: '36px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
                >
                  {pf.narrs.map(n => (
                    <option key={n.id} value={n.id}>{n.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--e-1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <b style={{ fontSize: '16px' }}>Profile details</b>
                <a href={pd.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--teal-700)' }}>
                  Open profile
                </a>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                {pd.counts.map(k => (
                  <div key={k.l} style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--ink-25)', border: '1px solid var(--ink-100)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--ink-600)' }}>{k.l}</div>
                    <div style={{ fontSize: '20px', fontWeight: 600 }}>{k.v}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-500)', marginBottom: '4px' }}>Bio</div>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: '22px' }}>{pd.bio}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px 12px', fontSize: '14px', paddingTop: '12px', borderTop: '1px solid var(--ink-100)' }}>
                {pd.rows.map(r => (
                  <React.Fragment key={r.l}>
                    <span style={{ color: 'var(--ink-500)' }}>{r.l}</span>
                    <span>{r.v}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {pf.stats.map(s => (
                <div key={s.l} style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--e-1)' }} title={s.stamp}>
                  <div style={{ fontSize: '12px', color: 'var(--ink-600)' }}>{s.l}</div>
                  <div style={{ fontSize: '20px', fontWeight: 600 }}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px', boxShadow: 'var(--e-1)' }}>
              <b style={{ display: 'block', marginBottom: '8px' }}>Predicted for this campaign</b>
              <div style={{ fontSize: '22px', fontWeight: 600 }}>{pf.pred}</div>
              <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>views across {pf.postsN} posts · frozen at creation</div>
            </div>
            {pf.flags.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', padding: '12px 14px', borderRadius: '8px', background: 'var(--warning-100)', color: 'var(--warning-800)', fontSize: '13px' }}>
                <Icon name="i-alert" size={18} /> {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Content Plan */}
      {tab === 'content' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadein .2s' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ flex: 1, color: 'var(--ink-600)' }}>
              {items.filter(i => i.status === 'Approved').length} of {items.length} approved · narrative: {narr.title}
            </span>
            <button
              onClick={handleDraftWithAI}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '40px',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid var(--ink-300)',
                background: '#fff',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {state.drafting && <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid var(--teal-100)', borderTopColor: 'var(--teal-600)', animation: 'spin .8s linear infinite' }}></span>}
              <Icon name="i-spark" size={16} style={{ color: 'var(--teal-700)' }} />
              {items.length ? 'Redraft with AI' : 'Draft content with AI'}
            </button>
          </div>

          {!items.length ? (
            <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--ink-200)', borderRadius: '12px', background: '#fff' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--teal-50)', color: 'var(--teal-700)', display: 'grid', placeItems: 'center', margin: '0 auto 10px' }}>
                <Icon name="i-file" size={24} />
              </div>
              <b style={{ display: 'block', marginBottom: '4px' }}>No content plan yet</b>
              <p style={{ margin: '0 auto 14px', color: 'var(--ink-600)', maxWidth: '380px' }}>
                Agent A8 drafts one item per post in the cohort's language, from the source's top posts and the narrative. Each item gets a tracked link.
              </p>
            </div>
          ) : (
            items.map(it => {
              const editing = state.editing === it.id;
              const film0 = HQ.film(c.filmId);
              const evid = (film0.claims || []).some(q => q.status === 'Evidence attached');
              const spoil = !evid && /(\d+\s?%\s*(placement|placed|hired)|placement rate|salary|lpa|ctc|job guarantee|guaranteed job)/i.test((it.hook || '') + (it.caption || ''));
              const paidI = x.deal ? x.deal.rate > 0 : cr.rate > 0;
              const disc = it.disclosure || !paidI;
              const hasLink = !!(it.link || /resolence\.in/.test(it.caption || ''));
              const checks = [
                ['Outcome claims need Observed evidence (RR-H03)', spoil ? 'Fail' : 'Pass'],
                ['Tracked Resolence link', hasLink ? 'Pass' : 'Fail'],
                ['Disclosure tag on paid item (RR-H04)', paidI ? (it.disclosure ? 'Pass' : 'Fail') : 'Not required']
              ];

              return (
                <div key={it.id} style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', display: 'flex', gap: '10px', alignItems: 'center', borderBottom: '1px solid var(--ink-100)', flexWrap: 'wrap' }}>
                    <b style={{ flex: 1, minWidth: '200px' }}>{it.title}</b>
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{it.format} · {it.lang} · due {HQ.ds(it.due)}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', borderRadius: '999px', background: HQ.tone(it.status).bg, color: HQ.tone(it.status).fg, fontSize: '12px', fontWeight: 600 }}>
                      {it.status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: '20px', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-500)', marginBottom: '4px' }}>Hook</div>
                        {editing ? (
                          <textarea
                            value={it.hook}
                            onChange={(e) => setItem(it.id, { hook: e.target.value })}
                            style={{ width: '100%', minHeight: '56px', padding: '8px 10px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
                          />
                        ) : (
                          <div>{it.hook}</div>
                        )}
                      </div>

                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-500)', marginBottom: '4px' }}>Script beats</div>
                        {(it.beats || []).map((b, bi) => (
                          <div key={bi} style={{ display: 'flex', gap: '8px', fontSize: '13px', padding: '2px 0' }}>
                            <span style={{ color: 'var(--ink-400)' }}>{bi + 1}.</span> {b}
                          </div>
                        ))}
                      </div>

                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-500)', marginBottom: '4px' }}>Caption</div>
                        {editing ? (
                          <textarea
                            value={it.caption}
                            onChange={(e) => setItem(it.id, { caption: e.target.value })}
                            style={{ width: '100%', minHeight: '56px', padding: '8px 10px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
                          />
                        ) : (
                          <div style={{ fontSize: '13px' }}>{it.caption}</div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(it.tags || []).map(t => (
                          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', height: '24px', padding: '0 8px', borderRadius: '6px', background: 'var(--ink-50)', border: '1px solid var(--ink-100)', fontSize: '12px' }}>
                            {t}
                          </span>
                        ))}
                        <span style={{ fontSize: '12px', color: 'var(--ink-600)', alignSelf: 'center' }}>CTA: {it.cta}</span>
                      </div>

                      {it.creative && (
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px', border: '1px solid var(--ink-100)', borderRadius: '10px' }}>
                          <div style={{ width: '72px', height: '90px', borderRadius: '6px', background: 'var(--ink-900)', backgroundImage: 'repeating-linear-gradient(135deg,rgba(255,255,255,.06) 0 6px,transparent 6px 12px)', display: 'grid', placeItems: 'center', color: 'var(--ink-300)', fontSize: '10px', textAlign: 'center', padding: '4px' }}>
                            Poster concept
                          </div>
                          <div style={{ fontSize: '13px' }}>
                            <b style={{ display: 'block' }}>Creative from Copilot</b>
                            <span style={{ color: 'var(--ink-600)' }}>{it.creative}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-500)' }}>Checks (Agent A10)</div>
                      {checks.map(([lbl, stat]) => (
                        <div key={lbl} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                          <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: HQ.tone(stat).bg, color: HQ.tone(stat).fg, display: 'grid', placeItems: 'center' }}>
                            <Icon name={stat === 'Fail' ? 'i-x' : 'i-check'} size={11} />
                          </span>
                          <span style={{ flex: 1 }}>{lbl}</span>
                          <span style={{ fontSize: '12px', color: HQ.tone(stat).fg, fontWeight: 600 }}>{stat}</span>
                        </div>
                      ))}

                      <label style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: 'var(--ink-25)', border: '1px solid var(--ink-100)', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="checkbox"
                          checked={it.disclosure}
                          onChange={() => setItem(it.id, { disclosure: !it.disclosure, tags: !it.disclosure ? it.tags.concat(['#ad']) : it.tags.filter(t => t !== '#ad') })}
                          style={{ accentColor: 'var(--teal-700)' }}
                        />
                        Paid-promotion disclosure (#ad) · mandatory for paid items (RR-H04)
                      </label>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
                        <button
                          onClick={() => {
                            if (editing) {
                              setState(prev => ({ ...prev, editing: null }));
                              setItem(it.id, { status: it.status === 'Approved' ? 'In review' : it.status });
                              HQ.toast('Content saved');
                            } else {
                              setState(prev => ({ ...prev, editing: it.id }));
                            }
                          }}
                          style={{ height: '34px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                        >
                          {editing ? 'Save' : 'Edit'}
                        </button>

                        <button
                          onClick={() => {
                            setState(prev => ({ ...prev, gen: it.id }));
                            setTimeout(() => {
                              setItem(it.id, { creative: (cr.platform === 'WhatsApp' ? 'Forwardable card concept' : 'Poster concept') + ': ' + narr.title + ', ' + it.lang + ' text, eligibility line and tagged QR code. Saved to Artifacts.' });
                              setState(prev => ({ ...prev, gen: null }));
                              HQ.toast('Creative generated and saved to this item');
                            }, 1200);
                          }}
                          style={{ height: '34px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}
                        >
                          {state.gen === it.id && <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--teal-100)', borderTopColor: 'var(--teal-600)', animation: 'spin .8s linear infinite' }}></span>}
                          <Icon name="i-image" size={14} /> Creative
                        </button>

                        {it.status !== 'Approved' && (
                          <button
                            onClick={() => {
                              if (!disc) return HQ.toast('Approval blocked: paid content must carry a disclosure tag (RR-H04)', 'error');
                              if (!hasLink) return HQ.toast('Approval blocked: the item has no tracked Resolence link', 'error');
                              if (spoil) return HQ.toast('Approval blocked: placement or salary claim without Observed evidence (RR-H03)', 'error');
                              setItem(it.id, { status: 'Approved' });
                              HQ.toast('Content approved');
                            }}
                            style={{ height: '34px', padding: '0 12px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: Deal & Commercials */}
      {tab === 'deal' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: '20px', alignItems: 'start', animation: 'fadein .2s' }}>
          <form onSubmit={dl.save} style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '22px', boxShadow: 'var(--e-1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <b style={{ fontSize: '16px' }}>Deal and commercials</b>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Rate per post (₹)</label>
                <input value={dl.rate} onChange={setD('rate')} inputMode="numeric" style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Number of posts</label>
                <input value={dl.posts} onChange={setD('posts')} inputMode="numeric" style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }} />
              </div>
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--teal-50)', border: '1px solid var(--teal-100)' }}>
                <div style={{ fontSize: '12px', color: 'var(--teal-800)' }}>Total (computed)</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--teal-900)' }}>{dl.total}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Deal type</label>
                <select value={dl.type} onChange={setD('type')} style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}>
                  <option>Paid</option>
                  <option>Paid + usage rights</option>
                  <option>Barter</option>
                  <option>Affiliate</option>
                  <option>Partnership</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Deliverables</label>
                <input value={dl.del} onChange={setD('del')} style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Post window start</label>
                <input type="date" value={dl.start} onChange={setD('start')} style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Post by</label>
                <input type="date" value={dl.end} onChange={setD('end')} style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Terms</label>
              <textarea value={dl.terms} onChange={setD('terms')} style={{ minHeight: '70px', padding: '10px 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Saving writes to commercials and adds a rate observation.</span>
              <button type="submit" style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                Save deal
              </button>
            </div>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px', boxShadow: 'var(--e-1)' }}>
              <b style={{ display: 'block', marginBottom: '10px' }}>Rate card · {dl.tier}</b>
              <div style={{ fontSize: '20px', fontWeight: 600 }}>{dl.band}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ display: 'inline-flex', height: '20px', padding: '0 8px', borderRadius: '999px', background: dl.provT.bg, color: dl.provT.fg, fontSize: '11px', fontWeight: 600, alignItems: 'center' }}>
                  {dl.prov}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{dl.bookings}</span>
              </div>
              <div style={{ fontSize: '13px', marginTop: '10px', color: dl.vsC }}>{dl.vs}</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px', boxShadow: 'var(--e-1)' }}>
              <b style={{ display: 'block', marginBottom: '8px' }}>Past fees with this team</b>
              {dl.noPast ? (
                <div style={{ fontSize: '13px', color: 'var(--ink-500)' }}>No past bookings.</div>
              ) : (
                dl.past.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--ink-100)', fontSize: '13px' }}>
                    <span>{p.l}</span>
                    <b>{p.v}</b>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Status Pipeline */}
      {tab === 'status' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadein .2s' }}>
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '22px', boxShadow: 'var(--e-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {sp.steps.map((sItem, i) => (
                <div key={sItem.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '13px', left: '-50%', right: '50%', height: '2px', background: sItem.line }} />
                  <span style={{ position: 'relative', width: '28px', height: '28px', borderRadius: '50%', background: sItem.bg, color: sItem.fg, border: `2px solid ${sItem.bd}`, display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700 }}>
                    {sItem.n}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: sItem.fw, color: sItem.c, textAlign: 'center' }}>
                    {sItem.l}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '22px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {sp.canNext && (
                <button
                  onClick={sp.next}
                  style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}
                >
                  Move to {sp.nextLabel} <Icon name="i-arrow" size={16} />
                </button>
              )}
              {sp.canExit && (
                <>
                  <button
                    onClick={sp.decline}
                    style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Mark declined
                  </button>
                  <button
                    onClick={sp.backout}
                    style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--danger-600)', background: '#fff', color: 'var(--danger-600)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Mark backed out
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
            <b style={{ display: 'block', marginBottom: '10px' }}>History</b>
            {sp.log.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', padding: '8px 0', borderTop: '1px solid var(--ink-100)', fontSize: '13px' }}>
                <span style={{ width: '80px', color: 'var(--ink-500)' }}>{l.date}</span>
                <span>{l.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Posts & Performance */}
      {(tab === 'posts' || tab === 'performance') && (
        <>
          {/* Tracking Setup Card */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <b style={{ fontSize: '16px', flex: 1 }}>Tracking setup</b>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{tk.note}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Post links</label>
              {tk.links.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 10px', border: '1px solid var(--ink-100)', borderRadius: '8px', background: 'var(--ink-25)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', borderRadius: '999px', background: '#fff', border: '1px solid var(--ink-200)', fontSize: '12px', fontWeight: 600, flex: 'none' }}>
                    {l.p}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.u}
                  </span>
                  <button type="button" onClick={l.rm} aria-label="Remove link" style={{ width: '28px', height: '28px', border: 0, borderRadius: '6px', background: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-500)' }}>
                    <Icon name="i-x" size={14} />
                  </button>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) auto', gap: '8px' }}>
                <select value={td.np} onChange={setD('np')} style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}>
                  <option value="YouTube">YouTube</option>
                  <option value="Instagram">Instagram</option>
                </select>
                <input value={td.nu} onChange={setD('nu')} placeholder="Paste the post link" style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }} />
                <button type="button" onClick={tk.addLink} style={{ height: '40px', padding: '0 14px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Icon name="i-plus" size={14} /> Add
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Unique hashtags</label>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '-4px' }}>Only this influencer uses these, so their posts are counted separately.</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {tk.tags.map((h, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '28px', padding: '0 4px 0 10px', borderRadius: '6px', background: 'var(--ink-50)', border: '1px solid var(--ink-100)', fontSize: '13px', fontWeight: 600 }}>
                    {h.t}
                    <button type="button" onClick={h.rm} aria-label="Remove hashtag" style={{ width: '22px', height: '22px', border: 0, background: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-500)' }}>
                      <Icon name="i-x" size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '8px', maxWidth: '520px' }}>
                <input value={td.nt} onChange={setD('nt')} placeholder={`#${HQ.film(c.filmId).title.replace(/[^A-Za-z0-9]/g, '')}${cr.name.split(' ')[0]}`} style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }} />
                <button type="button" onClick={tk.addTag} style={{ height: '40px', padding: '0 14px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Icon name="i-plus" size={14} /> Add
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', borderTop: '1px solid var(--ink-100)', paddingTop: '14px' }}>
              <span style={{ flex: 1, minWidth: '160px', fontSize: '13px', color: 'var(--danger-600)' }}>{tk.err}</span>
              <button onClick={tk.save} style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                Save tracking
              </button>
            </div>
          </div>

          {/* Overall Performance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadein .2s' }}>
            <b style={{ fontSize: '16px' }}>Overall performance</b>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px' }}>
              {peData.kpis.map(k => (
                <div key={k.l} style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--e-1)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--ink-600)' }}>{k.l}</div>
                  <div style={{ fontSize: '22px', fontWeight: 600, color: k.c || 'inherit' }}>{k.v}</div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-500)' }}>{k.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--e-1)' }}>
              <b style={{ display: 'block', marginBottom: '16px' }}>Actual vs predicted enrolments</b>
              <div style={{ position: 'relative', height: '28px', borderRadius: '999px', background: 'var(--ink-50)' }}>
                <div style={{ position: 'absolute', left: `${peData.bandL}%`, width: `${peData.bandW}%`, top: 0, bottom: 0, background: 'var(--teal-100)', borderRadius: '999px' }} />
                <div style={{ position: 'absolute', left: `${peData.actL}%`, top: '-4px', bottom: '-4px', width: '3px', background: 'var(--teal-800)', borderRadius: '2px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--ink-600)', marginTop: '8px' }}>
                <span>0</span>
                <span>Predicted {peData.range} · Actual <b>{peData.actual}</b></span>
                <span>{peData.max}</span>
              </div>
            </div>

            <b style={{ fontSize: '16px', paddingTop: '6px', borderTop: '2px solid var(--ink-100)' }}>Posts</b>
            {!x.posts.length ? (
              <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--ink-200)', borderRadius: '12px', background: '#fff', color: 'var(--ink-600)' }}>
                No posts linked yet. Add post links in Tracking setup above, or posts using {c.hashtags[0] || '#campaign'} are matched automatically.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {x.posts.slice().reverse().map(p => {
                  const talk = p.talk || (p.sent && p.sent[0] >= 65 ? `Most ${cr.platform === 'YouTube' ? 'viewers' : 'followers'} respond positively to ${cr.name}'s post, and several say they have registered.` : `Reactions are mixed: many ${cr.platform === 'YouTube' ? 'viewers' : 'followers'} doubt whether the programme leads to a job. Friends are being tagged with "apply chey".`);
                  const posPct = p.sent ? p.sent[0] : 70;
                  const neuPct = p.sent ? p.sent[1] : 24;
                  const negPct = p.sent ? p.sent[2] : 6;

                  return (
                    <div key={p.id} style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <span style={{ width: '72px', height: '48px', borderRadius: '6px', background: 'var(--ink-900)', color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}>
                          <Icon name="i-play" size={18} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ display: 'block' }}>{p.title}</b>
                          <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{p.format} · published {HQ.d(p.date)} · <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal-700)' }}>open post</a></span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--ink-500)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <Icon name="i-clock" size={12} /> Fetched {HQ.dt(p.lastFetch)}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '10px' }}>
                        <div><div style={{ fontSize: '11px', color: 'var(--ink-500)' }}>Views</div><div style={{ fontWeight: 600 }}>{p.views != null ? HQ.n(p.views) : 'Clicks only'}</div></div>
                        <div><div style={{ fontSize: '11px', color: 'var(--ink-500)' }}>Clicks</div><div style={{ fontWeight: 600 }}>{HQ.n(p.clicks)}</div></div>
                        <div><div style={{ fontSize: '11px', color: 'var(--ink-500)' }}>Registrations</div><div style={{ fontWeight: 600 }}>{HQ.n(p.regs)}</div></div>
                        <div><div style={{ fontSize: '11px', color: 'var(--ink-500)' }}>Enrolments</div><div style={{ fontWeight: 600 }}>{p.enrols || 0}</div></div>
                        <div><div style={{ fontSize: '11px', color: 'var(--ink-500)' }}>ER</div><div style={{ fontWeight: 600 }}>{p.views ? ((p.likes + p.comments + (p.shares || 0)) / p.views * 100).toFixed(1) + '%' : '—'}</div></div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ flex: 1, display: 'flex', height: '8px', borderRadius: '999px', overflow: 'hidden', background: 'var(--ink-100)' }}>
                          <span style={{ width: `${posPct}%`, background: 'var(--success-600)' }}></span>
                          <span style={{ width: `${neuPct}%`, background: 'var(--ink-300)' }}></span>
                          <span style={{ width: `${negPct}%`, background: 'var(--danger-600)' }}></span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--ink-600)' }}>
                          {posPct}% positive · {neuPct}% neutral · {negPct}% negative
                        </span>
                      </div>

                      <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--ink-25)', border: '1px solid var(--ink-100)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                          <b style={{ fontSize: '13px' }}>What people are saying</b>
                          <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>{HQ.n(p.comments)} comments analysed</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', lineHeight: '20px', color: 'var(--ink-800)' }}>{talk}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Reason Modal (Declined / Backed out) */}
      {state.reason && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,36,43,.45)', display: 'grid', placeItems: 'center', zIndex: 60 }}>
          <div style={{ width: '440px', background: '#fff', borderRadius: '16px', boxShadow: 'var(--e-3)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <b style={{ fontSize: '18px' }}>Why {state.reason}?</b>
            <p style={{ margin: 0, color: 'var(--ink-600)', fontSize: '13px' }}>
              Required. Written to the source's campaign history so the team doesn't repeat it.
            </p>
            <textarea
              value={state.rText}
              onChange={(e) => setState(prev => ({ ...prev, rText: e.target.value }))}
              placeholder="Reason"
              style={{ minHeight: '90px', padding: '10px 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setState(prev => ({ ...prev, reason: null }))} style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!state.rText.trim()) return HQ.toast('A reason is required', 'error');
                  setStatus(state.reason, state.rText.trim());
                  setState(prev => ({ ...prev, reason: null }));
                }}
                style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: 0, background: 'var(--danger-600)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Save status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Source Brief Modal */}
      {state.brief && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,36,43,.45)', display: 'grid', placeItems: 'center', zIndex: 60 }}>
          <div style={{ width: '640px', background: '#fff', borderRadius: '16px', boxShadow: 'var(--e-3)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <b style={{ fontSize: '18px' }}>Source brief</b>
              <button onClick={() => setState(prev => ({ ...prev, brief: false }))} aria-label="Close" style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--ink-500)' }}>
                <Icon name="i-x" size={20} />
              </button>
            </div>
            <textarea
              readOnly
              value={briefText}
              style={{ minHeight: '300px', padding: '12px', border: '1px solid var(--ink-200)', borderRadius: '8px', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: '12px', background: 'var(--ink-25)' }}
            />
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ flex: 1, fontSize: '12px', color: 'var(--success-800)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Icon name="i-shield" size={14} /> No contact details included
              </span>
              <button
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(briefText);
                    HQ.toast('Brief copied');
                  } catch (e) {
                    HQ.toast('Copy not allowed; use Download', 'error');
                  }
                }}
                style={{ height: '40px', padding: '0 14px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center' }}
              >
                <Icon name="i-copy" size={16} /> Copy text
              </button>
              <button
                onClick={() => {
                  const b = new Blob([briefText], { type: 'text/plain' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(b);
                  a.download = (cr.name + '-brief.txt').replace(/\s+/g, '-').toLowerCase();
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  HQ.toast('Brief downloaded');
                }}
                style={{ height: '40px', padding: '0 14px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center' }}
              >
                <Icon name="i-download" size={16} /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
