# HIRE IQ SOURCE ANALYSIS & REVERSE-ENGINEERING REPORT

## 1. Executive Summary & Source Artifact Overview
The authoritative reference for this reconstruction is the standalone bundle file `Influence IQ (4).html` (925,996 bytes). 
Investigation reveals that this HTML file is a compiled and packaged distribution bundle created by a specialized bundler (`__bundler/manifest`, `__bundler/ext_resources`, and `__bundler/template`).

The bundle packages two sister modules sharing the "Influence IQ" platform brand:
1. **Screen IQ**: Film and release influencer marketing, campaign monitoring, and box-office impact tracking (`iq_screeniq_v2`).
2. **Hire IQ**: Skilling, education, and placement cohort campaigns, student micro-influencers, institutional network consent, enrolment lift verification, and governance rules (`iq_hireiq_v2`).

All components, stylesheets, data engines, and assets are embedded within compressed Base64 GZIP payloads in the `<script type="__bundler/manifest">` block and mapped via `<script type="__bundler/ext_resources">`.

---

## 2. Source Deconstruction & Resource Inventory

### 2.1 Core Runtime & Engines
| Asset UUID | Virtual Path / Identity | MIME Type | Decompressed Size | Description |
|---|---|---|---|---|
| `f5dd64b4-6e22-45c8-a011-30282ae2b2a7` | (runtime) | `text/javascript` | 69,134 B | **DC Runtime** — Reactive component runtime and DOM compiler supporting `<x-dc>`, `<sc-if>`, `<sc-for>`, `<dc-import>`, event binding (`onClick`, `onChange`, `onSubmit`), style-hover, and React 18 integration. |
| `17c8a4d7-4a33-44d4-89ba-a7d988dc2ba2` | `unpkg.com/react@18.3.1` | `text/javascript` | 10,751 B | React 18.3.1 UMD production build. |
| `90dd9c26-8576-434e-8193-0c68fb110e82` | `unpkg.com/react-dom@18.3.1` | `text/javascript` | 131,835 B | ReactDOM 18.3.1 UMD production build. |
| `988bfe83-03c2-468a-a6eb-0e5a48186a89` | `hire-data.js` (`window.HQ`) | `application/javascript` | 61,177 B | **Hire IQ Core Store & Logic** — Complete state store (`iq_hireiq_v2`), seed data, calculation algorithms, compliance gates (RR-H01 to RR-H07), cohort modelling, rate cards, and API mocks. |
| `50a956b5-33ea-4f15-a527-4d831ceff604` | `screen-data.js` (`window.IQ`) | `application/javascript` | 49,396 B | **Screen IQ Store** — Sister module state store (`iq_screeniq_v2`). |
| `root_template.html` | Root Entry Template | `text/html` | 54,433 B | Root HTML shell with typography, design tokens, login flow, module switcher, and global SVGs. |
| `082e69a8-e52a-478f-b376-cb31b82cc9e1` | Google Fonts CSS | `text/css` | 223,176 B | `@font-face` definitions for Instrument Sans (400, 500, 600, 700). |
| `c7c8e04d-9a65-420e-8aa6-91aa9d782a2a` | Font WOFF2 | `font/woff2` | 11,144 B | Instrument Sans Latin-ext font binary. |
| `7f3dd77a-3ab3-4562-935b-66c751ac5468` | Font WOFF2 | `font/woff2` | 30,092 B | Instrument Sans Latin font binary. |

---

### 2.2 Complete Hire IQ Screen & Component Inventory
Decompression of the manifest extracts 13 discrete `.dc.html` files representing the complete Hire IQ application surface:

