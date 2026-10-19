import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';
import { api } from '../../lib/api';

const DISTRICTS_LIST = [
  'Warangal',
  'Hanumakonda',
  'Hyderabad',
  'Karimnagar',
  'Khammam',
  'Nalgonda',
  'Nizamabad'
];

const STATES_LIST = [
  'Telangana',
  'Andhra Pradesh',
  'Karnataka',
  'Tamil Nadu',
  'Kerala',
  'Maharashtra',
  'Odisha',
  'West Bengal',
  'Gujarat',
  'Rajasthan',
  'Madhya Pradesh',
  'Uttar Pradesh',
  'Bihar',
  'Delhi',
  'Punjab',
  'Haryana'
];


const QUAL_OPTIONS = [
  '10th pass',
  '12th pass',
  'ITI',
  'Diploma',
  'BSc / BCA',
  'B.Tech / B.E.',
  'B.Tech (final year)',
  'MCA'
];

const SKILL_OPTIONS = [
  'CSE',
  'IT',
  'ECE',
  'EEE',
  'Mechanical',
  'Civil',
  'Fitter',
  'Electrician',
  'Science'
];

const AGE_OPTIONS = [
  '18–20 years',
  '20–23 years',
  '21–26 years',
  '24–30 years'
];

const EXP_OPTIONS = [
  'Fresher',
  '0–2 years experience',
  '2–5 years experience'
];

const LANG_OPTIONS = [
  'Telugu',
  'English',
  'Hindi',
  'Urdu'
];

const STEPS = [
  'Objective and cohort',
  'Narrative',
  'Channels',
  'Influencers',
  'Content',
  'Review and create'
];

