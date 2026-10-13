# Hire IQ — Architecture

Hire IQ is the skilling-and-hiring module of **Influence IQ** (the sibling of Screen IQ).
It helps a programme team decide **which trusted sources carry which story to which cohort**,
plan a cohort micro-campaign in minutes, track every post to **screening enrolments**, and prove
what it delivered — with every number stamped **Observed / Inferred / Predicted**.

This codebase implements the Hire IQ prototype (`Influence_IQ (7).html`) end to end.

---

## 1. System overview

```
┌──────────────────────────┐   HTTPS/JSON   ┌───────────────────────────┐  JSON (stateless)  ┌──────────────────────────────┐
│  React frontend (Vite)   │ ─────────────▶ │  Node.js API (Express)    │ ─────────────────▶ │  Python AI service (FastAPI) │
│  frontend/               │   JWT bearer   │  backend/                 │  X-Service-Key     │  ai-service/                 │
│  · Dashboard · Brief     │ ◀───────────── │  · auth, RBAC             │ ◀───────────────── │  · Agents A1–A12 + Copilot   │
│  · Campaigns · Wizard    │                │  · courses / brief        │                    │  · governance screens        │
│  · Campaign detail       │                │  · wizard orchestration   │                    │  · Claude (optional) with    │
│  · Creator Bank          │                │  · live ops, attribution  │                    │    deterministic fallback    │
│  · Copilot · Artifacts   │                │  · copilot, files, jobs   │                    └──────────────┬───────────────┘
│  · Settings              │                └──────────┬────────────────┘                                   │
└──────────────────────────┘                           │ mysql2                                    Claude API (Anthropic)
                                                       ▼                                           YouTube Data API, Meta Graph
                                            ┌──────────────────────┐                                (official APIs only, A3)
                                            │  MySQL 8 / MariaDB   │
                                            │  database/schema.sql │◀── Resolence enrolment counts (CSV / API, daily)
                                            └──────────────────────┘
```

**Why three tiers**

| Tier | Owns | Why |
|---|---|---|
| React | UI only; every option list comes from `GET /api/lookups` | Nothing hard-coded: districts, statuses, objectives, deal types, questions… live in the DB |
| Node API | All persistence, business rules, RBAC, orchestration of agents, scheduled jobs | One place that writes to MySQL; agents can never write directly |
| Python AI | Reasoning only. **Stateless**: receives records + DB-driven settings, returns results | Easy to scale, test and swap models; runs fully offline without an API key |

## 2. Core domain

| Prototype term | Hire IQ entity | Table |
|---|---|---|
| Film | **Course** (one batch) | `courses`, `brief_fields`, `course_claims`, `governance_flags`, `course_reads` |
| Creator | **Influence source** (creator, college network, placement cell, alumnus, trainer, community leader) | `sources` + history / recent posts / snapshots / activity |
| Campaign | **Cohort campaign** — one cohort, one geography, one batch | `campaigns`, `campaign_narratives`, `campaign_channels` |
| Campaign creator | **Booked source** (`cc`) with deal, content, posts | `campaign_sources`, `content_items`, `posts`, `cc_log` |
| Box office | **Screening enrolments** from Resolence, per tracking tag | `enrolment_events` |
| Insights | Checkpoints, diagnosis, alerts, next moves, plan versions | `checkpoints`, `campaign_alerts`, `moves`, `plan_versions` |

Cohorts are **aggregate only**. No table stores an individual learner; Resolence sends counts per
tracking tag `hq-{campaign}-{source}-{n}`.

## 3. End-to-end flow

```
1 COURSE BRIEF         2 CAMPAIGN WIZARD (6 steps)                                   3 LIVE                     4 LEARN
─────────────          ───────────────────────────────────────────────────          ──────────                 ────────
New course             0 Objective & cohort ─ A4  (districts RM-05, size, Qs)        Source pipeline            Close campaign
Upload brochure ─ A1   1 Narrative ────────── A5  (8 candidates, RR-H03 hold)         Identified→…→Delivered     → source_history
Confirm fields         2 Channels ─────────── A6  (prior × behaviour × measurability) (RR-H06 consent gate)     → attributed enrolments
Governance:            3 Influencers ──────── A7  (gates → trust → quality → fit)     Content approve            → rate observations
 RR-H02 eligibility    4 Content ──────────── A8  (tracked link, #ad)                 (RR-H03, RR-H04)           → lessons / priors (RM-09)
 RR-H03 claims         5 Review & create ──── A9 predict + A10 13 checks              Posts + metrics
Programme reads ─ A2      └─ Create: freeze prediction v1, materialise plan            Resolence attribution
Creator Bank ─ A3                                                                     Insights: A11 + A12
                                                                                      Moves → plan v2, v3 …
                                                 Copilot (scoped to course/campaign) answers with sources, proposes actions
```