| Component File | Role / Page | Size (Bytes) | Key Features & Sub-views |
|---|---|---|---|
| `HireIQ.dc.html` | Application Shell | 21,344 B | 232px sidebar navigation, module badge (Hire IQ, `#B7791F`), header with course switcher, breadcrumb path, alerts dropdown (6 alert types), settings menu, Copilot drawer (400px side panel), and floating toasts. |
| `HireDashboard.dc.html` | Dashboard | 30,899 B | Batch summary, 4 KPI cards (Enrolled vs Target, Cost per Enrolment, Intent Rate, Source Engagement), course health meter, campaigns table with status filters, needs-attention alerts, quick actions. |
| `HireCourseBrief.dc.html` | Course Brief | 37,591 B | Tabs: **Overview** (curriculum, eligibility, outcome claims, stipend details, intake targets), **Files** (source syllabus, brochure, consent forms), field confirmation status, source provenance badges (`From URL`, `From PDF`). |
| `HireNewCourse.dc.html` | New Course Dialog | 7,247 B | Modal dialog: Course title, registration link, primary language, start/batch date, input validation, and asynchronous simulated creation. |
| `HireCampaigns.dc.html` | Campaigns List | 11,108 B | Filter tabs (**Live**, **Draft**, **Completed**, **All**), search box, campaign cards with budget, targets, progress bars, and "New campaign" CTA. |
| `HireWizard.dc.html` | Campaign Creation Wizard | 206,486 B | **6-Step Wizard**: <br>• Step 0: Objective & Cohort (target enrolments, geographic market, eligibility criteria, student persona)<br>• Step 1: Narrative (4 angle cards, custom angle, hook editor, tone scoring)<br>• Step 2: Channels (allocation sliders, budget split, post volume, format mix)<br>• Step 3: Sources / Influencers (tier breakdown, shortlisting, commercial terms, fee negotiation, institutional consent checks)<br>• Step 4: Content (post briefs, script angles, key messages, hashtags, CTA links)<br>• Step 5: Review & Create (governance compliance checks RR-H01 to RR-H07, projected lift/enrolment predictions, draft save, campaign activation). |
| `HireCampaignPage.dc.html` | Campaign Detail Page | 75,677 B | Tabs: **Overview**, **Content & Posts**, **Checkpoints & Diagnosis**, **Cohort Breakdown**, **Insights**. Table and Kanban board views, live metrics, checkpoint verdicts (On track, Behind, Ahead), diagnostic agent runs. |
| `HireSourceDetail.dc.html` | Source Deal & Delivery Detail | 63,832 B | Individual creator/source modal & page: Source profile, why chosen, content plan approval, deal commercial terms, status pipeline, and live tracked post verification. |
| `HireCreatorBank.dc.html` | Creator / Source Bank | 32,706 B | Directory of 15+ student creators, alumni, faculty, and placement cells. Filters: Platform, Tier, Region, Language, Freshness. Bulk import modal (URLs or CSV). |
| `HireSourceProfile.dc.html` | Source Profile Page | 54,897 B | In-depth source dossier: Tabs for **Overview**, **Content**, **History**, **Commercials**, **Activity**. Profile enrichment refresh, rate-card comparison, verification badges. |
| `HireCopilot.dc.html` | Copilot AI Interface | 33,627 B | Conversational assistant rendered either as dedicated full page or 400px collapsible right drawer. Context scoping (Course, Campaign, Source), prompt suggestions, streaming response simulation, thinking steps, artifact generation. |
| `HireArtifacts.dc.html` | Artifacts / Files Library | 16,491 B | Central repository of generated media, briefs, carousel cards, and transcripts. Filter by format (Images, Documents, Videos), search, detail drawer, download/copy actions. |
| `HireSettings.dc.html` | Settings & Governance | 16,458 B | Tabs: **Connectors** (Resolence LMS, Meta, YouTube, LinkedIn, X status and expiration warnings), **Rate Card** (format and tier pricing matrices), **Profile**, **Notification preferences**. |

---

## 3. Architecture & Entry Points

### 3.1 Platform Entry & Module Switching
The prototype boots at `Influence IQ (4).html`:
1. **Authentication Stage (`isLogin = true`)**:
   - Initial route shows the platform sign-in form.
   - Pre-filled credential: `anika.rao@peopletech.com` (password: any string $\ge 6$ chars).
   - Login sets `window.IQ.s.user = { name: 'Anika Rao', email: 'anika.rao@peopletech.com', role: 'Manager', title: 'Campaign manager' }`.
2. **Module Selector (`isModule = true`)**:
   - User chooses between **Screen IQ** (Film Promotion) and **Hire IQ** (Skilling & Hiring).
   - Clicking "Open Hire IQ" sets `IQ.s.module = 'hire'`.
3. **Hire IQ Application (`isHire = true`)**:
   - Mounts `<dc-import name="HireIQ">`.
   - In `HireIQ.dc.html`, `window.HQ` is initialized from `hire-data.js` and synced with user authentication.
   - Initial view defaults to `HireDashboard.dc.html`.

### 3.2 State Management (`window.HQ`)
The state engine `HQ` manages:
- **`HQ.s.films`**: Array of courses (e.g., `Applied AI & ML Programme`, `Advanced Manufacturing Technician`).
- **`HQ.s.campaigns`**: Array of marketing campaigns with checkpoints, creator assignments (`ccs`), alerts, and drafts (`wiz`).
- **`HQ.s.creators`**: Directory of 15 sources/creators across YouTube, Instagram, LinkedIn, Facebook, and WhatsApp.
- **`HQ.s.connectors`**: Status of external integrations (Resolence LMS, Meta Graph API, YouTube Analytics).
- **`HQ.s.files`**: Course brochures, curriculum briefs, verification proofs.
- **`HQ.s.threads`**: Copilot conversational history.
- **`HQ.s.toasts`**: Temporary system feedback notices.
- **`HQ.s.route`**: Current navigation destination `{ name, id, tab, ... }`.