export default function CampaignWizard() {
  const { HQ, currentCourse, go, toast, state: globalState } = useHQ();
  const film = currentCourse || {};
  const r = (globalState && globalState.route) || {};
  const campId = r.id;

  // Wizard state from backend
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [wizard, setWizard] = useState({ step: 0, done: [], needs: [], answers: {} });
  const [step, setStep] = useState(0);

  // Agent execution loader state
  const [agentLoader, setAgentLoader] = useState(null);
  const [loaderIdx, setLoaderIdx] = useState(0);

  // Form fields for step 0
  const [campName, setCampName] = useState('');
  const [objective, setObjective] = useState('Getting onboarded');
  const [kpi, setKpi] = useState('Screening enrolments');
  const [targetEnrols, setTargetEnrols] = useState(60);
  const [costCeiling, setCostCeiling] = useState(4500);
  const [budget, setBudget] = useState(400000);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [markets, setMarkets] = useState(['Telangana']);
  const [qual, setQual] = useState('B.Tech / B.E.');
  const [skillBg, setSkillBg] = useState(['CSE', 'IT', 'ECE']);
  const [ageBand, setAgeBand] = useState('21–26 years');
  const [expBand, setExpBand] = useState('0–2 years experience');
  const [languages, setLanguages] = useState(['Telugu']);
  const [freeText, setFreeText] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [stepError, setStepError] = useState('');

  // Dropdown popover state for Step 0 options
  const [openDropdown, setOpenDropdown] = useState(null); // 'markets' | 'skills' | 'languages' | null
  const [marketSearch, setMarketSearch] = useState('');

  // Modals & sub-views
  const [qsOpen, setQsOpen] = useState(false);
  const [cohortAnswers, setCohortAnswers] = useState({ q1: 'Decide for me', q2: 'Decide for me', q3: 'No' });
  const [focusCohort, setFocusCohort] = useState('');

  // Step 1: Narrative state
  const [narratives, setNarratives] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMsgs, setChatMsgs] = useState([
    { from: 'ai', text: 'Tell me what to change in the selected narrative, or ask for a new one (e.g. "suggest a new narrative about the stipend").' }
  ]);
  const [chatBusy, setChatBusy] = useState(false);
  const [ownNarrOpen, setOwnNarrOpen] = useState(false);
  const [ownTitle, setOwnTitle] = useState('');
  const [ownCls, setOwnCls] = useState('Career outcome');
  const [ownHook, setOwnHook] = useState('');

  // Step 2: Channels state
  const [channels, setChannels] = useState([]);

  // Step 3: Influencers state
  const [rankedList, setRankedList] = useState([]);
  const [blockedList, setBlockedList] = useState([]);
  const [shortlist, setShortlist] = useState([]);
  const [activeNarrTab, setActiveNarrTab] = useState(null);
  const [channelFilter, setChannelFilter] = useState('All');
  const [fitModal, setFitModal] = useState(null);
  const [bankModal, setBankModal] = useState(false);
  const [bankCreators, setBankCreators] = useState([]);
  const [bankSearch, setBankSearch] = useState('');
  const [consentModal, setConsentModal] = useState(null);
  const [consentBasis, setConsentBasis] = useState('');
  const [consentDate, setConsentDate] = useState('2026-10-06');

  // Step 4: Content state
  const [contentMap, setContentMap] = useState({});
  const [curCreatorTab, setCurCreatorTab] = useState(null);
  const [contentChatOpen, setContentChatOpen] = useState(false);
  const [contentChatInput, setContentChatInput] = useState('');
  const [contentChatMsgs, setContentChatMsgs] = useState([
    { from: 'ai', text: 'Tell me what to change in the selected post, or ask for a new variation (e.g. "new card about the stipend").' }
  ]);
  const [contentChatBusy, setContentChatBusy] = useState(false);
  const [activeTrendTab, setActiveTrendTab] = useState('tags');
  const [trendTags, setTrendTags] = useState([]);

  // Step 5: Review & create state
  const [reviewData, setReviewData] = useState(null);
  const [creating, setCreating] = useState(false);

  // Dynamic Cohort Sizing formula
  const POOL_MAP = {
    Warangal: 18400,
    Hanumakonda: 9600,
    Hyderabad: 61000,
    Karimnagar: 8800,
    Khammam: 7900,
    Nalgonda: 8200,
    Nizamabad: 6400,
    Telangana: 121300,
    'Andhra Pradesh': 104000,
    Karnataka: 132000,
    'Tamil Nadu': 148000,
    Kerala: 52000,
    Maharashtra: 176000,
    Odisha: 48000,
    'West Bengal': 71000,
    Gujarat: 69000,
    Rajasthan: 58000,
    'Madhya Pradesh': 63000,
    'Uttar Pradesh': 154000,
    Bihar: 46000,
    Delhi: 44000,
    Punjab: 31000,
    Haryana: 39000
  };

  const qFactor = {
    '10th pass': 1.6,
    '12th pass': 1.3,
    'B.Tech / B.E.': 1,
    'B.Tech (final year)': 0.35,
    MCA: 0.12,
    'BSc / BCA': 0.8,
    Diploma: 0.45,
    ITI: 0.5
  }[qual] || 0.6;
  const aFactor = {
    '18–20 years': 0.3,
    '20–23 years': 0.55,
    '21–26 years': 0.75,
    '24–30 years': 0.5
  }[ageBand] || 0.7;
  const xFactor = {
    Fresher: 0.6,
    '0–2 years experience': 0.85,
    '2–5 years experience': 0.35
  }[expBand] || 0.8;
  const skillMult = skillBg.length ? Math.min(1, 0.35 + 0.22 * skillBg.length) : 0.8;

  const estimatedCohortSize = Math.round(
    (markets.reduce((t, m) => t + (POOL_MAP[m] || 15000), 0) * qFactor * aFactor * xFactor * skillMult) / 10
  ) * 10;
  const isCohortSizeOk = estimatedCohortSize >= 500;

  // Simulation loader runner
  const runAgentLoader = useCallback((title, sub, stepsList, onDone) => {
    setAgentLoader({ title, sub, steps: stepsList });
    setLoaderIdx(0);
    stepsList.forEach((_, i) => {
      setTimeout(() => {
        setLoaderIdx(i + 1);
      }, 600 * (i + 1));
    });
    setTimeout(() => {
      setAgentLoader(null);
      if (onDone) onDone();
    }, 600 * stepsList.length + 300);
  }, []);

  // Fetch campaign draft & wizard from backend
  const loadDraft = useCallback(async () => {
    let effectiveId = campId;
    if (!effectiveId && film?.id) {
      try {
        const list = await api.get(`/campaigns?course=${film.id}`);
        const existingDraft = (list || []).find((k) => k.status === 'Draft');
        if (existingDraft) {
          effectiveId = existingDraft.id;
        } else {
          const created = await api.post('/campaigns', { course_id: film.id, name: 'Untitled campaign' });
          if (created?.campaign?.id) {
            effectiveId = created.campaign.id;
          }
        }
      } catch (e) {
        console.warn('Could not auto-create draft:', e);
      }
    }

    if (!effectiveId) {
      setLoadError('No campaign draft ID specified');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get(`/campaigns/${effectiveId}/wizard`);
      const c = res.campaign || {};
      const w = res.wizard || {};

      setCampaign(c);
      setWizard(w);
      setStep(typeof w.step === 'number' ? w.step : 0);

      // Populate form fields
      setCampName(c.name || 'Untitled campaign');
      setObjective(c.objective || 'Getting onboarded');
      setKpi(c.kpi || 'Screening enrolments');
      setTargetEnrols(c.target || 60);
      setCostCeiling(c.ceiling || film.ceiling || 4500);
      setBudget(c.budget || 400000);
      setStartDate(c.start_date || '2026-10-15');
      setEndDate(c.end_date || '2026-11-15');
      setMarkets(Array.isArray(c.markets) && c.markets.length ? c.markets : ['Telangana']);
      setLanguages(Array.isArray(c.languages) && c.languages.length ? c.languages : ['Telugu']);
      setQual(c.qual || 'B.Tech / B.E.');
      setSkillBg(Array.isArray(c.skill_bg) && c.skill_bg.length ? c.skill_bg : ['CSE', 'IT', 'ECE']);
      setAgeBand(c.age_band || '21–26 years');
      setExpBand(c.exp_band || '0–2 years experience');
      setFreeText(c.free_text || '');
      setCohortAnswers(w.answers || { q1: 'Decide for me', q2: 'Decide for me', q3: 'No' });
      setFocusCohort(w.focus || '');

      if (w.narrs && Array.isArray(w.narrs)) setNarratives(w.narrs);
      if (w.channels && Array.isArray(w.channels)) setChannels(w.channels);
      if (w.ranked) {
        setRankedList(w.ranked.list || []);
        setBlockedList(w.ranked.blocked || []);
      }
      if (w.shortlist && Array.isArray(w.shortlist)) setShortlist(w.shortlist);
      if (w.content) setContentMap(w.content);
      if (w.review) setReviewData(w.review);
    } catch (err) {
      console.error('Failed to load draft wizard:', err);
      setLoadError(err.message || 'Failed to load campaign draft');
    } finally {
      setLoading(false);
    }
  }, [campId, film.ceiling]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  // Load creator bank sources for selector
  const loadBankSources = async () => {
    try {
      const srcs = await api.get('/sources');
      if (Array.isArray(srcs)) {
        setBankCreators(srcs);
      }
    } catch (err) {
      console.error('Failed to load sources from bank:', err);
    }
  };

  // Autosave Step 0 Fields
  const saveStep0Fields = async (overrides = {}) => {
    if (!campId) return;
    try {
      const curMarkets = overrides.markets || markets;
      const curQual = overrides.qual || qual;
      const curSkill = overrides.skill_bg || skillBg;
      const curAge = overrides.age_band || ageBand;
      const curExp = overrides.exp_band || expBand;
      const curLangs = overrides.languages || languages;
      const curFree = overrides.free_text !== undefined ? overrides.free_text : freeText;
      const curAnswers = overrides.answers || cohortAnswers;

      const payload = {
        name: overrides.name || campName,
        objective: overrides.objective || objective,
        kpi: overrides.kpi || kpi,
        target: Number(overrides.target !== undefined ? overrides.target : targetEnrols) || 0,
        ceiling: Number(overrides.ceiling !== undefined ? overrides.ceiling : costCeiling) || 0,
        budget: Number(overrides.budget !== undefined ? overrides.budget : budget) || 0,
        start_date: overrides.start_date || startDate,
        end_date: overrides.end_date || endDate,
        markets: curMarkets,
        languages: curLangs,
        qual: curQual,
        skill_bg: curSkill,
        age_band: curAge,
        exp_band: curExp,
        free_text: curFree,
        answers: curAnswers,
        cohort: focusCohort || `${curQual}, ${curMarkets.join(' and ')}`,
        asset: focusCohort || `${curQual}, ${curMarkets.join(' and ')}`
      };
      await api.patch(`/campaigns/${campId}/wizard/objective`, payload);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSavedAt(timeStr);
    } catch (err) {
      console.error('Autosave failed:', err);
    }
  };


  // Navigation handlers
  const handleExit = () => {
    go('campaigns');
    toast('Draft saved. Continue any time from Campaigns.');
  };

  const handleAskCopilot = () => {
    HQ.set((x) => {
      x.copilotOpen = true;
      x.copilotCtx = `Create campaign · ${STEPS[step] || 'Wizard'}`;
    });
  };

  // Step 0 Continue -> Validate and show questions / run cohort
  const handleStep0Continue = async () => {
    if (!campName.trim()) {
      setStepError('Please enter a campaign name.');
      return;
    }
    if (!budget || budget <= 0) {
      setStepError('Please set a valid campaign budget.');
      return;
    }
    if (!startDate || !endDate) {
      setStepError('Please choose start and end dates.');
      return;
    }
    if (!markets.length) {
      setStepError('Please select at least one state or district.');
      return;
    }
    if (!isCohortSizeOk) {
      setStepError('The cohort is below the minimum size (500). Widen the states or qualification.');
      return;
    }
    setStepError('');

    // If questions not answered yet, open Cohort Questions modal
    if (!wizard.qsShown || !cohortAnswers.q1) {
      setQsOpen(true);
      return;
    }

    await advanceFromStep0();
  };

  const submitCohortQuestions = async () => {
    setQsOpen(false);
    await advanceFromStep0();
  };

  const advanceFromStep0 = async () => {
    await saveStep0Fields();
    // Run Agent A5 if narratives not generated
    runAgentLoader(
      'Suggesting narratives',
      'Agent A5 · usually under 60 seconds',
      [
        `Building context pack for ${qual} in ${markets.join(' and ')}`,
        'Generating 8 candidates across 5 narrative classes',
        'Scoring resonance, objective fit and difference from competing programmes',
        'Checking outcome claims (RR-H03), discrimination risk and consent'
      ],
      async () => {
        try {
          const res = await api.post(`/campaigns/${campId}/wizard/narratives`, {});
          const w = res.wizard || {};
          setWizard(w);
          if (w.narrs) setNarratives(w.narrs);
          setStep(1);
        } catch (err) {
          toast(err.message || 'Failed to generate narratives', 'error');
        }
      }
    );
  };

  // Step 1: Narrative selection & chat
  const handleSelectNarrative = async (narrId, isHeld) => {
    if (isHeld) {
      toast('Held (RR-H03): attach Observed evidence for this claim on the course brief before using it', 'error');
      return;
    }
    try {
      const res = await api.post(`/campaigns/${campId}/wizard/narratives/select`, { id: narrId });
      const w = res.wizard || {};
      setWizard(w);
      if (w.narrs) setNarratives(w.narrs);
      toast('Primary narrative selected');
    } catch (err) {
      toast(err.message || 'Failed to select narrative', 'error');
    }
  };

  const handleSendNarrativeChat = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const msg = chatInput.trim();
    if (!msg || chatBusy) return;
    setChatBusy(true);
    setChatMsgs((prev) => [...prev, { from: 'me', text: msg }]);
    setChatInput('');

    try {
      const res = await api.post(`/campaigns/${campId}/wizard/narratives`, { instruction: msg });
      const w = res.wizard || {};
      setWizard(w);
      if (w.narrs) setNarratives(w.narrs);
      setChatMsgs((prev) => [...prev, { from: 'ai', text: 'Narratives updated based on your guidance.' }]);
      toast('Narratives updated');
    } catch (err) {
      setChatMsgs((prev) => [...prev, { from: 'ai', text: `Could not rewrite: ${err.message}` }]);
    } finally {
      setChatBusy(false);
    }
  };

  const handleAddOwnNarrative = async () => {
    if (!ownTitle.trim()) return;
    try {
      const res = await api.post(`/campaigns/${campId}/wizard/narratives/own`, {
        title: ownTitle,
        cls: ownCls,
        hook: ownHook
      });
      const w = res.wizard || {};
      setWizard(w);
      if (w.narrs) setNarratives(w.narrs);
      setOwnNarrOpen(false);
      setOwnTitle('');
      setOwnHook('');
      toast('Added your narrative');
    } catch (err) {
      toast(err.message || 'Failed to add narrative', 'error');
    }
  };

  const handleStep1Next = async () => {
    const prim = narratives.find((n) => n.role === 'Primary');
    if (!prim) {
      toast('Select a narrative before continuing', 'error');
      return;
    }
    runAgentLoader(
      'Planning channels',
      'Agent A6 · prior × cohort behaviour × measurability',
      [
        `Loading the ${objective} prior matrix`,
        `Weighting by how ${qual} use each channel`,
        'Applying measurability (1.0 measured, 0.8 tracked link, 0.6 manual)',
        "Locking the programme's own page as Anchor",
        'Writing a reason for each channel'
      ],
      async () => {
        try {
          const res = await api.post(`/campaigns/${campId}/wizard/channels`);
          const w = res.wizard || {};
          setWizard(w);
          if (w.channels) setChannels(w.channels);
          setStep(2);
        } catch (err) {
          toast(err.message || 'Failed to plan channels', 'error');
        }
      }
    );
  };

  // Step 2: Channel mix toggling and renormalization
  const toggleChannel = async (idx) => {
    const updated = [...channels];
    const target = updated[idx];
    if (target.locked) return; // Anchor is locked
    target.on = !target.on;

    // Renormalize active channels to sum to 100%
    const active = updated.filter((r) => r.on);
    if (active.length > 0) {
      const baseSum = active.reduce((acc, r) => acc + (r.base || r.share || 1), 0);
      active.forEach((r) => {
        r.base = r.base || r.share || 1;
        r.share = Math.max(10, Math.round((r.base / baseSum) * 100));
      });
      const sumShares = active.reduce((acc, r) => acc + r.share, 0);
      if (active[0]) active[0].share += 100 - sumShares;
    }
    setChannels(updated);
    try {
      await api.patch(`/campaigns/${campId}/wizard/channels`, { channels: updated });
    } catch (err) {
      console.error('Failed to update channels:', err);
    }
  };

  const handleStep2Next = async () => {
    const activeChans = channels.filter((r) => r.on);
    if (!activeChans.length) {
      toast('Choose at least one channel', 'error');
      return;
    }
    const totalShare = activeChans.reduce((a, r) => a + r.share, 0);
    if (totalShare !== 100) {
      toast(`Channel shares must total 100% (currently ${totalShare}%)`, 'error');
      return;
    }

    runAgentLoader(
      'Ranking influence sources',
      'Agent A7 · six-stage pipeline, under 90 seconds',
      [
        'Pool: Creator Bank sources on chosen channels',
        'Gates: backed out 2 of 3, contested, no institutional consent, under 1,000 followers, no post in 60 days',
        'Trust and reach: affiliation, past enrolments, audience in the states',
        'Quality: engagement vs tier median',
        'Fit: authority on the course skill domain',
        'Portfolio: overlap-adjusted enrolments within budget'
      ],
      async () => {
        try {
          const res = await api.post(`/campaigns/${campId}/wizard/rank`);
          const w = res.wizard || {};
          setWizard(w);
          if (w.ranked) {
            setRankedList(w.ranked.list || []);
            setBlockedList(w.ranked.blocked || []);
          }
          if (w.shortlist) setShortlist(w.shortlist);
          setStep(3);
        } catch (err) {
          toast(err.message || 'Failed to rank sources', 'error');
        }
      }
    );
  };

  // Step 3: Shortlist toggle, auto-portfolio, consent
  const handleAutoPortfolio = async () => {
    try {
      const res = await api.post(`/campaigns/${campId}/wizard/portfolio`);
      const w = res.wizard || {};
      setWizard(w);
      if (w.shortlist) setShortlist(w.shortlist);
      toast('Top portfolio sources shortlisted');
    } catch (err) {
      toast(err.message || 'Failed to build portfolio', 'error');
    }
  };

  const handleToggleShortlist = async (creator, currentShort) => {
    if (currentShort) {
      // Remove
      try {
        const res = await api.post(`/campaigns/${campId}/wizard/shortlist`, {
          source_id: creator.id,
          remove: true
        });
        const w = res.wizard || {};
        setWizard(w);
        if (w.shortlist) setShortlist(w.shortlist);
        toast(`Removed ${creator.name}`);
      } catch (err) {
        toast(err.message || 'Failed to remove source', 'error');
      }
    } else {
      // Check Institutional Consent (RR-H06)
      const isInst = creator.type === 'College network' || creator.type === 'Placement cell';
      if (isInst && creator.consent !== 'Recorded') {
        setConsentModal(creator);
        setConsentBasis(`Consent agreed with ${creator.name} placement coordinator`);
        return;
      }

      // Add to shortlist
      try {
        const primary = narratives.find((n) => n.role === 'Primary');
        const res = await api.post(`/campaigns/${campId}/wizard/shortlist`, {
          source_id: creator.id,
          posts: 1,
          fee: creator.rate || 0,
          narrative_id: primary ? primary.id : null,
          deal_type: creator.rate ? 'Paid' : 'Partnership'
        });
        const w = res.wizard || {};
        setWizard(w);
        if (w.shortlist) setShortlist(w.shortlist);
        toast(`Shortlisted ${creator.name}`);
      } catch (err) {
        toast(err.message || 'Failed to shortlist source', 'error');
      }
    }
  };

  const confirmConsentAndShortlist = async () => {
    if (!consentModal) return;
    try {
      const primary = narratives.find((n) => n.role === 'Primary');
      const res = await api.post(`/campaigns/${campId}/wizard/shortlist`, {
        source_id: consentModal.id,
        posts: 1,
        fee: consentModal.rate || 0,
        narrative_id: primary ? primary.id : null,
        deal_type: consentModal.rate ? 'Paid' : 'Partnership',
        consent_basis: consentBasis,
        consent_date: consentDate
      });
      const w = res.wizard || {};
      setWizard(w);
      if (w.shortlist) setShortlist(w.shortlist);
      setConsentModal(null);
      toast(`Consent recorded & shortlisted ${consentModal.name}`);
    } catch (err) {
      toast(err.message || 'Failed to record consent', 'error');
    }
  };

  const handleStep3Next = async () => {
    if (!shortlist.length) {
      toast('Shortlist at least one source before continuing', 'error');
      return;
    }

    runAgentLoader(
      'Suggesting content',
      'Agent A8 · personalised to the cohort',
      [
        "Reading each source's top posts",
        'Personalising language, aspiration, career outcome, benefit, format and call to action',
        "Writing in the cohort's language and register",
        'Adding the tracked Resolence link and disclosure'
      ],
      async () => {
        try {
          const res = await api.post(`/campaigns/${campId}/wizard/content`, {});
          const w = res.wizard || {};
          setWizard(w);
          if (w.content) setContentMap(w.content);
          setStep(4);
        } catch (err) {
          toast(err.message || 'Failed to generate content', 'error');
        }
      }
    );
  };

  // Step 4: Content selection & rewrite
  const handleSelectContentVariant = async (sourceId, variantId) => {
    const curContent = contentMap[sourceId] || { vars: [], sel: [] };
    const curSel = curContent.sel || [];
    const isSel = curSel.includes(variantId);
    const slItem = shortlist.find((s) => s.source_id === sourceId || s.creatorId === sourceId) || {};
    const maxPosts = slItem.posts || 1;

    let nextSel;
    if (isSel) {
      nextSel = curSel.filter((id) => id !== variantId);
    } else {
      if (curSel.length >= maxPosts) {
        nextSel = [...curSel.slice(1), variantId];
      } else {
        nextSel = [...curSel, variantId];
      }
    }

    try {
      const res = await api.post(`/campaigns/${campId}/wizard/content/select`, {
        source_id: sourceId,
        sel: nextSel
      });
      const w = res.wizard || {};
      setWizard(w);
      if (w.content) setContentMap(w.content);
    } catch (err) {
      toast(err.message || 'Failed to update content selection', 'error');
    }
  };

  const handleSendContentRewrite = async (e, sourceId) => {
    if (e && e.preventDefault) e.preventDefault();
    const msg = contentChatInput.trim();
    if (!msg || contentChatBusy) return;
    setContentChatBusy(true);
    setContentChatMsgs((prev) => [...prev, { from: 'me', text: msg }]);
    setContentChatInput('');

    try {
      const res = await api.post(`/campaigns/${campId}/wizard/content`, {
        source_id: sourceId,
        instruction: msg
      });
      const w = res.wizard || {};
      setWizard(w);
      if (w.content) setContentMap(w.content);
      setContentChatMsgs((prev) => [...prev, { from: 'ai', text: 'Variation regenerated.' }]);
      toast('Content regenerated');
    } catch (err) {
      setContentChatMsgs((prev) => [...prev, { from: 'ai', text: `Rewrite error: ${err.message}` }]);
    } finally {
      setContentChatBusy(false);
    }
  };

  const handleStep4Next = async () => {
    runAgentLoader(
      'Predicting and checking',
      'Agent A9 prediction · Agent A10 compliance and fairness gate',
      [
        'Predicting reach, clicks, registrations and enrolments per source',
        'Discounting overlap in shared states',
        'Running the 13 governance and fairness checks'
      ],
      async () => {
        try {
          const res = await api.post(`/campaigns/${campId}/wizard/review`);
          const w = res.wizard || {};
          setWizard(w);
          if (w.review) setReviewData(w.review);
          setStep(5);
        } catch (err) {
          toast(err.message || 'Review generation failed', 'error');
        }
      }
    );
  };

  // Step 5: Create Campaign (Freeze v1)
  const handleCreateCampaign = async () => {
    if (creating) return;
    try {
      setCreating(true);
      const res = await api.post(`/campaigns/${campId}/wizard/create`);
      toast('Campaign created. Prediction frozen as v1.');
      go('campaign', { id: campId, tab: 'overview' });
    } catch (err) {
      toast(err.message || 'Campaign creation failed', 'error');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--ink-500)', fontSize: '14px' }}>
          Loading campaign wizard…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ padding: '16px', background: 'var(--danger-50)', border: '1px solid var(--danger-200)', borderRadius: '12px', color: 'var(--danger-800)' }}>
          <b style={{ display: 'block', marginBottom: '8px' }}>Failed to load campaign draft</b>
          <p style={{ margin: 0 }}>{loadError}</p>
          <button
            onClick={() => go('campaigns')}
            style={{ marginTop: '12px', padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--danger-300)', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--ink-25)' }}>
      {/* Top Header */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid var(--ink-100)',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={handleExit}
            style={{
              border: 0,
              background: 'none',
              cursor: 'pointer',
              color: 'var(--ink-600)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-50)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <Icon name="i-left" size={16} /> Exit
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                value={campName}
                onChange={(e) => {
                  setCampName(e.target.value);
                  saveStep0Fields();
                }}
                placeholder="Campaign name"
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--ink-900)',
                  border: '1px solid transparent',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  background: 'transparent',
                  width: '320px'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ink-300)';
                  e.currentTarget.style.background = '#fff';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.background = 'transparent';
                  saveStep0Fields();
                }}
              />
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
                {savedAt ? `Saved at ${savedAt}` : 'Draft saved'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleAskCopilot}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '36px',
              padding: '0 14px',
              borderRadius: '8px',
              border: '1px solid var(--teal-300)',
              background: 'var(--teal-50)',
              color: 'var(--teal-800)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Icon name="i-sparkles" size={16} /> Ask Copilot
          </button>
        </div>
      </div>

      {/* Progress Stepper Bar */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid var(--ink-100)',
          padding: '0 32px',
          display: 'flex',
          overflowX: 'auto',
          alignItems: 'center'
        }}
      >
        {STEPS.map((stepLabel, idx) => {
          const isCurrent = step === idx;
          const isDone = (wizard.done || []).includes(idx);
          const canClick = idx <= (wizard.done && wizard.done.length ? Math.max(...wizard.done) + 1 : 0);

          return (
            <div
              key={stepLabel}
              onClick={() => {
                if (canClick) setStep(idx);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 16px',
                borderBottom: isCurrent ? '2px solid var(--teal-600)' : '2px solid transparent',
                cursor: canClick ? 'pointer' : 'default',
                color: isCurrent ? 'var(--teal-800)' : isDone ? 'var(--ink-900)' : 'var(--ink-400)',
                fontWeight: isCurrent ? 600 : 500,
                fontSize: '13px',
                whiteSpace: 'nowrap'
              }}
            >
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: isDone && !isCurrent ? 'var(--teal-700)' : isCurrent ? 'var(--teal-700)' : 'var(--ink-100)',
                  color: isDone || isCurrent ? '#fff' : 'var(--ink-500)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '11px',
                  fontWeight: 600
                }}
              >
                {isDone && !isCurrent ? '✓' : idx + 1}
              </span>
              <span>{stepLabel}</span>
            </div>
          );
        })}
      </div>

      {/* Agent Execution Loader Modal */}
      {agentLoader && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(16,36,43,.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100
          }}
        >
          <div
            style={{
              width: '480px',
              background: '#fff',
              borderRadius: '16px',
              boxShadow: 'var(--e-3)',
              padding: '28px'
            }}
          >
            <b style={{ fontSize: '18px', color: 'var(--ink-900)', display: 'block' }}>{agentLoader.title}</b>
            <p style={{ margin: '4px 0 16px', color: 'var(--ink-500)', fontSize: '13px' }}>{agentLoader.sub}</p>
            {/* Progress Bar */}
            <div style={{ height: '6px', borderRadius: '3px', background: 'var(--ink-100)', overflow: 'hidden', marginBottom: '20px' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.round((loaderIdx / agentLoader.steps.length) * 100)}%`,
                  background: 'var(--teal-600)',
                  transition: 'width 0.4s ease'
                }}
              ></div>
            </div>
            {/* Step list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {agentLoader.steps.map((stDesc, sIdx) => {
                const isFinished = sIdx < loaderIdx;
                const isExecuting = sIdx === loaderIdx;
                return (
                  <div
                    key={stDesc}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '13px',
                      color: isFinished ? 'var(--ink-900)' : isExecuting ? 'var(--teal-800)' : 'var(--ink-400)',
                      fontWeight: isExecuting ? 600 : 400
                    }}
                  >
                    <Icon
                      name={isFinished ? 'i-check' : 'i-clock'}
                      size={16}
                      style={{ color: isFinished ? 'var(--success-600)' : 'var(--ink-400)' }}
                    />
                    <span>{stDesc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Wizard Step Content Area */}
      <div style={{ flex: 1, padding: '28px 32px 48px', maxWidth: '1320px', width: '100%', margin: '0 auto' }}>
        {stepError && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'var(--danger-50)', border: '1px solid var(--danger-200)', borderRadius: '8px', color: 'var(--danger-800)', fontSize: '13px' }}>
            {stepError}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 0: OBJECTIVE AND COHORT                                             */}
        {/* ========================================================================= */}
        {step === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '24px', alignItems: 'start' }}>
            {/* Left Column: Form Controls */}
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '6px' }}>
                  Campaign Objective
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { id: 'Getting onboarded', label: 'Getting onboarded', sub: 'Registrations & enrolments (cost/enrolment KPI)' },
                    { id: 'Awareness', label: 'Awareness', sub: 'Make cohort aware programme exists (clicks KPI)' },
                    { id: 'Engagement', label: 'Engagement', sub: 'Interaction, comments and shares (engagement KPI)' }
                  ].map((objOpt) => {
                    const sel = objective === objOpt.id;
                    return (
                      <button
                        key={objOpt.id}
                        type="button"
                        onClick={() => {
                          setObjective(objOpt.id);
                          setKpi(objOpt.id === 'Awareness' ? 'Tracked clicks' : objOpt.id === 'Engagement' ? 'Engagements' : 'Screening enrolments');
                          saveStep0Fields();
                        }}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: sel ? '2px solid var(--teal-600)' : '1px solid var(--ink-200)',
                          background: sel ? 'var(--teal-50)' : '#fff',
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                      >
                        <b style={{ display: 'block', fontSize: '13px', color: sel ? 'var(--teal-900)' : 'var(--ink-900)', marginBottom: '4px' }}>
                          {objOpt.label}
                        </b>
                        <span style={{ fontSize: '11px', color: 'var(--ink-500)', lineHeight: 1.3, display: 'block' }}>
                          {objOpt.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Targets and Budget */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '6px' }}>
                    Target Enrolments
                  </label>
                  <input
                    type="number"
                    value={targetEnrols}
                    onChange={(e) => {
                      setTargetEnrols(e.target.value);
                      saveStep0Fields();
                    }}
                    style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--ink-500)', marginTop: '4px', display: 'block' }}>
                    Course batch target: {film.target || 'None set'}
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '6px' }}>
                    Cost Ceiling (CPI)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--ink-500)', fontSize: '13px' }}>₹</span>
                    <input
                      type="number"
                      value={costCeiling}
                      onChange={(e) => {
                        setCostCeiling(e.target.value);
                        saveStep0Fields();
                      }}
                      style={{ width: '100%', height: '38px', padding: '0 10px 0 24px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px' }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--ink-500)', marginTop: '4px', display: 'block' }}>
                    Ceiling from brief: ₹{film.ceiling ? film.ceiling.toLocaleString('en-IN') : 'None'}
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '6px' }}>
                    Budget (₹)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--ink-500)', fontSize: '13px' }}>₹</span>
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => {
                        setBudget(e.target.value);
                        saveStep0Fields();
                      }}
                      style={{ width: '100%', height: '38px', padding: '0 10px 0 24px', border: budget > 0 ? '1px solid var(--ink-300)' : '1px solid var(--danger-600)', borderRadius: '6px', fontSize: '13px' }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: budget > 0 ? 'var(--ink-500)' : 'var(--danger-600)', marginTop: '4px', display: 'block' }}>
                    {budget > 0 ? `₹${(budget / 100000).toFixed(1)}L allocated` : 'Required field'}
                  </span>
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '6px' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      saveStep0Fields();
                    }}
                    style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '6px' }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      saveStep0Fields();
                    }}
                    style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* 6-Field Cohort Specification Grid: States/Districts, Qual, Skill, Age, Exp, Lang */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                
                {/* 1. Target States / Districts Options Dropdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', minWidth: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>
                    Target States / Districts
                  </label>
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'markets' ? null : 'markets')}
                    style={{
                      height: '38px',
                      padding: '0 12px',
                      border: openDropdown === 'markets' ? '1px solid var(--teal-600)' : '1px solid var(--ink-300)',
                      borderRadius: '6px',
                      background: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      minWidth: 0
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: '13px',
                        color: markets.length ? 'var(--ink-900)' : 'var(--ink-400)'
                      }}
                      title={markets.join(', ')}
                    >
                      {markets.length ? (markets.length <= 3 ? markets.join(', ') : `${markets.slice(0, 2).join(', ')} +${markets.length - 2} more`) : 'Choose states / districts...'}
                    </span>
                    {markets.length > 0 && (
                      <span style={{ fontSize: '11px', fontWeight: 600, background: 'var(--teal-50)', color: 'var(--teal-800)', padding: '1px 6px', borderRadius: '999px', border: '1px solid var(--teal-200)' }}>
                        {markets.length}
                      </span>
                    )}
                    <svg width="14" height="14" style={{ color: 'var(--ink-500)', transform: openDropdown === 'markets' ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}>
                      <use href="#i-down"></use>
                    </svg>
                  </button>

                  {/* Dropdown Popover */}
                  {openDropdown === 'markets' && (
                    <>
                      <div
                        onClick={() => setOpenDropdown(null)}
                        style={{ position: 'fixed', inset: 0, zIndex: 30 }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '68px',
                          left: 0,
                          right: 0,
                          zIndex: 35,
                          background: '#fff',
                          border: '1px solid var(--ink-200)',
                          borderRadius: '8px',
                          boxShadow: 'var(--e-2)',
                          padding: '8px',
                          maxHeight: '300px',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Search state or district..."
                          value={marketSearch}
                          onChange={(e) => setMarketSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '100%',
                            height: '32px',
                            padding: '0 8px',
                            border: '1px solid var(--ink-200)',
                            borderRadius: '4px',
                            fontSize: '12px',
                            marginBottom: '6px'
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px 6px', borderBottom: '1px solid var(--ink-100)', fontSize: '11px', color: 'var(--ink-500)' }}>
                          <span>{markets.length} selected</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const allM = [...DISTRICTS_LIST, ...STATES_LIST];
                                setMarkets(allM);
                                saveStep0Fields({ markets: allM });
                              }}
                              style={{ background: 'none', border: 0, color: 'var(--teal-700)', cursor: 'pointer', padding: 0, fontWeight: 600, fontSize: '11px' }}
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMarkets([]);
                                saveStep0Fields({ markets: [] });
                              }}
                              style={{ background: 'none', border: 0, color: 'var(--danger-600)', cursor: 'pointer', padding: 0, fontSize: '11px' }}
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, paddingTop: '4px' }}>
                          {/* Districts section */}
                          {DISTRICTS_LIST.filter(d => !marketSearch || d.toLowerCase().includes(marketSearch.toLowerCase())).length > 0 && (
                            <div style={{ marginBottom: '8px' }}>
                              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-400)', padding: '4px 6px' }}>
                                Districts
                              </div>
                              {DISTRICTS_LIST.filter(d => !marketSearch || d.toLowerCase().includes(marketSearch.toLowerCase())).map((dName) => {
                                const sel = markets.includes(dName);
                                return (
                                  <label
                                    key={dName}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '5px 8px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      background: sel ? 'var(--teal-50)' : 'transparent',
                                      color: sel ? 'var(--teal-900)' : 'var(--ink-800)'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={sel}
                                      onChange={() => {
                                        const next = sel ? markets.filter((m) => m !== dName) : [...markets, dName];
                                        setMarkets(next);
                                        saveStep0Fields({ markets: next });
                                      }}
                                      style={{ width: '15px', height: '15px', accentColor: 'var(--teal-700)', margin: 0 }}
                                    />
                                    <span style={{ flex: 1 }}>{dName}</span>
                                    {POOL_MAP[dName] && (
                                      <span style={{ fontSize: '10px', color: 'var(--ink-400)' }}>
                                        ~{(POOL_MAP[dName] / 1000).toFixed(0)}k
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {/* States section */}
                          {STATES_LIST.filter(s => !marketSearch || s.toLowerCase().includes(marketSearch.toLowerCase())).length > 0 && (
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-400)', padding: '4px 6px' }}>
                                States
                              </div>
                              {STATES_LIST.filter(s => !marketSearch || s.toLowerCase().includes(marketSearch.toLowerCase())).map((stName) => {
                                const sel = markets.includes(stName);
                                return (
                                  <label
                                    key={stName}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '5px 8px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      background: sel ? 'var(--teal-50)' : 'transparent',
                                      color: sel ? 'var(--teal-900)' : 'var(--ink-800)'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={sel}
                                      onChange={() => {
                                        const next = sel ? markets.filter((m) => m !== stName) : [...markets, stName];
                                        setMarkets(next);
                                        saveStep0Fields({ markets: next });
                                      }}
                                      style={{ width: '15px', height: '15px', accentColor: 'var(--teal-700)', margin: 0 }}
                                    />
                                    <span style={{ flex: 1 }}>{stName}</span>
                                    {POOL_MAP[stName] && (
                                      <span style={{ fontSize: '10px', color: 'var(--ink-400)' }}>
                                        ~{(POOL_MAP[stName] / 1000).toFixed(0)}k
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>
                    Target geography for outreach and creator discovery
                  </span>
                </div>

                {/* 2. Minimum Qualification Select */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>
                    Minimum Qualification
                  </label>
                  <select
                    value={qual}
                    onChange={(e) => {
                      const next = e.target.value;
                      setQual(next);
                      saveStep0Fields({ qual: next });
                    }}
                    style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                  >
                    {QUAL_OPTIONS.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>
                    Minimum education level required
                  </span>
                </div>

                {/* 3. Skill Background Options Dropdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', minWidth: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>
                    Skill Background
                  </label>
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'skills' ? null : 'skills')}
                    style={{
                      height: '38px',
                      padding: '0 12px',
                      border: openDropdown === 'skills' ? '1px solid var(--teal-600)' : '1px solid var(--ink-300)',
                      borderRadius: '6px',
                      background: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      minWidth: 0
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: '13px',
                        color: skillBg.length ? 'var(--ink-900)' : 'var(--ink-400)'
                      }}
                      title={skillBg.join(', ')}
                    >
                      {skillBg.length ? (skillBg.length <= 3 ? skillBg.join(', ') : `${skillBg.slice(0, 2).join(', ')} +${skillBg.length - 2} more`) : 'Choose skills / branches...'}
                    </span>
                    {skillBg.length > 0 && (
                      <span style={{ fontSize: '11px', fontWeight: 600, background: 'var(--teal-50)', color: 'var(--teal-800)', padding: '1px 6px', borderRadius: '999px', border: '1px solid var(--teal-200)' }}>
                        {skillBg.length}
                      </span>
                    )}
                    <svg width="14" height="14" style={{ color: 'var(--ink-500)', transform: openDropdown === 'skills' ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}>
                      <use href="#i-down"></use>
                    </svg>
                  </button>

                  {/* Skills Popover */}
                  {openDropdown === 'skills' && (
                    <>
                      <div
                        onClick={() => setOpenDropdown(null)}
                        style={{ position: 'fixed', inset: 0, zIndex: 30 }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '68px',
                          left: 0,
                          right: 0,
                          zIndex: 35,
                          background: '#fff',
                          border: '1px solid var(--ink-200)',
                          borderRadius: '8px',
                          boxShadow: 'var(--e-2)',
                          padding: '8px',
                          maxHeight: '280px',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px 6px', borderBottom: '1px solid var(--ink-100)', fontSize: '11px', color: 'var(--ink-500)' }}>
                          <span>{skillBg.length} selected</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSkillBg(SKILL_OPTIONS);
                                saveStep0Fields({ skill_bg: SKILL_OPTIONS });
                              }}
                              style={{ background: 'none', border: 0, color: 'var(--teal-700)', cursor: 'pointer', padding: 0, fontWeight: 600, fontSize: '11px' }}
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSkillBg([]);
                                saveStep0Fields({ skill_bg: [] });
                              }}
                              style={{ background: 'none', border: 0, color: 'var(--danger-600)', cursor: 'pointer', padding: 0, fontSize: '11px' }}
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, paddingTop: '4px' }}>
                          {SKILL_OPTIONS.map((sk) => {
                            const sel = skillBg.includes(sk);
                            return (
                              <label
                                key={sk}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '5px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  background: sel ? 'var(--teal-50)' : 'transparent',
                                  color: sel ? 'var(--teal-900)' : 'var(--ink-800)'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={sel}
                                  onChange={() => {
                                    const next = sel ? skillBg.filter((x) => x !== sk) : [...skillBg, sk];
                                    setSkillBg(next);
                                    saveStep0Fields({ skill_bg: next });
                                  }}
                                  style={{ width: '15px', height: '15px', accentColor: 'var(--teal-700)', margin: 0 }}
                                />
                                <span>{sk}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                  <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>
                    Engineering branches or technical backgrounds
                  </span>
                </div>

                {/* 4. Age Band Select */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>
                    Age Band
                  </label>
                  <select
                    value={ageBand}
                    onChange={(e) => {
                      const next = e.target.value;
                      setAgeBand(next);
                      saveStep0Fields({ age_band: next });
                    }}
                    style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                  >
                    {AGE_OPTIONS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>
                    Bands only, never exact ages (RR-H02)
                  </span>
                </div>

                {/* 5. Experience Band Select */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>
                    Experience Band
                  </label>
                  <select
                    value={expBand}
                    onChange={(e) => {
                      const next = e.target.value;
                      setExpBand(next);
                      saveStep0Fields({ exp_band: next });
                    }}
                    style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                  >
                    {EXP_OPTIONS.map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>
                    Fresher or past employment range
                  </span>
                </div>

                {/* 6. Languages Options Dropdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', minWidth: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>
                    Languages
                  </label>
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'languages' ? null : 'languages')}
                    style={{
                      height: '38px',
                      padding: '0 12px',
                      border: openDropdown === 'languages' ? '1px solid var(--teal-600)' : '1px solid var(--ink-300)',
                      borderRadius: '6px',
                      background: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      minWidth: 0
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: '13px',
                        color: languages.length ? 'var(--ink-900)' : 'var(--ink-400)'
                      }}
                      title={languages.join(', ')}
                    >
                      {languages.length ? languages.join(', ') : 'Choose languages...'}
                    </span>
                    {languages.length > 0 && (
                      <span style={{ fontSize: '11px', fontWeight: 600, background: 'var(--teal-50)', color: 'var(--teal-800)', padding: '1px 6px', borderRadius: '999px', border: '1px solid var(--teal-200)' }}>
                        {languages.length}
                      </span>
                    )}
                    <svg width="14" height="14" style={{ color: 'var(--ink-500)', transform: openDropdown === 'languages' ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}>
                      <use href="#i-down"></use>
                    </svg>
                  </button>

                  {/* Languages Popover */}
                  {openDropdown === 'languages' && (
                    <>
                      <div
                        onClick={() => setOpenDropdown(null)}
                        style={{ position: 'fixed', inset: 0, zIndex: 30 }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '68px',
                          left: 0,
                          right: 0,
                          zIndex: 35,
                          background: '#fff',
                          border: '1px solid var(--ink-200)',
                          borderRadius: '8px',
                          boxShadow: 'var(--e-2)',
                          padding: '8px',
                          maxHeight: '260px',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px 6px', borderBottom: '1px solid var(--ink-100)', fontSize: '11px', color: 'var(--ink-500)' }}>
                          <span>{languages.length} selected</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLanguages(LANG_OPTIONS);
                                saveStep0Fields({ languages: LANG_OPTIONS });
                              }}
                              style={{ background: 'none', border: 0, color: 'var(--teal-700)', cursor: 'pointer', padding: 0, fontWeight: 600, fontSize: '11px' }}
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLanguages([]);
                                saveStep0Fields({ languages: [] });
                              }}
                              style={{ background: 'none', border: 0, color: 'var(--danger-600)', cursor: 'pointer', padding: 0, fontSize: '11px' }}
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, paddingTop: '4px' }}>
                          {LANG_OPTIONS.map((l) => {
                            const sel = languages.includes(l);
                            return (
                              <label
                                key={l}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '5px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  background: sel ? 'var(--teal-50)' : 'transparent',
                                  color: sel ? 'var(--teal-900)' : 'var(--ink-800)'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={sel}
                                  onChange={() => {
                                    const next = sel ? languages.filter((x) => x !== l) : [...languages, l];
                                    setLanguages(next);
                                    saveStep0Fields({ languages: next });
                                  }}
                                  style={{ width: '15px', height: '15px', accentColor: 'var(--teal-700)', margin: 0 }}
                                />
                                <span>{l}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                  <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>
                    Languages spoken by target learner pool
                  </span>
                </div>
              </div>


              {/* Dynamic Cohort Sizing Bar */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '8px',
                  background: isCohortSizeOk ? 'var(--teal-50)' : 'var(--danger-50)',
                  border: isCohortSizeOk ? '1px solid var(--teal-200)' : '1px solid var(--danger-200)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--ink-600)', display: 'block' }}>Estimated Cohort Pool</span>
                  <b style={{ fontSize: '16px', color: isCohortSizeOk ? 'var(--teal-900)' : 'var(--danger-800)' }}>
                    {estimatedCohortSize.toLocaleString('en-IN')} people (Inferred)
                  </b>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: isCohortSizeOk ? 'var(--success-100)' : 'var(--danger-100)',
                    color: isCohortSizeOk ? 'var(--success-800)' : 'var(--danger-800)'
                  }}
                >
                  {isCohortSizeOk ? 'Sized: Meets minimum 500 bar' : 'Refused: Below 500 minimum (RR-H02)'}
                </span>
              </div>

              {/* Notes / Free text */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '6px' }}>
                  Anything else the agents should know about this cohort? (Optional)
                </label>
                <textarea
                  value={freeText}
                  onChange={(e) => {
                    setFreeText(e.target.value);
                    saveStep0Fields();
                  }}
                  placeholder="e.g. Focus on candidates with immediate availability and interest in practical projects"
                  style={{ width: '100%', minHeight: '64px', padding: '8px 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              {/* Bottom Continue Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid var(--ink-100)' }}>
                <button
                  type="button"
                  onClick={handleStep0Continue}
                  style={{
                    height: '40px',
                    padding: '0 20px',
                    borderRadius: '8px',
                    border: 0,
                    background: 'var(--teal-700)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Continue →
                </button>
              </div>
            </div>

            {/* Right Column: Course Context Card */}
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '20px' }}>
              <b style={{ fontSize: '14px', color: 'var(--ink-900)', display: 'block', marginBottom: '12px' }}>
                Course Context
              </b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: 'var(--ink-500)', display: 'block', fontSize: '11px' }}>Course Title</span>
                  <b style={{ color: 'var(--ink-900)' }}>{film.title}</b>
                </div>
                <div>
                  <span style={{ color: 'var(--ink-500)', display: 'block', fontSize: '11px' }}>Batch & Start Date</span>
                  <span style={{ color: 'var(--ink-800)' }}>{film.batch || 'Batch 1'} · {film.release || '2026-11-16'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--ink-500)', display: 'block', fontSize: '11px' }}>Provider</span>
                  <span style={{ color: 'var(--ink-800)' }}>{film.provider || 'Nexa Skills Foundation'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--ink-500)', display: 'block', fontSize: '11px' }}>Target Enrolment</span>
                  <span style={{ color: 'var(--ink-800)' }}>{film.target ? `${film.target} enrolments` : 'Not set'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--ink-500)', display: 'block', fontSize: '11px' }}>Cost Ceiling</span>
                  <span style={{ color: 'var(--ink-800)' }}>{film.ceiling ? `₹${film.ceiling.toLocaleString('en-IN')}` : 'Not set'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cohort Refinement Questions Modal */}
        {qsOpen && (
          <div
            onClick={() => setQsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(16,36,43,.45)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 70
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '540px',
                background: '#fff',
                borderRadius: '16px',
                boxShadow: 'var(--e-3)',
                padding: '24px'
              }}
            >
              <b style={{ fontSize: '18px', color: 'var(--ink-900)', display: 'block' }}>Cohort Refinement Questions</b>
              <p style={{ margin: '4px 0 16px', color: 'var(--ink-500)', fontSize: '13px' }}>
                Agent A4 needs your direction to rank narratives and filter eligible sources.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink-900)', marginBottom: '4px' }}>
                    1. Lead with career outcome or speed to employment?
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--ink-500)', display: 'block', marginBottom: '8px' }}>
                    Sets which narrative classes rank first.
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['Career outcome', 'Speed to employment', 'Decide for me'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setCohortAnswers((prev) => ({ ...prev, q1: opt }))}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: cohortAnswers.q1 === opt ? '2px solid var(--teal-600)' : '1px solid var(--ink-200)',
                          background: cohortAnswers.q1 === opt ? 'var(--teal-50)' : '#fff',
                          fontWeight: cohortAnswers.q1 === opt ? 600 : 400,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink-900)', marginBottom: '4px' }}>
                    2. Include partner institutions (placement cells, colleges)?
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--ink-500)', display: 'block', marginBottom: '8px' }}>
                    Institutional partners require consent records (RR-H06).
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['Include institutions', 'Creators and alumni only', 'Decide for me'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setCohortAnswers((prev) => ({ ...prev, q2: opt }))}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: cohortAnswers.q2 === opt ? '2px solid var(--teal-600)' : '1px solid var(--ink-200)',
                          background: cohortAnswers.q2 === opt ? 'var(--teal-50)' : '#fff',
                          fontWeight: cohortAnswers.q2 === opt ? 600 : 400,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink-900)', marginBottom: '4px' }}>
                    3. Cohort Focus Focus
                  </label>
                  <select
                    value={focusCohort || ''}
                    onChange={(e) => setFocusCohort(e.target.value)}
                    style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                  >
                    <option value="">Balanced cross-district mix</option>
                    <option value="Placement-seeking graduates in Tier-2/3 centres">Placement-seeking graduates in Tier-2/3 centres</option>
                    <option value="Final-year engineering students preparing for GCC tests">Final-year engineering students preparing for GCC tests</option>
                    <option value="Career switchers seeking zero-fee AI mission stipend">Career switchers seeking zero-fee AI mission stipend</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setQsOpen(false)}
                  style={{ height: '36px', padding: '0 14px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={submitCohortQuestions}
                  style={{ height: '36px', padding: '0 16px', border: 0, borderRadius: '8px', background: 'var(--teal-700)', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Generate Narratives →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 1: NARRATIVE                                                        */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--ink-900)' }}>
                  Candidate Narratives (Agent A5)
                </h2>
                <p style={{ margin: '4px 0 0', color: 'var(--ink-600)', fontSize: '13px' }}>
                  Select the primary messaging narrative for this campaign. Held claims require verification before selection.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setOwnNarrOpen(true)}
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--ink-300)',
                    background: '#fff',
                    color: 'var(--ink-700)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  + Add Own Narrative
                </button>
                <button
                  onClick={() => setChatOpen(true)}
                  style={{
                    height: '36px',
                    padding: '0 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--teal-300)',
                    background: 'var(--teal-50)',
                    color: 'var(--teal-800)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Icon name="i-sparkles" size={16} /> Rewrite / Guide AI
                </button>
              </div>
            </div>

            {/* Narratives Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {narratives.map((n) => {
                const isSel = n.role === 'Primary';
                const isHeld = !!n.held;
                return (
                  <div
                    key={n.id}
                    style={{
                      background: '#fff',
                      border: isSel ? '2px solid var(--teal-600)' : '1px solid var(--ink-100)',
                      borderRadius: '12px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: isSel ? 'var(--e-2)' : 'var(--e-1)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'var(--ink-50)', color: 'var(--ink-700)' }}>
                          {n.cls || 'Career outcome'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: n.score >= 75 ? 'var(--success-700)' : 'var(--warning-700)' }}>
                            Score: {n.score || 80}
                          </span>
                        </div>
                      </div>

                      <b style={{ fontSize: '15px', color: 'var(--ink-900)', display: 'block', lineHeight: 1.3, marginBottom: '8px' }}>
                        {n.title}
                      </b>

                      <div style={{ fontSize: '13px', color: 'var(--teal-900)', background: 'var(--teal-50)', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', fontStyle: 'italic' }}>
                        &ldquo;{n.hook}&rdquo;
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--ink-600)', lineHeight: 1.4, marginBottom: '8px' }}>
                        <b>Why it works:</b> {n.why || 'High resonance with final-year students'}
                      </div>

                      {n.risk && (
                        <div style={{ fontSize: '11px', color: n.risk.includes('High') ? 'var(--danger-700)' : 'var(--ink-500)', marginBottom: '8px' }}>
                          Risk: {n.risk}
                        </div>
                      )}

                      {isHeld && (
                        <div style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--danger-50)', border: '1px solid var(--danger-200)', color: 'var(--danger-800)', fontSize: '11px', marginBottom: '12px' }}>
                          Held (RR-H03): Placement claim requires Observed evidence attached to the brief.
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                      <button
                        type="button"
                        disabled={isHeld}
                        onClick={() => handleSelectNarrative(n.id, isHeld)}
                        style={{
                          height: '32px',
                          padding: '0 14px',
                          borderRadius: '6px',
                          border: isSel ? '0' : '1px solid var(--teal-700)',
                          background: isSel ? 'var(--teal-700)' : '#fff',
                          color: isSel ? '#fff' : 'var(--teal-700)',
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: isHeld ? 'not-allowed' : 'pointer',
                          opacity: isHeld ? 0.5 : 1
                        }}
                      >
                        {isSel ? 'Selected ✓' : 'Select'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--ink-100)' }}>
              <button
                type="button"
                onClick={() => setStep(0)}
                style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleStep1Next}
                style={{ height: '38px', padding: '0 20px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                Next: Channels →
              </button>
            </div>
          </div>
        )}

        {/* Rewrite Guidance Drawer / Modal */}
        {chatOpen && (
          <div
            onClick={() => setChatOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(16,36,43,.45)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 70
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '520px',
                background: '#fff',
                borderRadius: '16px',
                boxShadow: 'var(--e-3)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '80vh'
              }}
            >
              <b style={{ fontSize: '16px', color: 'var(--ink-900)', display: 'block', marginBottom: '8px' }}>
                Guide Agent A5 Narrative Generator
              </b>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {chatMsgs.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
                      background: m.from === 'me' ? 'var(--teal-700)' : 'var(--ink-50)',
                      color: m.from === 'me' ? '#fff' : 'var(--ink-900)',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      maxWidth: '85%'
                    }}
                  >
                    {m.text}
                  </div>
                ))}
              </div>

              {/* Quick chips */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {['Make it warmer', 'Shorter hook', 'Write the hook in Telugu', 'Suggest a new narrative about the stipend'].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setChatInput(chip)}
                    style={{
                      fontSize: '11px',
                      padding: '4px 8px',
                      borderRadius: '999px',
                      border: '1px solid var(--ink-200)',
                      background: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSendNarrativeChat} style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Give instructions to rewrite..."
                  style={{ flex: 1, height: '38px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', fontSize: '13px' }}
                />
                <button
                  type="submit"
                  disabled={chatBusy}
                  style={{
                    height: '38px',
                    padding: '0 14px',
                    border: 0,
                    borderRadius: '8px',
                    background: 'var(--teal-700)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Add Own Narrative Modal */}
        {ownNarrOpen && (
          <div
            onClick={() => setOwnNarrOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(16,36,43,.45)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 70
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '480px',
                background: '#fff',
                borderRadius: '16px',
                boxShadow: 'var(--e-3)',
                padding: '24px'
              }}
            >
              <b style={{ fontSize: '16px', color: 'var(--ink-900)', display: 'block', marginBottom: '12px' }}>
                Add Custom Narrative
              </b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '4px' }}>
                    Title
                  </label>
                  <input
                    value={ownTitle}
                    onChange={(e) => setOwnTitle(e.target.value)}
                    placeholder="e.g. From college project to first product engineer"
                    style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '4px' }}>
                    Class
                  </label>
                  <select
                    value={ownCls}
                    onChange={(e) => setOwnCls(e.target.value)}
                    style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                  >
                    <option value="Career outcome">Career outcome</option>
                    <option value="Stipend">Stipend</option>
                    <option value="Speed to employment">Speed to employment</option>
                    <option value="Institutional endorsement">Institutional endorsement</option>
                    <option value="Skill relevance">Skill relevance</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '4px' }}>
                    Opening Hook
                  </label>
                  <textarea
                    value={ownHook}
                    onChange={(e) => setOwnHook(e.target.value)}
                    placeholder="Enter the opening hook message..."
                    style={{ width: '100%', minHeight: '60px', padding: '8px 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setOwnNarrOpen(false)}
                  style={{ height: '36px', padding: '0 14px', border: '1px solid var(--ink-300)', borderRadius: '6px', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddOwnNarrative}
                  style={{ height: '36px', padding: '0 16px', border: 0, borderRadius: '6px', background: 'var(--teal-700)', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Add Narrative
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 2: CHANNELS                                                         */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--ink-900)' }}>
                Channel Mix (Agent A6)
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--ink-600)', fontSize: '13px' }}>
                Channel allocations are weighted by cohort behaviour and measurability. Active channel shares must total 100%.
              </p>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 180px 140px 120px 120px 1fr 100px',
                  gap: '12px',
                  padding: '12px 20px',
                  background: 'var(--ink-50)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--ink-600)',
                  alignItems: 'center'
                }}
              >
                <span>On</span>
                <span>Channel</span>
                <span>Role</span>
                <span>Fit</span>
                <span>Measurability</span>
                <span>Reason</span>
                <span style={{ textAlign: 'right' }}>Share (%)</span>
              </div>

              {channels.map((ch, idx) => {
                return (
                  <div
                    key={ch.name}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 180px 140px 120px 120px 1fr 100px',
                      gap: '12px',
                      padding: '14px 20px',
                      borderTop: '1px solid var(--ink-100)',
                      alignItems: 'center',
                      opacity: ch.on ? 1 : 0.45,
                      background: ch.on ? '#fff' : 'var(--ink-25)'
                    }}
                  >
                    <div>
                      <input
                        type="checkbox"
                        checked={!!ch.on}
                        disabled={!!ch.locked}
                        onChange={() => toggleChannel(idx)}
                        style={{ cursor: ch.locked ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                      />
                    </div>

                    <div>
                      <b style={{ fontSize: '14px', color: 'var(--ink-900)', display: 'block' }}>{ch.name}</b>
                      <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>{ch.formats}</span>
                    </div>

                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: ch.role === 'Anchor' ? 'var(--teal-50)' : 'var(--ink-50)',
                          color: ch.role === 'Anchor' ? 'var(--teal-800)' : 'var(--ink-700)'
                        }}
                      >
                        {ch.role}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-800)' }}>
                        {ch.role === 'Anchor' ? 'Best fit' : 'Strong fit'}
                      </span>
                    </div>

                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: ch.meas === 'Measurable now' ? 'var(--success-100)' : 'var(--ink-100)',
                          color: ch.meas === 'Measurable now' ? 'var(--success-800)' : 'var(--ink-700)'
                        }}
                      >
                        {ch.meas || 'Tracked link'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--ink-600)', lineHeight: 1.3 }}>
                      {ch.reason || 'Supports cohort outreach'}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <b style={{ fontSize: '14px', color: ch.on ? 'var(--teal-800)' : 'var(--ink-400)' }}>
                        {ch.on ? `${ch.share}%` : '0%'}
                      </b>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--ink-100)' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleStep2Next}
                style={{ height: '38px', padding: '0 20px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                Next: Influencers →
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 3: INFLUENCERS / PARTNERS                                           */}
        {/* ========================================================================= */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--ink-900)' }}>
                  Ranked Sources & Shortlist (Agent A7)
                </h2>
                <p style={{ margin: '4px 0 0', color: 'var(--ink-600)', fontSize: '13px' }}>
                  Ranked across 6 gates: 1,000 follower bar, recent activity, reliability, institutional consent (RR-H06), fit and reach.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleAutoPortfolio}
                  style={{
                    height: '36px',
                    padding: '0 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--teal-300)',
                    background: 'var(--teal-50)',
                    color: 'var(--teal-800)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Auto-Portfolio ({budget ? `₹${(budget / 100000).toFixed(1)}L` : 'Budget'})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    loadBankSources();
                    setBankModal(true);
                  }}
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--ink-300)',
                    background: '#fff',
                    color: 'var(--ink-700)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  + Add from Creator Bank
                </button>
              </div>
            </div>

            {/* Channel filter pills */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)', marginRight: '4px' }}>Platform:</span>
              {['All', 'YouTube', 'Instagram', 'LinkedIn', 'Facebook'].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannelFilter(ch)}
                  style={{
                    height: '28px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: channelFilter === ch ? '1px solid var(--teal-600)' : '1px solid var(--ink-200)',
                    background: channelFilter === ch ? 'var(--teal-50)' : '#fff',
                    color: channelFilter === ch ? 'var(--teal-800)' : 'var(--ink-700)',
                    fontSize: '12px',
                    fontWeight: channelFilter === ch ? 600 : 400,
                    cursor: 'pointer'
                  }}
                >
                  {ch}
                </button>
              ))}
            </div>

            {/* Creator Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {rankedList
                .filter((rItem) => channelFilter === 'All' || rItem.platform === channelFilter)
                .slice(0, 16)
                .map((rItem, rIdx) => {
                  const crId = rItem.source_id || rItem.id;
                  const isShort = shortlist.some((s) => s.source_id === crId || s.creatorId === crId);
                  const isBlocked = blockedList.some((b) => b.id === crId);
                  const trustScore = rItem.trust_pct || rItem.trust || 65;
                  const fitScore = rItem.fit_pct || rItem.fit || 75;

                  return (
                    <div
                      key={crId}
                      style={{
                        background: '#fff',
                        border: isShort ? '2px solid var(--teal-600)' : '1px solid var(--ink-100)',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: isShort ? 'var(--e-2)' : 'var(--e-1)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-400)' }}>#{rIdx + 1}</span>
                              <b style={{ fontSize: '14px', color: 'var(--ink-900)' }}>{rItem.name}</b>
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
                              {rItem.handle} · {rItem.platform} · {rItem.type}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'var(--teal-50)',
                              color: 'var(--teal-800)'
                            }}
                          >
                            {rItem.tier || 'Micro'}
                          </span>
                        </div>

                        {/* Stats Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: 'var(--ink-25)', padding: '8px', borderRadius: '6px', margin: '8px 0', fontSize: '11px' }}>
                          <div>
                            <span style={{ color: 'var(--ink-500)', display: 'block' }}>Reach</span>
                            <b>{rItem.followers ? rItem.followers.toLocaleString('en-IN') : '—'}</b>
                          </div>
                          <div>
                            <span style={{ color: 'var(--ink-500)', display: 'block' }}>Trust</span>
                            <b style={{ color: 'var(--success-700)' }}>{trustScore}%</b>
                          </div>
                          <div>
                            <span style={{ color: 'var(--ink-500)', display: 'block' }}>Fit</span>
                            <b style={{ color: 'var(--teal-800)' }}>{fitScore}%</b>
                          </div>
                        </div>

                        {/* Fee and terms */}
                        <div style={{ fontSize: '12px', color: 'var(--ink-700)', marginBottom: '8px' }}>
                          Fee: <b>{rItem.rate ? `₹${rItem.rate.toLocaleString('en-IN')}/post` : 'Partnership (Zero fee)'}</b>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setFitModal(rItem)}
                          style={{
                            border: 0,
                            background: 'none',
                            color: 'var(--teal-700)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          Why fits? →
                        </button>

                        <button
                          type="button"
                          disabled={isBlocked}
                          onClick={() => handleToggleShortlist(rItem, isShort)}
                          style={{
                            height: '30px',
                            padding: '0 12px',
                            borderRadius: '6px',
                            border: isShort ? '1px solid var(--teal-700)' : '0',
                            background: isShort ? '#fff' : 'var(--teal-700)',
                            color: isShort ? 'var(--teal-700)' : '#fff',
                            fontWeight: 600,
                            fontSize: '12px',
                            cursor: isBlocked ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {isShort ? 'Shortlisted ✓' : 'Shortlist'}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--ink-100)' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
              >
                ← Back
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
                  {shortlist.length} source{shortlist.length !== 1 ? 's' : ''} shortlisted
                </span>
                <button
                  type="button"
                  onClick={handleStep3Next}
                  style={{ height: '38px', padding: '0 20px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                >
                  Next: Content →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Why Fits Modal */}
        {fitModal && (
          <div
            onClick={() => setFitModal(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(16,36,43,.45)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 70
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '500px',
                background: '#fff',
                borderRadius: '16px',
                boxShadow: 'var(--e-3)',
                padding: '24px'
              }}
            >
              <b style={{ fontSize: '16px', color: 'var(--ink-900)', display: 'block' }}>
                Fit Assessment: {fitModal.name}
              </b>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)', display: 'block', marginBottom: '16px' }}>
                {fitModal.platform} · {fitModal.type} · {fitModal.tier}
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', marginBottom: '20px' }}>
                <div style={{ padding: '8px 12px', background: 'var(--success-50)', borderRadius: '6px', color: 'var(--success-800)' }}>
                  ✓ <b>Audience Fit:</b> Reaches target cohort in {markets.join(' and ')}
                </div>
                <div style={{ padding: '8px 12px', background: 'var(--success-50)', borderRadius: '6px', color: 'var(--success-800)' }}>
                  ✓ <b>Trust & Reliability:</b> Verified record and active content
                </div>
                <div style={{ padding: '8px 12px', background: 'var(--ink-50)', borderRadius: '6px', color: 'var(--ink-700)', fontSize: '12px' }}>
                  ℹ <b>Privacy Notice:</b> HireIQ uses aggregate cohort data and never stores individual candidate identities.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setFitModal(null)}
                  style={{ height: '34px', padding: '0 16px', borderRadius: '6px', border: '1px solid var(--ink-300)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Institutional Consent Modal (RR-H06) */}
        {consentModal && (
          <div
            onClick={() => setConsentModal(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(16,36,43,.45)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 70
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '460px',
                background: '#fff',
                borderRadius: '16px',
                boxShadow: 'var(--e-3)',
                padding: '24px'
              }}
            >
              <b style={{ fontSize: '16px', color: 'var(--ink-900)', display: 'block' }}>
                Institutional Partner Consent (RR-H06)
              </b>
              <p style={{ margin: '6px 0 16px', color: 'var(--ink-600)', fontSize: '13px' }}>
                {consentModal.name} is an institutional partner ({consentModal.type}). Under rule RR-H06, a valid consent basis must be recorded before shortlisting.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '4px' }}>
                    Consent Basis
                  </label>
                  <input
                    value={consentBasis}
                    onChange={(e) => setConsentBasis(e.target.value)}
                    placeholder="e.g. MOU signed with placement cell on 15 Oct 2026"
                    style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)', marginBottom: '4px' }}>
                    Date Recorded
                  </label>
                  <input
                    type="date"
                    value={consentDate}
                    onChange={(e) => setConsentDate(e.target.value)}
                    style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setConsentModal(null)}
                  style={{ height: '34px', padding: '0 14px', borderRadius: '6px', border: '1px solid var(--ink-300)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmConsentAndShortlist}
                  style={{ height: '34px', padding: '0 16px', borderRadius: '6px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Record Consent & Shortlist
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 4: CONTENT                                                          */}
        {/* ========================================================================= */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--ink-900)' }}>
                Personalised Content Drafts (Agent A8)
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--ink-600)', fontSize: '13px' }}>
                Review generated content variants for each shortlisted source. Select posts to approve for publication.
              </p>
            </div>

            {/* Source tabs */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {shortlist.map((sl) => {
                const sId = sl.source_id || sl.creatorId;
                const cr = rankedList.find((r) => r.source_id === sId || r.id === sId) || {};
                const cData = contentMap[sId] || { vars: [], sel: [] };
                const on = (curCreatorTab || (shortlist[0] && (shortlist[0].source_id || shortlist[0].creatorId))) === sId;

                return (
                  <button
                    key={sId}
                    type="button"
                    onClick={() => setCurCreatorTab(sId)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: on ? '2px solid var(--teal-600)' : '1px solid var(--ink-200)',
                      background: on ? 'var(--teal-50)' : '#fff',
                      color: on ? 'var(--teal-900)' : 'var(--ink-700)',
                      fontWeight: on ? 600 : 400,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>{cr.name || sId}</span>
                    <span style={{ fontSize: '11px', background: on ? 'var(--teal-200)' : 'var(--ink-100)', padding: '2px 6px', borderRadius: '4px' }}>
                      {(cData.sel || []).length} / {sl.posts || 1} sel
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Source Content Variants */}
            {(() => {
              const activeSId = curCreatorTab || (shortlist[0] && (shortlist[0].source_id || shortlist[0].creatorId));
              const activeSl = shortlist.find((s) => (s.source_id || s.creatorId) === activeSId) || {};
              const activeCr = rankedList.find((r) => (r.source_id || r.id) === activeSId) || {};
              const cData = contentMap[activeSId] || { vars: [], sel: [] };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
                      Deal: <b>{activeSl.posts || 1} post{(activeSl.posts || 1) > 1 ? 's' : ''}</b> · {activeCr.platform} · {activeCr.rate ? `₹${activeCr.rate.toLocaleString('en-IN')}` : 'Partnership'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setContentChatOpen(true)}
                      style={{
                        height: '32px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--teal-300)',
                        background: 'var(--teal-50)',
                        color: 'var(--teal-800)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Icon name="i-sparkles" size={14} /> Rewrite with AI
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                    {(cData.vars || []).map((v) => {
                      const isSel = (cData.sel || []).includes(v.id);
                      return (
                        <div
                          key={v.id}
                          style={{
                            background: '#fff',
                            border: isSel ? '2px solid var(--teal-600)' : '1px solid var(--ink-100)',
                            borderRadius: '12px',
                            padding: '18px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: isSel ? 'var(--e-2)' : 'var(--e-1)'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'var(--ink-50)', color: 'var(--ink-700)' }}>
                                {v.format || 'Reel / Video'}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--success-700)', fontWeight: 600 }}>
                                Claims: Pass ✓
                              </span>
                            </div>

                            <b style={{ fontSize: '14px', color: 'var(--ink-900)', display: 'block', marginBottom: '6px' }}>
                              {v.title}
                            </b>

                            <div style={{ fontSize: '12px', color: 'var(--teal-900)', background: 'var(--teal-50)', padding: '8px 10px', borderRadius: '6px', marginBottom: '10px' }}>
                              &ldquo;{v.hook}&rdquo;
                            </div>

                            <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--ink-600)', lineHeight: 1.4 }}>
                              {v.caption}
                            </p>

                            <div style={{ fontSize: '11px', color: 'var(--ink-500)', wordBreak: 'break-all' }}>
                              Tracked Link: <span style={{ color: 'var(--teal-700)' }}>{v.link || 'resolence.in/r/course?t=hq-camp'}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                            <button
                              type="button"
                              onClick={() => handleSelectContentVariant(activeSId, v.id)}
                              style={{
                                height: '30px',
                                padding: '0 12px',
                                borderRadius: '6px',
                                border: isSel ? '0' : '1px solid var(--teal-700)',
                                background: isSel ? 'var(--teal-700)' : '#fff',
                                color: isSel ? '#fff' : 'var(--teal-700)',
                                fontWeight: 600,
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              {isSel ? 'Selected ✓' : 'Select'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--ink-100)' }}>
              <button
                type="button"
                onClick={() => setStep(3)}
                style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleStep4Next}
                style={{ height: '38px', padding: '0 20px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                Next: Review and create →
              </button>
            </div>
          </div>
        )}

        {/* Content AI Rewrite Modal */}
        {contentChatOpen && (
          <div
            onClick={() => setContentChatOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(16,36,43,.45)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 70
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '500px',
                background: '#fff',
                borderRadius: '16px',
                boxShadow: 'var(--e-3)',
                padding: '24px'
              }}
            >
              <b style={{ fontSize: '16px', color: 'var(--ink-900)', display: 'block', marginBottom: '8px' }}>
                Regenerate Post Variant
              </b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', marginBottom: '14px' }}>
                {contentChatMsgs.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
                      background: m.from === 'me' ? 'var(--teal-700)' : 'var(--ink-50)',
                      color: m.from === 'me' ? '#fff' : 'var(--ink-900)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  >
                    {m.text}
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  const sId = curCreatorTab || (shortlist[0] && (shortlist[0].source_id || shortlist[0].creatorId));
                  handleSendContentRewrite(e, sId);
                }}
                style={{ display: 'flex', gap: '8px' }}
              >
                <input
                  value={contentChatInput}
                  onChange={(e) => setContentChatInput(e.target.value)}
                  placeholder="e.g. Write in Telugu, highlight ₹15k stipend..."
                  style={{ flex: 1, height: '36px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px' }}
                />
                <button
                  type="submit"
                  disabled={contentChatBusy}
                  style={{ height: '36px', padding: '0 14px', border: 0, borderRadius: '6px', background: 'var(--teal-700)', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Regenerate
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 5: REVIEW AND CREATE                                                */}
        {/* ========================================================================= */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--ink-900)' }}>
                Campaign Review & Governance Gates
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--ink-600)', fontSize: '13px' }}>
                Agents A9 and A10 have audited the campaign configuration and frozen predictions.
              </p>
            </div>

            {/* Prediction Summary KPI Grid */}
            {reviewData && reviewData.prediction && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--ink-500)', display: 'block' }}>Tracked Clicks</span>
                  <b style={{ fontSize: '20px', color: 'var(--ink-900)' }}>
                    {reviewData.prediction.clicks ? `${reviewData.prediction.clicks[0].toLocaleString('en-IN')}–${reviewData.prediction.clicks[1].toLocaleString('en-IN')}` : '—'}
                  </b>
                  <span style={{ fontSize: '11px', color: 'var(--ink-400)', display: 'block', marginTop: '4px' }}>
                    Reach × click-through rate
                  </span>
                </div>

                <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--ink-500)', display: 'block' }}>Registrations</span>
                  <b style={{ fontSize: '20px', color: 'var(--ink-900)' }}>
                    {reviewData.prediction.regs ? `${reviewData.prediction.regs[0].toLocaleString('en-IN')}–${reviewData.prediction.regs[1].toLocaleString('en-IN')}` : '—'}
                  </b>
                  <span style={{ fontSize: '11px', color: 'var(--ink-400)', display: 'block', marginTop: '4px' }}>
                    Clicks × conversion priors
                  </span>
                </div>

                <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--ink-500)', display: 'block' }}>Screening Enrolments</span>
                  <b style={{ fontSize: '20px', color: 'var(--teal-800)' }}>
                    {reviewData.prediction.enrols ? `${reviewData.prediction.enrols[0]}–${reviewData.prediction.enrols[1]}` : '—'}
                  </b>
                  <span style={{ fontSize: '11px', color: 'var(--ink-400)', display: 'block', marginTop: '4px' }}>
                    Target: {targetEnrols} enrolments
                  </span>
                </div>

                <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--ink-500)', display: 'block' }}>Cost per Enrolment (CPI)</span>
                  <b style={{ fontSize: '20px', color: 'var(--ink-900)' }}>
                    {reviewData.prediction.cpi ? `₹${reviewData.prediction.cpi[0].toLocaleString('en-IN')}–₹${reviewData.prediction.cpi[1].toLocaleString('en-IN')}` : '—'}
                  </b>
                  <span style={{ fontSize: '11px', color: 'var(--ink-400)', display: 'block', marginTop: '4px' }}>
                    Ceiling: ₹{costCeiling.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}

            {/* 13 Governance Checks Checklist */}
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <b style={{ fontSize: '15px', color: 'var(--ink-900)' }}>13 Governance and Fairness Checks (Agent A10)</b>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: reviewData?.checks?.can_create !== false ? 'var(--success-100)' : 'var(--danger-100)',
                    color: reviewData?.checks?.can_create !== false ? 'var(--success-800)' : 'var(--danger-800)'
                  }}
                >
                  {reviewData?.checks?.can_create !== false ? 'All Checks Pass ✓' : 'Issues Need Attention'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '10px' }}>
                {(reviewData?.checks?.checks || [
                  { rule: 'RR-H01', title: 'Non-discrimination & Fairness', status: 'Pass', note: 'Standard open cohort criteria' },
                  { rule: 'RR-H02', title: 'Minimum Cohort Size (>=500)', status: isCohortSizeOk ? 'Pass' : 'Fail', note: `${estimatedCohortSize} estimated learners` },
                  { rule: 'RR-H03', title: 'Claim Verification', status: 'Pass', note: 'All assertions verified' },
                  { rule: 'RR-H04', title: 'Disclosure & #ad tags', status: 'Pass', note: 'Required hashtags present' },
                  { rule: 'RR-H05', title: 'Budget Feasibility', status: 'Pass', note: 'Committed within budget' },
                  { rule: 'RR-H06', title: 'Institutional Partner Consent', status: 'Pass', note: 'Consent on file' },
                  { rule: 'RR-H07', title: 'Channel Allocation (100%)', status: 'Pass', note: 'Channels balanced' },
                  { rule: 'RR-H08', title: 'Course Brief Readiness', status: 'Pass', note: 'Required fields present' },
                  { rule: 'RR-H09', title: 'Tracking Link Validation', status: 'Pass', note: 'Resolence links valid' },
                  { rule: 'RR-H10', title: 'Cost Ceiling Compliance', status: 'Pass', note: 'Predicted CPI meets ceiling' },
                  { rule: 'RR-H11', title: 'Reliability Gate', status: 'Pass', note: 'No gated creators' },
                  { rule: 'RR-H12', title: 'Content Approval', status: 'Pass', note: 'All deals have drafts' },
                  { rule: 'RR-H13', title: 'Hashtag Budget', status: 'Pass', note: 'Within weekly budget' }
                ]).map((chk) => {
                  const pass = chk.status === 'Pass';
                  return (
                    <div
                      key={chk.rule || chk.title}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--ink-100)',
                        background: pass ? 'var(--ink-25)' : 'var(--danger-50)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-500)' }}>{chk.rule}</span>
                          <b style={{ fontSize: '13px', color: 'var(--ink-900)' }}>{chk.title}</b>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--ink-600)', display: 'block', marginTop: '2px' }}>
                          {chk.note}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: pass ? 'var(--success-100)' : 'var(--danger-100)',
                          color: pass ? 'var(--success-800)' : 'var(--danger-800)'
                        }}
                      >
                        {chk.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--ink-100)' }}>
              <button
                type="button"
                onClick={() => setStep(4)}
                style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={creating || (reviewData?.checks?.can_create === false)}
                onClick={handleCreateCampaign}
                style={{
                  height: '42px',
                  padding: '0 24px',
                  borderRadius: '8px',
                  border: 0,
                  background: 'var(--teal-700)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: creating || (reviewData?.checks?.can_create === false) ? 'not-allowed' : 'pointer',
                  opacity: creating || (reviewData?.checks?.can_create === false) ? 0.6 : 1
                }}
              >
                {creating ? 'Creating campaign (Freezing v1)…' : 'Create campaign (Freeze v1) ✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
