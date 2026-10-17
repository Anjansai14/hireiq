/**
 * Hire IQ core data store, models, and calculation engine.
 * Extracted and reconstructed from the original Influence IQ prototype (hire-data.js).
 */

const KEY = 'iq_hireiq_v2';
export const TODAY = '2026-10-06';

function rng(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _u = 5000;
export const uid = (p) => (p || 'x') + ++_u + Math.floor(Math.random() * 1e4);

export const addDays = (d, n) => {
  const x = new Date(d + 'T12:00:00');
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

export const daysBetween = (a, b) =>
  Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);

export const STATUSES = [
  'Identified',
  'Approached',
  'Negotiating',
  'Confirmed',
  'Content in review',
  'Live',
  'Delivered',
  'Declined',
  'Backed out'
];

export const COMMITTED = ['Confirmed', 'Content in review', 'Live', 'Delivered'];

export const SOURCE_TYPES = [
  'Micro-influencer',
  'College network',
  'Placement cell',
  'Alumnus',
  'Trainer or mentor',
  'Community leader',
  'Digital creator'
];

export const INSTITUTIONAL = ['College network', 'Placement cell'];

export const SKILLS = [
  'AI/ML',
  'Data engineering',
  'Software development',
  'Career guidance',
  'Placements',
  'Manufacturing',
  'Interview prep'
];

export const STATES = [
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

export const STATE_POOL = {
  Telangana: ['Warangal', 'Hyderabad', 'Nalgonda', 'Khammam', 'Karimnagar'],
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai'],
  Maharashtra: ['Pune', 'Nagpur', 'Nashik', 'Mumbai']
};

export const mkShare = (st) =>
  st === 'Telangana'
    ? { Hyderabad: 0.55, Warangal: 0.22, Karimnagar: 0.1, Nalgonda: 0.08, Khammam: 0.05 }
    : { Capital: 0.6, Regional: 0.4 };

export const isInst = (cr) => !!cr && INSTITUTIONAL.includes(cr.type);

export const n = (x) => {
  if (x == null || Number.isNaN(x)) return '—';
  const a = Math.abs(x);
  if (a >= 1e6) return (x / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (a >= 1e3) return (x / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(x));
};

export const inr = (x) => {
  if (x == null || Number.isNaN(x)) return '—';
  return '₹' + Math.round(x).toLocaleString('en-IN');
};

export const inrL = (x) => {
  if (x == null || Number.isNaN(x)) return '—';
  if (x >= 1e7) return '₹' + (x / 1e7).toFixed(2).replace(/\.?0+$/, '') + 'Cr';
  if (x >= 1e5) return '₹' + (x / 1e5).toFixed(1).replace(/\.0$/, '') + 'L';
  if (x >= 1e3) return '₹' + (x / 1e3).toFixed(0) + 'K';
  return '₹' + Math.round(x).toLocaleString('en-IN');
};

const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const d = (s) => {
  if (!s) return '—';
  const p = s.slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${+p[2]} ${MO[+p[1] - 1]} ${p[0]}`;
};

export const ds = (s) => {
  if (!s) return '—';
  const p = s.slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${+p[2]} ${MO[+p[1] - 1]}`;
};

export const dt = (s) => {
  if (!s) return '—';
  const [date, time] = s.split('T');
  return `${ds(date)}${time ? ' · ' + time.slice(0, 5) : ''}`;
};

export const tone = (t) => {
  switch (t) {
    case 'Ahead':
    case 'Pass':
    case 'OK':
    case 'Connected':
    case 'Live':
    case 'Delivered':
    case 'High':
    case 'Verified':
    case 'Observed':
    case 'Enriched':
      return { bg: 'var(--success-100)', fg: 'var(--success-800)', border: '#BFE3CE' };
    case 'Warning':
    case 'Review':
    case 'Behind':
    case 'Expiring':
    case 'Partial':
    case 'Stale':
    case 'Medium':
    case 'Awaiting evidence':
    case 'Content in review':
    case 'Negotiating':
    case 'Approached':
    case 'Illustrative':
      return { bg: 'var(--warning-100)', fg: 'var(--warning-800)', border: '#F6E3B4' };
    case 'Fail':
    case 'Refused':
    case 'Failed':
    case 'Declined':
    case 'Backed out':
    case 'Disconnected':
    case 'Critical':
      return { bg: 'var(--danger-100)', fg: 'var(--danger-800)', border: '#F2C6BF' };
    default:
      return { bg: 'var(--ink-50)', fg: 'var(--ink-700)', border: 'var(--ink-200)' };
  }
};

export function createInitialState() {
  return {
    v: 2,
    user: null,
    module: 'hire',
    route: { name: 'dashboard' },
    filmId: 'f1',
    films: [
      {
        id: 'f1',
        title: 'Applied AI & ML Programme',
        language: 'Telugu',
        batch: 'Batch 4',
        release: '2026-11-16',
        provider: 'Nexa Skills Foundation',
        brief: {
          courseName: 'Applied AI & ML Programme',
          courseLink: 'nexaskills.org/applied-ai',
          domain: 'AI/ML',
          level: 'Intermediate',
          eligibility: 'B.Tech/B.E. or MCA, graduated 2022–2026, 60% aggregate',
          stipend: '₹15,000/month during 8-week capstone',
          fee: 'Zero tuition fees (state-sponsored cohort)',
          mode: 'Hybrid (3 days in centre, Hyderabad or Warangal)',
          duration: '16 weeks (8 weeks foundation + 8 weeks capstone)',
          targetAudience: 'Engineering graduates in tier-2/3 districts seeking data or AI career entry',
          intakeTarget: '300',
          costCeiling: '4500',
          budget: '1800000',
          selectionProcess: 'Aptitude screening test, coding interview',
          certifyingBody: 'Telangana Academy for Skill and Knowledge (TASK) co-certification',
          careerRoles: 'Junior ML Engineer, Data Associate, AI Operations Specialist',
          hiringPartners: '22 regional GCCs and mid-tier IT services companies',
          src: {
            courseName: 'syllabus.pdf',
            courseLink: 'nexaskills.org/applied-ai',
            domain: 'syllabus.pdf',
            level: 'syllabus.pdf',
            eligibility: 'brochure.pdf',
            stipend: 'brochure.pdf',
            fee: 'brochure.pdf',
            mode: 'brochure.pdf',
            duration: 'syllabus.pdf'
          }
        },
        flags: [
          { rule: 'RR-H03', type: 'Outcome claims', status: 'Under review', note: '85% placement stat cited without cohort report' },
          { rule: 'RR-H06', type: 'Institution endorsement', status: 'Cleared', note: 'TASK co-certification MoU verified' },
          { rule: 'RR-H04', type: 'Paid promotion', status: 'Cleared', note: 'All commercial terms include #ad disclosure requirement' }
        ],
        claims: [
          { id: 'cl1', text: '85% placement rate', status: 'Awaiting evidence', note: 'Needs batch 1–3 report attached before narrative release' }
        ]
      },
      {
        id: 'f2',
        title: 'Advanced Manufacturing Technician',
        language: 'Telugu',
        batch: 'Batch 1',
        release: '2027-01-11',
        provider: 'Telangana Skill Mission',
        brief: {
          courseName: 'Advanced Manufacturing Technician',
          courseLink: 'tsm.telangana.gov.in/mfg-tech',
          domain: 'Manufacturing',
          level: 'Beginner',
          eligibility: 'Diploma in Mechanical or Electrical, 2023–2026',
          stipend: '₹12,000/month on shop-floor apprenticeship',
          fee: 'Zero fee',
          mode: 'In-person centre (Medak, Hyderabad)',
          duration: '12 weeks',
          targetAudience: 'Polytechnic and diploma holders seeking aerospace and auto manufacturing roles',
          intakeTarget: '150',
          costCeiling: '3500',
          budget: '600000',
          selectionProcess: 'Trade practical assessment',
          certifyingBody: 'NSDC Skill Council',
          careerRoles: 'CNC Operator, Assembly Quality Lead, Mechatronics Technician',
          hiringPartners: 'Tata Boeing, Mahindra, Bharat Forge',
          src: {}
        },
        flags: [
          { rule: 'RR-H03', type: 'Outcome claims', status: 'Cleared', note: 'Apprenticeship model with statutory wage' },
          { rule: 'RR-H06', type: 'Institution endorsement', status: 'Under review', note: 'Awaiting polytechnic principal consent letters' },
          { rule: 'RR-H04', type: 'Paid promotion', status: 'Cleared', note: 'Government portal link only' }
        ],
        claims: []
      }
    ],
    campaigns: [
      {
        id: 'k1',
        name: 'Warangal engineering graduates',
        status: 'Live',
        filmId: 'f1',
        batch: 'Batch 4',
        objective: 'Getting onboarded',
        targetKPI: 'Screening enrolments',
        targetEnrolments: 120,
        costCeiling: 4500,
        budget: 800000,
        spent: 380000,
        start: '2026-09-22',
        end: '2026-10-26',
        markets: ['Telangana'],
        cohort: 'Engineering graduates 2023–2026, technology aspirants',
        hashtags: ['#AppliedAIMLBatch4', '#TASKTelangana', '#ZeroFeeSkilling'],
        narratives: [
          {
            id: 'n1',
            cls: 'Career outcome',
            title: 'From Warangal campus to a data team',
            who: 'Engineering graduates 2023–2026, Warangal and Hanumakonda',
            why: 'Batch 3 alumni posts drove 2.3× the enrolment rate of creator posts (Observed, 46 enrolments)',
            risk: 'Low: uses alumni stories, no salary figures',
            tone: 'Grounded, aspirational',
            hook: '"9 months ago I was where you are."',
            score: 88,
            role: 'Primary'
          },
          {
            id: 'n2',
            cls: 'Skill relevance',
            title: 'The exact skills Hyderabad teams hire for',
            who: 'Graduates comparing paid bootcamps',
            why: 'Syllabus maps to 7 of the 10 most-listed skills in Hyderabad data roles (Inferred)',
            risk: 'Low',
            tone: 'Practical',
            hook: '"Python, SQL, ML ops. In Telugu, in 16 weeks."',
            score: 76,
            role: 'Supporting'
          },
          {
            id: 'n3',
            cls: 'Institutional endorsement',
            title: 'Recommended by your placement cell',
            who: 'Final-year and recent graduates of partner colleges',
            why: 'Placement-cell broadcasts converted at 2.2% click-to-enrolment on Batch 3 (Observed)',
            risk: 'Medium: needs consent record for each institution (RR-H06)',
            tone: 'Official, reassuring',
            hook: '"Your T&P office has partnered with this programme."',
            score: 72,
            role: 'Supporting'
          }
        ],
        checkpoints: [
          { label: '72 hours', verdict: 'On track', note: 'Healthy initial click volume' },
          { label: 'Day 7', verdict: 'On track', note: 'Registration conversions within target' },
          { label: 'Day 14', verdict: 'Behind', note: '63 enrolments vs band 78–118' },
          { label: 'Close', verdict: null, note: 'Target: 120 enrolments' }
        ],
        diagnosis: {
          verdict: 'Behind',
          gap: 15,
          topCause: 'Message and programme mismatch on Hyderabad Tech Jobs (41%)',
          moves: [
            'Shift remaining budget to KITS Warangal placement broadcast',
            'Post alumni FAQ addressing stipend eligibility doubts',
            'Fast-track Prof. Lakshmi Narayana syllabus walkthrough',
            'Throttle meme-page distribution with high clicks but 0.5% enrolment'
          ]
        },
        alerts: [
          { rule: 'RR-H05', title: 'Enrolment rate below floor', note: 'Hyderabad Tech Jobs: 6,100 clicks but only 2 enrolments. Treat as mismatch.', dismissed: false },
          { rule: 'RR-H03', title: 'Scepticism alert', note: 'Placement-doubt comments at 22% on Instagram. Address with alumni Q&A.', dismissed: false }
        ],
        ccs: [
          {
            id: 'cc1',
            creatorId: 'c1',
            status: 'Live',
            deal: { rate: 120000, posts: 1, type: 'Paid', del: '1 long video', start: '2026-09-22', end: '2026-10-06', terms: 'Full course syllabus breakdown. #ad in description & pinned comment.' },
            posts: [
              {
                id: 'p1',
                title: 'Can you become an AI engineer without coding background?',
                format: 'Videos',
                date: '2026-09-24',
                views: 245000,
                sent: [68, 22, 10],
                intent: 180,
                clicks: 4320,
                regs: 480,
                enrols: 21,
                lastFetch: '2026-10-06T08:40',
                fetch: 'OK',
                likes: 8120,
                comments: 412,
                url: 'https://youtube.com/watch?v=ai50033481'
              }
            ]
          },
          {
            id: 'cc2',
            creatorId: 'c2',
            status: 'Live',
            deal: { rate: 45000, posts: 2, type: 'Paid', del: '2 reels', start: '2026-09-24', end: '2026-10-05', terms: 'No job guarantees. Mention stipend clearly.' },
            posts: [
              {
                id: 'p2',
                title: 'AI tools every 2025 graduate should learn this month',
                format: 'Reels',
                date: '2026-09-25',
                views: 310000,
                sent: [74, 18, 8],
                intent: 210,
                clicks: 3450,
                regs: 310,
                enrols: 14,
                lastFetch: '2026-10-06T08:40',
                fetch: 'OK',
                likes: 12400,
                comments: 530,
                url: 'https://instagram.com/reel/50041182'
              }
            ]
          },
          {
            id: 'cc3',
            creatorId: 'c3',
            status: 'Live',
            deal: { rate: 0, posts: 2, type: 'Partnership', del: '2 official broadcast announcements', start: '2026-09-23', end: '2026-10-10', terms: 'Consent letter signed by Dean of Placements.' },
            posts: [
              {
                id: 'p3',
                title: 'Placement cell notice: Applied AI Batch 4 screening registration',
                format: 'Broadcast message',
                date: '2026-09-23',
                views: null,
                sent: [90, 8, 2],
                intent: 280,
                clicks: 1240,
                regs: 310,
                enrols: 17,
                lastFetch: '2026-10-06T08:40',
                fetch: 'OK',
                likes: 0,
                comments: 0,
                clicksOnly: true,
                url: 'WhatsApp broadcast · tracked link only'
              },
              {
                id: 'p4',
                title: 'Reminder: Applied AI screening closes 20 Oct',
                format: 'Forwardable card',
                date: '2026-09-30',
                views: null,
                sent: [85, 12, 3],
                intent: 190,
                clicks: 610,
                regs: 140,
                enrols: 7,
                lastFetch: '2026-10-06T08:40',
                fetch: 'OK',
                likes: 0,
                comments: 0,
                clicksOnly: true,
                url: 'WhatsApp broadcast · tracked link only'
              }
            ]
          },
          {
            id: 'cc4',
            creatorId: 'c4',
            status: 'Live',
            deal: { rate: 15000, posts: 2, type: 'Paid', del: '2 posts', start: '2026-09-24', end: '2026-10-08', terms: 'No salary figures. Disclosure in first line.' },
            posts: [
              {
                id: 'p5',
                title: 'From Warangal tier-3 college to product engineer in 9 months',
                format: 'Posts',
                date: '2026-09-25',
                views: 21000,
                sent: [82, 14, 4],
                intent: 96,
                clicks: 640,
                regs: 128,
                enrols: 9,
                lastFetch: '2026-10-06T08:40',
                fetch: 'OK',
                manual: true,
                likes: 975,
                comments: 62,
                url: 'https://linkedin.com/posts/50073229'
              }
            ]
          },
          {
            id: 'cc5',
            creatorId: 'c5',
            status: 'Live',
            deal: { rate: 18000, posts: 1, type: 'Paid', del: '1 group post', start: '2026-09-24', end: '2026-09-30', terms: 'Admin pins for 48 hours.' },
            posts: [
              {
                id: 'p6',
                title: 'Free AI programme with merit stipend for 2023–26 graduates',
                format: 'Posts',
                date: '2026-09-25',
                views: 192000,
                sent: [58, 30, 12],
                intent: 140,
                clicks: 2900,
                regs: 240,
                enrols: 4,
                lastFetch: '2026-10-06T08:40',
                fetch: 'OK',
                likes: 3963,
                comments: 253,
                url: 'https://facebook.com/groups/5009814'
              }
            ]
          },
          {
            id: 'cc6',
            creatorId: 'c7',
            status: 'Live',
            deal: { rate: 60000, posts: 2, type: 'Paid', del: '2 reels', start: '2026-09-24', end: '2026-10-08', terms: 'No salary or job guarantee.' },
            posts: [
              {
                id: 'p7',
                title: 'Hyderabad companies hiring AI freshers in Q4',
                format: 'Reels',
                date: '2026-09-26',
                views: 410000,
                sent: [48, 32, 20],
                intent: 60,
                clicks: 6100,
                regs: 410,
                enrols: 2,
                lastFetch: '2026-10-06T08:40',
                fetch: 'OK',
                likes: 6347,
                comments: 406,
                url: 'https://instagram.com/reel/50118007Hz'
              }
            ]
          },
          {
            id: 'cc7',
            creatorId: 'c6',
            status: 'Content in review',
            deal: { rate: 30000, posts: 2, type: 'Paid', del: '1 lecture + 1 live Q&A', start: '2026-09-30', end: '2026-10-04', terms: 'Syllabus walkthrough only.' },
            posts: []
          },
          {
            id: 'cc8',
            creatorId: 'c8',
            status: 'Confirmed',
            deal: { rate: 0, posts: 1, type: 'Partnership', del: '1 broadcast + help desk at job mela', start: '2026-09-30', end: '2026-10-03', terms: 'No fee.' },
            posts: []
          },
          {
            id: 'cc9',
            creatorId: 'c9',
            status: 'Negotiating',
            deal: { rate: 95000, posts: 1, type: 'Paid', del: '1 video', start: '2026-10-08', end: '2026-10-14', terms: 'Proposed' },
            posts: []
          }
        ],
        comments: [
          { cr: 'c1', text: 'Stipend nijamga istara? Eligibility enti?', lang: 'Telugu (romanised)', tr: 'Is the stipend really given? What is the eligibility?', sent: 'Neutral', theme: 'Eligibility', intent: false },
          { cr: 'c1', text: 'Register chesa, screening date eppudu?', lang: 'Telugu (romanised)', tr: 'I registered. When is the screening date?', sent: 'Positive', theme: 'Intent to apply', intent: true },
          { cr: 'c7', text: 'Job guarantee unda leda? Lekapothe waste', lang: 'Telugu (romanised)', tr: 'Is there a job guarantee or not? Otherwise it is a waste', sent: 'Negative', theme: 'Placement doubt', intent: false },
          { cr: 'c7', text: 'Hyderabad lo matrame na classes?', lang: 'Telugu (romanised)', tr: 'Are classes only in Hyderabad?', sent: 'Neutral', theme: 'Location', intent: false },
          { cr: 'c5', text: '2022 pass out ki eligible aa?', lang: 'Telugu (romanised)', tr: 'Is a 2022 pass-out eligible?', sent: 'Neutral', theme: 'Eligibility', intent: false },
          { cr: 'c4', text: 'Your story is exactly my situation. Applying today.', lang: 'English', tr: '', sent: 'Positive', theme: 'Intent to apply', intent: true },
          { cr: 'c7', text: 'These paid courses never place anyone', lang: 'English', tr: '', sent: 'Negative', theme: 'Placement doubt', intent: false },
          { cr: 'c1', text: 'Weekend batch untunda? Nenu job chestunna', lang: 'Telugu (romanised)', tr: 'Is there a weekend batch? I am working', sent: 'Neutral', theme: 'Schedule', intent: false },
          { cr: 'c2', text: 'Classes Telugu lo na English lo na?', lang: 'Telugu (romanised)', tr: 'Are classes in Telugu or English?', sent: 'Neutral', theme: 'Language', intent: false },
          { cr: 'c2', text: 'Done! Registered with the link 🙌', lang: 'English', tr: '', sent: 'Positive', theme: 'Intent to apply', intent: true },
          { cr: 'c9', text: 'Fee emi ledu ante doubt ga undi', lang: 'Telugu (romanised)', tr: 'No fee at all makes me doubtful', sent: 'Negative', theme: 'Fees', intent: false }
        ]
      },
      {
        id: 'k2',
        name: 'Hyderabad final-year CSE students',
        status: 'Live',
        filmId: 'f1',
        batch: 'Batch 4',
        objective: 'Getting onboarded',
        targetKPI: 'Screening enrolments',
        targetEnrolments: 90,
        costCeiling: 4500,
        budget: 600000,
        spent: 210000,
        start: '2026-09-29',
        end: '2026-10-31',
        markets: ['Telangana'],
        cohort: 'Final-year CSE and IT students, graduating 2027',
        checkpoints: [
          { label: '72 hours', verdict: 'Ahead', note: 'Early traction strong' },
          { label: 'Day 7', verdict: 'Ahead', note: 'Enrolment run rate exceeds ceiling' },
          { label: 'Day 14', verdict: null, note: 'Pending' },
          { label: 'Close', verdict: null, note: 'Target: 90 enrolments' }
        ],
        diagnosis: { verdict: 'Ahead', gap: 0, topCause: '', moves: [] },
        alerts: [],
        ccs: [],
        comments: []
      },
      {
        id: 'k3',
        name: 'Batch 3 alumni referral push',
        status: 'Closed',
        filmId: 'f1',
        batch: 'Batch 3',
        objective: 'Getting onboarded',
        targetKPI: 'Screening enrolments',
        targetEnrolments: 50,
        costCeiling: 4000,
        budget: 300000,
        spent: 240000,
        start: '2026-08-01',
        end: '2026-08-30',
        markets: ['Telangana', 'Andhra Pradesh'],
        cohort: 'Engineering graduates 2022–2025',
        checkpoints: [
          { label: '72 hours', verdict: 'On track', note: '' },
          { label: 'Day 7', verdict: 'On track', note: '' },
          { label: 'Day 14', verdict: 'Ahead', note: '' },
          { label: 'Close', verdict: 'On track', note: '56 enrolments achieved' }
        ],
        diagnosis: { verdict: 'On track', gap: 0, topCause: '', moves: [] },
        alerts: [],
        ccs: [],
        comments: []
      },
      {
        id: 'k4',
        name: 'Nalgonda and Khammam graduates',
        status: 'Draft',
        filmId: 'f1',
        batch: 'Batch 4',
        objective: 'Getting onboarded',
        targetKPI: 'Screening enrolments',
        targetEnrolments: 60,
        costCeiling: 4500,
        budget: 400000,
        spent: 0,
        start: '2026-10-20',
        end: '2026-11-12',
        markets: ['Telangana'],
        cohort: 'Telangana',
        checkpoints: [],
        diagnosis: { verdict: null, gap: 0, topCause: '', moves: [] },
        alerts: [],
        ccs: [],
        comments: [],
        wiz: {
          step: 0,
          done: [],
          answers: { q1: 'No', q2: 'No', q3: 'No' },
          focus: null,
          needs: [],
          targetEnrolments: 60,
          costCeiling: 4500,
          budget: 400000,
          qualification: 'B.Tech / B.E.',
          skill: 'CSE, IT, ECE',
          age: '21–26 years',
          exp: '0–2 years experience',
          lang: 'Telugu',
          channels: [
            { ch: 'YouTube', format: 'Long video', share: 45 },
            { ch: 'Instagram', format: 'Reels', share: 30 },
            { ch: 'LinkedIn', format: 'Posts', share: 15 },
            { ch: 'WhatsApp', format: 'Community broadcast', share: 10 }
          ],
          shortlist: []
        }
      }
    ],
    creators: [
      {
        id: 'c1',
        name: 'Tech Telugu Ravi',
        handle: '@techteluguravi',
        platform: 'YouTube',
        tier: 'Macro',
        type: 'Digital creator',
        district: 'Hyderabad',
        followers: 820000,
        er: 4.6,
        rate: 120000,
        skills: ['Career guidance', 'AI/ML'],
        status: 'Enriched',
        verified: true,
        updated: '2026-09-18',
        growth: 2.5,
        pastEnrols: 62,
        accounts: [
          { platform: 'Instagram', handle: '@techteluguravi', followers: 899000, medianViews: 231000, er: 6.0, verified: false, updated: '2026-09-18', url: 'https://instagram.com/techteluguravi' },
          { platform: 'YouTube', handle: '@techteluguravi', followers: 820000, medianViews: 182000, er: 4.6, verified: true, updated: '2026-09-18', primary: true, url: 'https://youtube.com/@techteluguravi' },
          { platform: 'Facebook', handle: '@techteluguravi', followers: 231000, medianViews: 60000, er: 6.5, verified: false, updated: '2026-09-06', url: 'https://facebook.com/techteluguravi' },
          { platform: 'X', handle: '@techteluguravi', followers: 217000, medianViews: 8700, er: 1.5, verified: false, updated: '2026-09-17', url: 'https://x.com/techteluguravi' }
        ]
      },
      {
        id: 'c2',
        name: 'Coding with Sravani',
        handle: '@codingwithsravani',
        platform: 'Instagram',
        tier: 'Mid',
        type: 'Micro-influencer',
        district: 'Hyderabad',
        followers: 214000,
        er: 7.8,
        rate: 45000,
        skills: ['Software development', 'Interview prep'],
        status: 'Enriched',
        verified: true,
        updated: '2026-09-20',
        growth: 4.1,
        pastEnrols: 38,
        accounts: [
          { platform: 'Instagram', handle: '@codingwithsravani', followers: 214000, medianViews: 88000, er: 7.8, verified: true, updated: '2026-09-20', primary: true, url: 'https://instagram.com/codingwithsravani' },
          { platform: 'YouTube', handle: '@codingwithsravani', followers: 145000, medianViews: 42000, er: 5.2, verified: false, updated: '2026-09-15', url: 'https://youtube.com/@codingwithsravani' }
        ]
      },
      {
        id: 'c3',
        name: 'KITS Warangal Placement Cell',
        handle: 'KITS-W placement broadcast',
        platform: 'WhatsApp',
        tier: 'Mid',
        type: 'Placement cell',
        district: 'Warangal',
        followers: 4200,
        er: null,
        rate: 0,
        skills: ['Placements', 'Career guidance'],
        status: 'Enriched',
        verified: true,
        updated: '2026-09-21',
        growth: 1.2,
        pastEnrols: 45,
        accounts: [
          { platform: 'WhatsApp', handle: 'KITS-W broadcast', followers: 4200, medianViews: 3800, er: null, verified: true, updated: '2026-09-21', primary: true, url: 'WhatsApp broadcast' }
        ]
      },
      {
        id: 'c4',
        name: 'Sai Kiran Reddy',
        handle: 'linkedin.com/in/saikiran-ml',
        platform: 'LinkedIn',
        tier: 'Micro',
        type: 'Alumnus',
        district: 'Hyderabad',
        followers: 18000,
        er: 5.4,
        rate: 15000,
        skills: ['AI/ML', 'Career guidance'],
        status: 'Enriched',
        verified: true,
        updated: '2026-09-19',
        growth: 3.8,
        pastEnrols: 18,
        accounts: [
          { platform: 'LinkedIn', handle: 'saikiran-ml', followers: 18000, medianViews: 12000, er: 5.4, verified: true, updated: '2026-09-19', primary: true, url: 'https://linkedin.com/in/saikiran-ml' }
        ]
      },
      {
        id: 'c5',
        name: 'Telangana Engineering Students',
        handle: 'fb.com/groups/tgengineers',
        platform: 'Facebook',
        tier: 'Macro',
        type: 'College network',
        district: 'Hyderabad',
        followers: 342000,
        er: 2.4,
        rate: 18000,
        skills: ['Placements', 'Career guidance'],
        status: 'Enriched',
        verified: false,
        updated: '2026-09-06',
        growth: 0.8,
        pastEnrols: 12,
        accounts: [
          { platform: 'Facebook', handle: 'groups/tgengineers', followers: 342000, medianViews: 45000, er: 2.4, verified: false, updated: '2026-09-06', primary: true, url: 'https://facebook.com/groups/tgengineers' }
        ]
      },
      {
        id: 'c6',
        name: 'Prof. Lakshmi Narayana',
        handle: '@proflnteaches',
        platform: 'YouTube',
        tier: 'Micro',
        type: 'Trainer or mentor',
        district: 'Warangal',
        followers: 64000,
        er: 8.9,
        rate: 30000,
        skills: ['AI/ML', 'Data engineering'],
        status: 'Enriched',
        verified: true,
        updated: '2026-09-22',
        growth: 2.1,
        pastEnrols: 24,
        accounts: [
          { platform: 'YouTube', handle: '@proflnteaches', followers: 64000, medianViews: 28000, er: 8.9, verified: true, updated: '2026-09-22', primary: true, url: 'https://youtube.com/@proflnteaches' }
        ]
      },
      {
        id: 'c7',
        name: 'Hyderabad Tech Jobs',
        handle: '@hyderabadtechjobs',
        platform: 'Instagram',
        tier: 'Macro',
        type: 'Digital creator',
        district: 'Hyderabad',
        followers: 520000,
        er: 3.2,
        rate: 60000,
        skills: ['Career guidance'],
        status: 'Enriched',
        verified: true,
        updated: '2026-09-20',
        growth: 5.2,
        pastEnrols: 8,
        accounts: [
          { platform: 'Instagram', handle: '@hyderabadtechjobs', followers: 520000, medianViews: 190000, er: 3.2, verified: true, updated: '2026-09-20', primary: true, url: 'https://instagram.com/hyderabadtechjobs' }
        ]
      },
      {
        id: 'c8',
        name: 'Warangal Youth Forum',
        handle: 'Warangal Youth WhatsApp',
        platform: 'WhatsApp',
        tier: 'Micro',
        type: 'Community leader',
        district: 'Warangal',
        followers: 9500,
        er: null,
        rate: 0,
        skills: ['Career guidance'],
        status: 'Enriched',
        verified: true,
        updated: '2026-09-24',
        growth: 1.0,
        pastEnrols: 14,
        accounts: [
          { platform: 'WhatsApp', handle: 'Warangal Youth', followers: 9500, medianViews: 8200, er: null, verified: true, updated: '2026-09-24', primary: true, url: 'WhatsApp group' }
        ]
      },
      {
        id: 'c9',
        name: 'Career Guru Telugu',
        handle: '@careergurutelugu',
        platform: 'YouTube',
        tier: 'Mid',
        type: 'Trainer or mentor',
        district: 'Hyderabad',
        followers: 380000,
        er: 4.8,
        rate: 95000,
        skills: ['Career guidance', 'Placements'],
        status: 'Enriched',
        verified: true,
        updated: '2026-09-12',
        growth: 3.1,
        pastEnrols: 29,
        accounts: [
          { platform: 'YouTube', handle: '@careergurutelugu', followers: 380000, medianViews: 110000, er: 4.8, verified: true, updated: '2026-09-12', primary: true, url: 'https://youtube.com/@careergurutelugu' }
        ]
      },
      {
        id: 'c10',
        name: 'Nalgonda Engineering Forum',
        handle: 'Nalgonda BTech students',
        platform: 'WhatsApp',
        tier: 'Nano',
        type: 'College network',
        district: 'Nalgonda',
        followers: 3100,
        er: null,
        rate: 0,
        skills: ['Career guidance'],
        status: 'Failed',
        verified: false,
        updated: '2026-08-10',
        growth: 0.1,
        pastEnrols: 0,
        accounts: []
      },
      {
        id: 'c11',
        name: 'Khammam Student Pulse',
        handle: '@khammamstudentpulse',
        platform: 'Instagram',
        tier: 'Nano',
        type: 'Community leader',
        district: 'Khammam',
        followers: 8200,
        er: 6.2,
        rate: 5000,
        skills: ['Career guidance'],
        status: 'Partial',
        verified: false,
        updated: '2026-08-14',
        growth: 1.5,
        pastEnrols: 0,
        accounts: []
      },
      {
        id: 'c12',
        name: 'Srikanth AI Insights',
        handle: 'linkedin.com/in/srikanth-ai',
        platform: 'LinkedIn',
        tier: 'Micro',
        type: 'Alumnus',
        district: 'Hyderabad',
        followers: 14000,
        er: 6.1,
        rate: 12000,
        skills: ['AI/ML'],
        status: 'Enriched',
        verified: true,
        updated: '2026-09-25',
        growth: 2.9,
        pastEnrols: 11,
        accounts: []
      },
      {
        id: 'c13',
        name: 'Kakatiya University Placements',
        handle: 'KU Warangal broadcast',
        platform: 'WhatsApp',
        tier: 'Mid',
        type: 'Placement cell',
        district: 'Warangal',
        followers: 6500,
        er: null,
        rate: 0,
        skills: ['Placements'],
        status: 'Enriched',
        verified: false,
        updated: '2026-09-20',
        growth: 1.1,
        pastEnrols: 19,
        accounts: []
      },
      {
        id: 'c14',
        name: 'Khammam Graduates Network',
        handle: 'fb.com/khammamgraduates',
        platform: 'Facebook',
        tier: 'Micro',
        type: 'College network',
        district: 'Khammam',
        followers: 48000,
        er: 3.1,
        rate: 10000,
        skills: ['Placements'],
        status: 'Enriched',
        verified: false,
        updated: '2026-09-18',
        growth: 1.4,
        pastEnrols: 6,
        accounts: []
      },
      {
        id: 'c15',
        name: 'Tech Vedika Telugu',
        handle: '@techvedika',
        platform: 'YouTube',
        tier: 'Mid',
        type: 'Digital creator',
        district: 'Hyderabad',
        followers: 210000,
        er: 5.1,
        rate: 70000,
        skills: ['AI/ML', 'Software development'],
        status: 'Enriched',
        verified: true,
        updated: '2026-09-22',
        growth: 3.5,
        pastEnrols: 16,
        accounts: []
      }
    ],
    files: [
      { id: 'fl1', filmId: 'f1', title: 'Applied AI & ML Programme - Master Syllabus v4', type: 'PDF', size: '2.4 MB', created: '2026-09-01' },
      { id: 'fl2', filmId: 'f1', title: 'Cohort Placement Report - Batches 1 to 3', type: 'PDF', size: '4.8 MB', created: '2026-09-05' },
      { id: 'fl3', filmId: 'f1', title: 'TASK MoU & Institutional Endorsement Letter', type: 'PDF', size: '1.1 MB', created: '2026-09-10' },
      { id: 'fl4', filmId: 'f1', title: 'Student Eligibility & Stipend Policy Document', type: 'PDF', size: '820 KB', created: '2026-09-12' },
      { id: 'fl5', filmId: 'f1', title: 'Warangal District Engineering Colleges Directory', type: 'XLSX', size: '640 KB', created: '2026-09-14' },
      { id: 'fl6', filmId: 'f1', title: 'Course Brochure & Screening Guidelines', type: 'PDF', size: '3.2 MB', created: '2026-09-15' },
      { id: 'fl7', filmId: 'f2', title: 'Advanced Manufacturing Curriculum Blueprint', type: 'PDF', size: '3.6 MB', created: '2026-10-01' }
    ],
    rateTiers: {
      '0': { name: 'Institutional', followers: 'Placement cells, college networks', low: 0, high: 0, prov: 'Observed', bookings: '6 across 2 courses' },
      '1': { name: 'Nano', followers: '1K–10K', low: 2000, high: 6000, prov: 'Illustrative', bookings: '1 across 1 course' },
      '2': { name: 'Micro', followers: '10K–100K', low: 7000, high: 16000, prov: 'Observed', bookings: '6 across 3 courses' },
      '3': { name: 'Mid', followers: '100K–500K', low: 18000, high: 40000, prov: 'Observed', bookings: '8 across 3 courses' },
      '4': { name: 'Macro', followers: '500K–1M', low: 55000, high: 90000, prov: 'Observed', bookings: '4 across 2 courses' },
      '5': { name: 'Mega', followers: '1M+', low: 90000, high: 150000, prov: 'Illustrative', bookings: '2 across 1 course' }
    },
    rateObs: [
      { date: '2026-10-03', name: 'Warangal Youth Forum · Applied AI & ML Programme', tier: 'Institutional', posts: '1 posts', fee: '₹0/post' },
      { date: '2026-09-27', name: 'Coding with Sravani · Applied AI & ML Programme', tier: 'Mid', posts: '2 posts', fee: '₹28,000/post' },
      { date: '2026-09-24', name: 'Sai Kiran Reddy · Applied AI & ML Programme', tier: 'Micro', posts: '2 posts', fee: '₹7,500/post' },
      { date: '2026-09-22', name: 'Tech Telugu Ravi · Applied AI & ML Programme', tier: 'Macro', posts: '1 posts', fee: '₹1,20,000/post' },
      { date: '2026-09-18', name: 'Telangana Engineering Students · Applied AI & ML Programme', tier: 'Macro', posts: '1 posts', fee: '₹18,000/post' }
    ],
    connectors: [
      { id: 'yt', name: 'YouTube Data API', type: 'API key', status: 'Connected', keyEnding: '3Hq9', quota: '4,120 of 10,000 units', quotaPct: 41, last: '2026-10-06T08:40' },
      { id: 'yta', name: 'YouTube Analytics', type: 'OAuth', status: 'Connected', account: 'Nexa Skills Official (programme channel)', last: '2026-10-06T06:00' },
      { id: 'meta', name: 'Meta (Instagram + Facebook)', type: 'OAuth', status: 'Expiring', account: 'Business account @nexaskills · token expires 12 Oct 2026 (6 days)', last: '2026-10-06T08:38' },
      { id: 'res', name: 'Resolence (enrolment records)', type: 'Connector', status: 'Connected', account: 'Registration and enrolment counts per tag · daily at 08:00 · manual upload fallback', last: '2026-10-06T08:00' },
      { id: 'li', name: 'LinkedIn', type: 'Upload', status: 'Upload only', account: 'Sheet upload and manual metrics in v1' },
      { id: 'x', name: 'X', type: 'API', status: 'Unsupported', account: 'API changes disabled live engagement metrics' }
    ],
    threads: [
      {
        id: 'th1',
        title: 'Why is Warangal engineering graduates behind?',
        campaign: 'Warangal engineering graduates · 6 Oct',
        messages: [
          { role: 'user', text: 'Why is Warangal engineering graduates behind?' },
          {
            role: 'assistant',
            text: 'At the Day 14 checkpoint the campaign had 63 screening enrolments against an expected band of 78–118, while clicks are inside their band. The largest cause (41%) is a message and programme mismatch: Hyderabad Tech Jobs produced 6,100 clicks but only 2 enrolments, and 71% of its audience is in Hyderabad, not Warangal. Two confirmed trust-anchor sources have not posted yet.',
            citations: [
              'Diagnosis · 6 Oct 09:00',
              'Frozen prediction v1',
              'Resolence counts · 6 Oct 08:00'
            ]
          }
        ]
      },
      {
        id: 'th2',
        title: 'Telugu caption for the eligibility card',
        campaign: 'Applied AI & ML Programme · 4 Oct',
        messages: [
          { role: 'user', text: 'Draft a Telugu caption for the eligibility carousel' },
          {
            role: 'assistant',
            text: 'Here is a compliant caption adhering to RR-H03 (no salary promises) and RR-H04 (#ad tagging):\n\n"2023–2026 B.Tech/MCA graduates ki Applied AI & ML Programme Batch 4 screening modalu ayyindi! 16-weeks hybrid training + project stipend. Zero course fee. Registration link bio lo undi. #ad"\n\nTranslation: "Screening has begun for 2023–2026 B.Tech/MCA graduates for Applied AI & ML Batch 4! 16-week hybrid training with project stipend. Zero course fee. Registration link in bio. #ad"',
            citations: ['Course Brief · Eligibility', 'RR-H04 guidelines']
          }
        ]
      }
    ],
    rateTiers: [
      { id: 't0', tier: 'Institutional', range: 'Placement cells, college networks', lo: 0, hi: 0, prov: 'Observed', bookings: 6, films: 2 },
      { id: 't1', tier: 'Nano', range: '1K–10K', lo: 2000, hi: 6000, prov: 'Illustrative', bookings: 1, films: 1 },
      { id: 't2', tier: 'Micro', range: '10K–100K', lo: 7000, hi: 16000, prov: 'Observed', bookings: 6, films: 3 },
      { id: 't3', tier: 'Mid', range: '100K–500K', lo: 18000, hi: 40000, prov: 'Observed', bookings: 8, films: 3 },
      { id: 't4', tier: 'Macro', range: '500K–1M', lo: 55000, hi: 90000, prov: 'Observed', bookings: 4, films: 2 },
      { id: 't5', tier: 'Mega', range: '1M+', lo: 90000, hi: 150000, prov: 'Illustrative', bookings: 2, films: 1 }
    ],
    rateObs: [
      { date: '2026-10-04', creator: 'c1', film: 'Applied AI & ML Programme', rate: 120000, posts: 1, tier: 'Mid' },
      { date: '2026-09-28', creator: 'c2', film: 'Applied AI & ML Programme', rate: 45000, posts: 2, tier: 'Micro' },
      { date: '2026-09-24', creator: 'c4', film: 'Applied AI & ML Programme', rate: 15000, posts: 2, tier: 'Micro' },
      { date: '2026-08-15', creator: 'c3', film: 'Applied AI & ML Programme', rate: 0, posts: 2, tier: 'Institutional' },
      { date: '2026-07-20', creator: 'c6', film: 'Applied AI & ML Programme', rate: 8000, posts: 1, tier: 'Nano' }
    ],
    toasts: []
  };
}

class Store {
  constructor() {
    this.s = createInitialState();
    this.subs = new Set();
  }

  set(fn) {
    fn(this.s);
    this.notify();
  }

  sub(fn) {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  notify() {
    this.subs.forEach((fn) => {
      try { fn(this.s); } catch (e) { console.error('Store listener error:', e); }
    });
  }

  go(name, params = {}) {
    this.set((x) => {
      x.route = { name, ...params };
    });
  }

  toast(text, kind = 'ok') {
    const id = uid('t');
    this.set((x) => {
      x.toasts.push({ id, text, kind });
    });
    setTimeout(() => this.dismissToast(id), kind === 'error' ? 6000 : 3500);
  }

  dismissToast(id) {
    this.set((x) => {
      x.toasts = x.toasts.filter((t) => t.id !== id);
    });
  }

  film(id) {
    const targetId = id || this.s.filmId;
    return this.s.films.find((f) => f.id === targetId) || this.s.films[0];
  }

  camp(id) {
    return this.s.campaigns.find((c) => c.id === id);
  }

  creator(id) {
    return this.s.creators.find((c) => c.id === id);
  }

  ccOf(campId, ccId) {
    const c = this.camp(campId);
    return c?.ccs.find((x) => x.id === ccId);
  }

  readiness(film) {
    if (film?.readiness && typeof film.readiness.ok === 'number') {
      return film.readiness;
    }
    const b = film?.form || film?.brief || {};
    const req = [
      { key: 'title', label: 'Course name' },
      { key: 'link', label: 'Course link' },
      { key: 'domain', label: 'Skill domain' },
      { key: 'level', label: 'Level' },
      { key: 'eligibility', label: 'Eligibility' },
      { key: 'duration', label: 'Duration' },
      { key: 'mode', label: 'Delivery mode' },
      { key: 'locations', label: 'Target area' },
      { key: 'regLink', label: 'Registration link (Resolence)' }
    ];
    const missing = req.filter((r) => {
      const v = b[r.key] || (r.key === 'title' ? film?.title : undefined);
      return !v || (Array.isArray(v) && v.length === 0);
    });
    const total = req.length;
    const ok = total - missing.length;
    return {
      total,
      req: total,
      ok,
      missing,
      pct: Math.round((ok / total) * 100),
      refused: (film?.flags || []).some((x) => x.status === 'Refused'),
      noRegLink: !b.regLink
    };
  }

  campStats(c) {
    let views = 0, clicks = 0, regs = 0, enrols = 0, posts = 0;
    (c.ccs || []).forEach((cc) => {
      (cc.posts || []).forEach((p) => {
        views += p.views || 0;
        clicks += p.clicks || 0;
        regs += p.regs || 0;
        enrols += p.enrols || 0;
        posts++;
      });
    });
    const cpe = enrols > 0 ? Math.round(c.spent / enrols) : 0;
    return { views, clicks, regs, enrols, posts, cpe };
  }

  daysBetween(a, b) {
    return daysBetween(a, b);
  }

  addDays(d, n) {
    return addDays(d, n);
  }

  uid(p) {
    return uid(p);
  }

  inr(n) {
    if (n === null || n === undefined) return '—';
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  n(v) {
    if (v === null || v === undefined) return '0';
    return Number(v).toLocaleString('en-IN');
  }

  formatNumber(n) {
    if (n === null || n === undefined) return '0';
    return Number(n).toLocaleString('en-IN');
  }

  ds(d) {
    if (!d) return '—';
    try {
      const dt = new Date(String(d).includes('T') ? d : d + 'T12:00:00');
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return String(d);
    }
  }

  d(d) {
    if (!d) return '—';
    try {
      const dt = new Date(String(d).includes('T') ? d : d + 'T12:00:00');
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return String(d);
    }
  }

  tone(s) {
    const str = String(s || '').toLowerCase();
    if (['live', 'passed', 'connected', 'recorded', 'observed', 'active', 'confirmed', 'cleared', 'delivered', 'evidenced', 'success', 'approved', 'pass', 'ok'].includes(str)) {
      return { bg: 'var(--success-50, #E6F4EA)', fg: 'var(--success-800, #137333)', bar: 'var(--success-600, #188038)', border: 'var(--success-200, #CEEAD6)' };
    }
    if (['warning', 'behind', 'expiring', 'partial', 'needs review', 'awaiting evidence', 'hold', 'needs attention', 'content in review', 'negotiating', 'approached', 'warn'].includes(str)) {
      return { bg: 'var(--warning-50, #FEF7E0)', fg: 'var(--warning-800, #B06000)', bar: 'var(--warning-600, #F29900)', border: 'var(--warning-200, #FEEFC3)' };
    }
    if (['fail', 'danger', 'refused', 'failed', 'disconnected', 'missing', 'declined', 'backed out', 'error'].includes(str)) {
      return { bg: 'var(--danger-50, #FCE8E6)', fg: 'var(--danger-800, #C5221F)', bar: 'var(--danger-600, #D93025)', border: 'var(--danger-200, #FAD2CF)' };
    }
    return { bg: 'var(--ink-50, #F1F3F4)', fg: 'var(--ink-700, #3C4043)', bar: 'var(--ink-400, #9AA0A6)', border: 'var(--ink-200, #DADCE0)' };
  }

  paidOf(cr) {
    if (cr?.collab) return cr.collab;
    if (cr?.rateSrc === 'Partnership' || (cr?.rate === 0 && INSTITUTIONAL.includes(cr?.type))) return 'Partnership';
    return (cr?.rate && cr.rate > 0) ? 'Paid' : 'Partnership';
  }

  accOf(cr) {
    if (cr?.account_type) return cr.account_type;
    if (INSTITUTIONAL.includes(cr?.type) || cr?.acct === 'Institution') return 'Institutional';
    return 'Individual';
  }

  rank(opts = {}) {
    const creators = this.s.creators || [];
    const blocked = [];
    const ranked = [];
    creators.forEach((c) => {
      const isInstitutional = ['College network', 'Placement cell'].includes(c.type);
      const isFailed = c.status === 'Failed';
      const item = {
        c,
        id: c.id,
        name: c.name,
        platform: c.platform,
        score: isInstitutional ? 92 : 84,
        trustPct: isInstitutional ? 94 : 86,
        fitPct: 88,
        qr: c.mv ? c.mv * 2 : 24000,
        why: isInstitutional ? 'Institutional alumni and student trust network' : 'High engagement in technical audience',
        where: c.platform,
        what: (c.content || [])[0] || 'Technical breakdown',
        past: `${c.attributed || 0} enrolments attributed`,
        flags: []
      };

      if (isInstitutional && c.consent !== 'Recorded') {
        item.rule = 'RR-H06';
        item.reason = 'Institutional source requires recorded consent';
        item.flags.push('Institutional consent pending');
        blocked.push(item);
      } else if (isFailed) {
        item.rule = 'G-REFRESH';
        item.reason = 'Enrichment failed';
        item.flags.push('Metrics stale / failed');
        blocked.push(item);
      } else {
        ranked.push(item);
      }
    });
    return { ranked, blocked, list: [...ranked, ...blocked] };
  }

  isInst(typeOrCreator) {
    const t = typeof typeOrCreator === 'object' ? typeOrCreator?.type : typeOrCreator;
    return INSTITUTIONAL.includes(t);
  }

  gateOf(c) {
    if (this.isInst(c?.type) && c?.consent !== 'Recorded') {
      return { rule: 'RR-H06', reason: 'Consent required' };
    }
    if (c?.status === 'Failed') {
      return { rule: 'G-REFRESH', reason: 'Enrichment failed' };
    }
    return null;
  }

  inrL(n) {
    if (!n) return '₹0';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  dt(s) {
    if (!s) return '—';
    return String(s).replace('T', ' ').slice(0, 16);
  }

  ccStats(x) {
    let views = 0, clicks = 0, regs = 0, enrols = 0, posts = 0;
    (x?.posts || []).forEach(p => {
      views += p.views || 0;
      clicks += p.clicks || 0;
      regs += p.regs || 0;
      enrols += p.enrols || 0;
      posts++;
    });
    const rate = x?.deal?.rate || x?.rate || 0;
    const dealPosts = x?.deal?.posts || x?.posts || 1;
    const total = rate * dealPosts;
    const spent = COMMITTED.includes(x?.status) ? rate * Math.min(posts, dealPosts) : 0;
    const cpe = enrols > 0 ? Math.round(spent / enrols) : 0;
    return { views, clicks, regs, enrols, posts, total, spent, cpe, cpi: cpe };
  }

  reset() {
    this.s = createInitialState();
    this.notify();
  }
}

export const MK = ['Hyderabad', 'Warangal', 'Nalgonda', 'Khammam', 'Karimnagar', 'Nizamabad'];

export const HQ = new Store();
HQ.INSTITUTIONAL = INSTITUTIONAL;
HQ.MK = MK;
HQ.SKILLS = SKILLS;
HQ.SOURCE_TYPES = SOURCE_TYPES;
HQ.STATES = STATES;
HQ.STATUSES = STATUSES;
HQ.TODAY = TODAY;
Store.prototype.TODAY = TODAY;
if (typeof window !== 'undefined') {
  window.HQ = HQ;
}