All changes invoke subscriber callbacks via `HQ.set(fn)` and `HQ.sub(cb)`.

---

## 4. Design System & Visual Tokens

The original prototype defines an explicit, premium design system in its CSS variables and styles:

### 4.1 Color Palette
- **Hire IQ Brand Hue**:
  - Primary Accent: `--hire: #B7791F` (Warm Ochre / Amber)
  - Light Tint Background: `--hire-tint: #FBF1DD`
  - Dark Accent Text: `--warning-800: #7A4F0F`
- **Neutrals / Ink Series**:
  - Base Background: `--ink-25: #F7FAF9`
  - Subtle Surface: `--ink-50: #EEF3F2`
  - Border Level 1: `--ink-100: #E1E8E7`
  - Border Level 2 / Dividers: `--ink-200: #CBD6D5`
  - Input Borders / Muted Text: `--ink-300: #A9B8B7`
  - Secondary Text: `--ink-500: #5B6E6E`
  - Primary Text: `--ink-900: #10242B`
  - Pure White Card Backgrounds: `#FFFFFF`
- **Teal / Interactive Series**:
  - Focus Ring: `--teal-500: #14B8A6` (`box-shadow: 0 0 0 3px rgba(20,184,166,.35)`)
  - Primary Button Fill: `--teal-700: #0F766E`
  - Button Hover Fill: `--teal-800: #0F5C54`
  - Active Nav Tint: `--teal-50: #F0FAF7`
  - Highlight Accent: `--teal-300: #5FD3C2`
- **Status & Feedback Badges**:
  - **Success / Passed**: Background `#E6F5EC`, Text `#14582F`, Border `#BFE3CE`
  - **Warning / Review**: Background `#FDF3DC`, Text `#7A4F0F`, Border `#F6E3B4`
  - **Danger / Failed / Refused**: Background `#FCE9E6`, Text `#8A241A`, Border `#F2C6BF`
  - **Info / Observed**: Background `#E6EFFA`, Text `#183F6E`, Border `#BDD5F2`

### 4.2 Typography
- **Font Family**: `"Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif`
- **Weights**: 400 (Regular), 500 (Medium), 600 (Semi-bold), 700 (Bold)
- **Features**: `font-feature-settings: "tnum" 1` (tabular numerals for data tables, metrics, and timestamps)

### 4.3 Elevation & Shadows
- `--e-1`: `0 1px 2px rgba(16,36,43,.06), 0 1px 3px rgba(16,36,43,.05)` (Cards, items)
- `--e-2`: `0 8px 24px rgba(16,36,43,.12), 0 2px 6px rgba(16,36,43,.06)` (Dropdowns, modals, popovers)
- `--e-3`: `0 24px 48px rgba(16,36,43,.18), 0 4px 12px rgba(16,36,43,.08)` (Dialog overlays)

### 4.4 Iconography
All icons are inline vector SVG symbols referenced via `<use href="#icon-id">`:
`#i-home`, `#i-mega`, `#i-chat`, `#i-folder`, `#i-users`, `#i-brief`, `#i-settings`, `#i-bell`, `#i-down`, `#i-right`, `#i-search`, `#i-check`, `#i-alert`, `#i-plus`, `#i-filter`, `#i-play`, `#i-image`, `#i-upload`, `#i-shield`, `#i-tag`, `#i-lock`, `#i-spark`, `#i-edit`, `#i-trash`, `#i-list`, `#i-board`, `#i-clock`, `#logo-mark`.

---

## 5. Prototype Data & Seed Inventory

### 5.1 Courses
1. **Course `f1`**: `"Applied AI & ML Programme"`
   - Language: Telugu
   - Cohort: Batch 4
   - Start Date: `2026-11-16`
   - Target Enrolments: 3,500 students
   - Stipend: ₹15,000/month during project phase
   - Fee: Zero tuition fees (funded under state skill mission)
   - Verified Claims: `85% placement rate` (Held under RR-H03 until evidence attached)
   - Governance Flags: Outcome claims (`Under review`), Institution endorsement (`Cleared`), Paid promotion (`Cleared`)
2. **Course `f2`**: `"Advanced Manufacturing Technician"`
   - Language: Telugu
   - Cohort: Batch 1
   - Start Date: `2027-01-11`
   - Status: Curriculum planning

