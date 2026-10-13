..... HEAD
# Hire IQ — Influence IQ skilling & hiring module

Plan cohort micro-campaigns that drive **screening enrolments** for skilling programmes: pick the
trusted sources (creators, college networks, placement cells, alumni, trainers, community leaders)
that carry the right story to the right cohort, track every post to enrolments, and prove the result.
Built from the Hire IQ prototype. React + Node.js + MySQL + a Python service with 12 AI agents and a Copilot.

```
hireiq/
├── docs/                    architecture, API endpoints, agent design, reports & screenshots
│   ├── ARCHITECTURE.md      system design, flows, governance, data sources, deployment
│   ├── AGENTS.md            the 12 agents + Copilot, formulas, inputs/outputs
│   ├── API.md               every REST endpoint
│   ├── HIRE_IQ_SOURCE_ANALYSIS.md
│   ├── HIRE_IQ_VERIFICATION_REPORT.md
│   └── screenshots/         UI screens and visual reference captures
├── database/                MySQL schema & seed data
│   ├── schema.sql           MySQL 8 schema (38 tables, commented)
│   └── seed/
│       ├── config_seed.json      ALL options, thresholds, rules, channel priors (DB-driven)
│       ├── prototype_seed.json   courses, Creator Bank, campaigns, posts
│       └── sample_brochure.txt   used by "Use sample brochure"
├── ai-service/              Python FastAPI · stateless agents
│   ├── app/main.py          /v1/agents/{a1..a12,cop}, /v1/governance/screen
│   ├── app/llm.py           Claude wrapper (optional; deterministic fallback)
│   ├── app/governance.py    RR-H01/H02/H03/H04 screens
│   ├── app/agents/          a01_brief_extractor … a12_diagnosis, copilot
│   └── tests/test_agents.py
├── backend/                 Node.js Express API
│   ├── src/models/          domain models (Campaign, Course, Source, Governance, RateCard)
│   ├── src/routes/          auth, courses, campaigns, sources, lookups, settings, files, metrics
│   ├── src/services/        settings, repo, stats, wizardService, campaignService, copilotService
│   ├── src/jobs/            daily attribution, checkpoints, monthly Creator Bank refresh
│   └── scripts/             seed.js, smoke.js (29-step end-to-end test), start.sh
├── frontend/                React (Vite)
│   ├── src/screens/         Login, Dashboard, CourseBrief, Campaigns, CampaignWizard,
│   │                        CampaignDetail, SourceDetail, CreatorBank, SourceProfile, Copilot, Artifacts, Settings
│   ├── src/components/      shared UI, layout, Shell navigation
│   └── src/hooks/           useHQ state & API hooks
├── scripts/                 automation scripts (run_app.ps1, inspect, tools)
└── docker-compose.yml       multi-container orchestration (db, ai, api/web)
```

## Run with Docker

```bash
cp .env.example .env          # optionally add ANTHROPIC_API_KEY
docker compose up --build
# open http://localhost:4000  ·  anika.rao@peopletech.com / Hireiq@123
```

## Run locally (Windows / macOS / Linux)

Prerequisites: Node 20+, Python 3.11+, MySQL 8 (or MariaDB 10.6+).

```bash
# 1. Database user
mysql -uroot -p -e "CREATE USER 'hireiq'@'localhost' IDENTIFIED BY 'hireiq'; GRANT ALL ON hireiq.* TO 'hireiq'@'localhost';"

# 2. AI service (terminal 1)
cd ai-service
python -m venv .venv && .venv\Scripts\activate        # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env                                   # set ANTHROPIC_API_KEY to enable Claude (optional)
uvicorn app.main:app --port 8001 --env-file .env

# 3. API (terminal 2)
cd backend
npm install
copy .env.example .env                                   # adjust DB_* if needed
npm run seed                                             # creates schema + loads config + prototype data
npm run dev                                              # http://localhost:4000

# 4. Frontend (terminal 3)
cd frontend
npm install
npm run dev                                              # http://localhost:5173 (proxies /api to :4000)
```

Seeded users (password `Hireiq@123`): Anika Rao (Manager), Vikram Shetty (Admin), Divya K (Manager),
Meera Iyer (Fairness reviewer), reports@nexaskills.org (Viewer).

## Verify

```bash
cd ai-service && python -m pytest -q        # 9 agent tests on prototype data
cd backend && npm test                      # 29-step end-to-end smoke test (API + AI service running, freshly seeded)
```

## Configuration lives in the database

Districts, source types (and which are institutional / anchors), statuses, objectives (with narrative
preferences and ranking weights), KPIs, qualifications, bands, deal types, payment terms, tiers, wizard
questions, brief fields, governance rules, channel priors and every threshold (minimum cohort size,
enrolment-rate floor, scepticism threshold, gates, checkpoints, funnel priors) are rows in
`lookup_values`, `channel_priors`, `governance_rules` and `app_settings`. The UI reads them from
`GET /api/lookups`; Settings → Configuration shows them all.

`app_settings.demo_today` is set to `2026-10-06` so the seeded campaigns look exactly like the prototype.
Set it to `null` for real dates.

## What still needs real-world inputs

* Replace illustrative district graduate pools / qualification shares (`lookup_values.meta`) with official data.
* Connect Resolence (daily API pull at the hook in `jobs/scheduler.js`, or CSV upload at `POST /api/metrics/resolence`).
* Add YouTube / Meta credentials for Agent A3 and post metrics; LinkedIn and WhatsApp stay manual/upload in v1.
* Agent A2 should be given web-search results (search API) for fresh competitor reads.
=======
# hireiq
>>>>>>> ad0147cc3c62e325a8bf802f75654d52607e690a