## 4. Governance built into the flow

| Rule | Enforced where | Effect |
|---|---|---|
| RR-H01 no individual targeting | Copilot, A4 cohort screen | Refused, logged to `fairness_escalations` |
| RR-H02 no protected attributes | Brief eligibility, A4, A5, Copilot | Refused / flag Refused (blocks create), escalated to fairness reviewer |
| RR-H03 outcome claims need Observed evidence | A1 extraction, brief outcome field, A5 (held narratives), A8, content approval, A10 | Held until evidence file is attached |
| RR-H04 disclosure on paid items | A8 adds `#ad`; content approval; A10 | Approval blocked otherwise |
| RR-H05 message/programme mismatch | A12 | Alert + cause + reallocation move |
| RR-H06 institutional consent | A7 gate, wizard shortlist, status → Confirmed | Blocked until consent recorded |
| RR-H07 lift claims need holdout | A4 question q3, A10 | Warning; report shows attribution only |

Rules, thresholds and option lists are rows in `governance_rules`, `app_settings`, `lookup_values`
and `channel_priors` — editable without a deploy.

## 5. Data sources (what data you need)

| Data | Source | How it arrives | Stamp |
|---|---|---|---|
| Course brief | Provider brochure / syllabus / course page | Upload → A1, then human confirm | Entered / From file |
| District graduate pools, qualification & band shares | AISHE / state skilling data (seed values are illustrative) | `lookup_values.meta` | Inferred |
| Source profiles: followers, median views, ER, audience geography, language | YouTube Data API, YouTube Analytics (creator-authorised), Meta Graph API | A3 monthly refresh | Observed |
| Institutional sources (placement cells, WhatsApp broadcasts) | Partner sheet upload, MoU / consent letters | CSV import + consent record | Uploaded |
| Deals, fees | Team records each booking | Deal form → `rate_observations` | Observed |
| Post metrics | Official APIs; manual for LinkedIn / WhatsApp | Post link + daily fetch / manual | Observed |
| Clicks, registrations, screening enrolments | **Resolence** per tracking tag | Daily CSV / API → `enrolment_events` → attribution | Observed |
| Comments | Platform APIs | → A11 classification | Inferred |
| Market research (demand, competitors) | Web search API + past comment themes | → A2 | Inferred |

No scraping; tokens encrypted at rest (AES-256-GCM, `connectors.secret_enc`).

## 6. Security & roles

* JWT auth; bcrypt passwords. Roles from `lookup_values.user_role`:
  **Admin** (config), **Manager** (campaigns), **Fairness reviewer** (escalations, flags), **Viewer** (read-only — enforced by middleware on every non-GET).
* AI service requires `X-Service-Key`; it is not exposed publicly.
* Every agent call is logged to `agent_runs` (agent, entity, duration, LLM used, errors).

## 7. Scheduled jobs (`backend/src/jobs/scheduler.js`, Asia/Kolkata)

| When | Job |
|---|---|
| 08:05 daily | Resolence attribution pass, flag sources past their post date |
| 09:00 daily | Checkpoint evaluation → A11 + A12 for campaigns with a checkpoint today |
| 02:00 on the 1st | Creator Bank refresh (A3) for overdue / failed / partial profiles |
| 07:00 daily | Connector token expiry check |

## 8. Deployment

`docker compose up` runs MySQL, the AI service and the API (which also serves the built React app).
See the root `README.md`. For production: put the API behind HTTPS, set strong `JWT_SECRET`,
`TOKEN_ENC_KEY`, `AI_SERVICE_KEY`, set `demo_today` to `null`, and point Resolence and the official API
connectors at real credentials.

## 9. Extending

* **New option / district / objective** → insert into `lookup_values` (Settings → Configuration shows them).
* **New agent** → add `ai-service/app/agents/aNN_*.py` with `AGENT` + `run(payload)`, register it in
  `agents/__init__.py`, call it from a Node service via `ai.runAgent('aNN', payload)`.
* **Swap the LLM** → `ai-service/app/llm.py` is the only place that talks to a model.