### 5.2 Campaigns
1. **`k1` — Warangal engineering graduates**:
   - Status: `Live`
   - Course: Applied AI & ML Programme
   - Budget: ₹8,00,000 (Allocated: ₹6,80,000, Spent: ₹4,12,000)
   - Cohort: Engineering graduates 2023–2026, Tier-2/3 college technology aspirants
   - Checkpoints: 72 hours (`On track`), Day 7 (`On track`), Day 14 (`Behind`), Close (`Pending`)
   - Active Alerts: RR-H05 warning (low enrolment conversion vs clicks on meme pages), Scepticism flag ("Stipend nijamga istara?")
   - Assigned Sources: 9 sources (Tech Telugu Ravi, KITS Warangal Placement Cell, Sai Kiran Reddy, etc.)
2. **`k2` — Hyderabad final-year CSE students**:
   - Status: `Live`, Budget: ₹6,00,000, 5 creators, Checkpoints: `Ahead`.
3. **`k3` — Batch 3 alumni referral push**:
   - Status: `Closed`, Budget: ₹3,00,000, 4 creators, Outcome: Target achieved (112%).
4. **`k4` — Nalgonda and Khammam graduates**:
   - Status: `Draft`, Wizard Step 0 saved.

### 5.3 Creator & Source Bank (15 Entities)
- **Macro Creators**: Tech Telugu Ravi (`@techteluguravi`, YouTube, ₹1,20,000/video), Telangana Engineering Students (`fb.com/groups/tgengineers`, Facebook, ₹18,000/post).
- **Mid Tier**: Coding with Sravani (`@codingwithsravani`, Instagram Reels, ₹45,000/reel), Career Guru Telugu (`@careergurutelugu`, YouTube, ₹95,000).
- **Institutional / Network**: KITS Warangal Placement Cell (`KITS-W broadcast`, WhatsApp, Partnership/₹0), Warangal Youth Forum (WhatsApp/Mela, ₹0).
- **Alumni / Mentors**: Sai Kiran Reddy (`linkedin.com/in/saikiran-ml`, LinkedIn, ₹15,000/post), Prof. Lakshmi Narayana (Faculty lecture, ₹30,000).

---

## 6. Discovered Interactions & Governance Logic

### 6.1 Campaign Creation Wizard (6 Steps)
- **Step 0 — Objective & Cohort**: Target enrolments input, state/market selection (Telangana, Andhra Pradesh, etc.), qualification, eligibility criteria chips, persona description.
- **Step 1 — Narrative**: Angle selection among 4 AI-generated candidate cards (e.g., "From college project to first product engineer", "Zero fee, merit stipend"). Angle tone, key message, custom angle creation.
- **Step 2 — Channels**: Allocation sliders across YouTube Longform, Instagram Reels, LinkedIn Posts, WhatsApp Communities. Real-time budget allocation and volume calculation.
- **Step 3 — Influencers / Sources**: Candidate selection list with tier filters, institutional consent badges, fee negotiations, deliverable counts, and contract term specifications.
- **Step 4 — Content**: Content brief customization, mandatory disclosure `#ad` inclusion, syllabus talking points, prohibited claims (no salary guarantees).
- **Step 5 — Review & Create**: Comprehensive compliance audit against 7 governance rules, AI predictive enrolment lift projection (Optimistic, Expected, Conservative), draft save, and live deployment.

### 6.2 Governance Enforcement (RR-H01 to RR-H07)
1. **RR-H01 (Individual-Targeting Restriction)**: Blocks any cohort targeting an individual name or personal identifier.
2. **RR-H02 (Protected-Attribute & Fairness Restriction)**: Hard block if cohort filters or narrative angles reference caste, religion, gender exclusions ("men only", "women only") or disability.
3. **RR-H03 (Evidence for Outcome Claims)**: Flags placement rates (e.g., "85% placement rate") or starting salaries. Blocks narrative angle if supporting verification proof is not attached in Course Brief.
4. **RR-H04 (Paid-Content Disclosure)**: Enforces `#ad` or paid partnership disclosures on all sponsored deliverables; partnership/organic broadcast items are exempt.
5. **RR-H05 (Performance & Audience Mismatch)**: System warning raised during live monitoring if click-to-enrolment ratio falls below floor (e.g., high meme clicks with negligible applications).
6. **RR-H06 (Institutional Consent Requirement)**: Blocks shortlisting of placement cells or college network broadcasts unless signed institutional consent is on file.
7. **RR-H07 (Effectiveness / Lift-Claim Limitations)**: Warns against claiming causal "enrolment lift" without a controlled holdout district or cohort.

---

## 7. Reconstruction Technical Plan
The target application is implemented as a modern, clean, fully interactive React + Vite + CSS application that reproduces 100% of the UI, styling tokens, screens, sample records, and user interactions discovered in the source prototype.
No backend rewrite or mock server is required; all interactions, state mutations, and AI workflows run locally with full fidelity to the source.
