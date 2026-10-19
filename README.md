# HireIQ — Skilling & Workforce Mobilization Micro-Campaign Platform

> **Module of the InfluenceIQ Platform**: Intelligent cohort campaign planning, source selection, and enrolment attribution for vocational and higher-education skilling programmes.

[![Frontend: React 18](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite-61dafb.svg)](frontend/)
[![Backend: Express](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-green.svg)](backend/)
[![AI Service: FastAPI](https://img.shields.io/badge/AI%20Service-Python%20%7C%20FastAPI-009688.svg)](ai-service/)
[![Database: MySQL 8.4](https://img.shields.io/badge/Database-MySQL%208.4-4479A1.svg)](database/)
[![Governance: RR--H01--H07](https://img.shields.io/badge/Governance-RR--H01..H07-E53E3E.svg)](docs/ARCHITECTURE.md#4-governance-built-into-the-flow)

---

## 1. Executive & Business Overview

### The Problem HireIQ Solves
In state-sponsored, subsidized, and institutional skilling initiatives (such as programmes backed by the Telangana Academy for Skill and Knowledge — TASK), traditional recruitment campaigns fail:
- **Broad ads waste budget**: Generic social media ads drive vanity clicks from unqualified audiences outside target districts.
- **Scepticism is high**: Prospective students and parents distrust unverified "100% placement" claims without evidence.
- **Attribution is broken**: Programme managers cannot identify which influencer, college network, or alumni post directly converted into a verified screening enrolment in the student management system (Resolence LMS).

### What HireIQ Does
HireIQ replaces blunt, blanket advertising with **hyper-targeted, compliance-governed micro-campaigns**. It enables programme teams to:
1. **Target by Aggregate Cohort**: Define precise cohorts by geography, education level, and skill background without capturing personal identifiable information (PII).
2. **Mobilize Trusted Local Voices**: Shortlist local nano/micro creators, college alumni, faculty placement cells, and WhatsApp community leaders whose audiences match the cohort.
3. **Enforce Ethical Governance**: Automatically hold unverified outcome claims, ensure fair representation, mandate `#ad` disclosure, and require institutional consent prior to booking.
4. **Prove Enrolment Impact**: Track every post to tracked Resolence LMS enrolment records with strict data provenance (**Observed**, **Inferred**, or **Predicted**).

### Primary Users
- **Campaign Managers** (e.g. Anika Rao): Plan cohort campaigns, set intake targets, allocate channel budgets, and approve creator deliverables.
- **Fairness & Governance Reviewers** (e.g. Meera Iyer): Review flagged claims, audit cohort non-discrimination rules (RR-H01/RR-H02), and approve institutional partnerships.
- **Programme Directors & Admins** (e.g. Vikram Shetty): Monitor intake progress, track cost-per-enrolment (CPE) against ceilings, and evaluate multi-channel ROI.

---

## 2. System Architecture & Data Flow

HireIQ is built on a resilient, three-tier decoupled architecture:

```
┌────────────────────────────────┐         HTTPS / JSON          ┌────────────────────────────────┐
│      React 18 / Vite SPA       │ ────────────────────────────▶ │     Node.js Express API        │
│       (Port 5173 / 4000)       │       Bearer JWT Auth         │          (Port 4000)           │
│                                │ ◀──────────────────────────── │                                │
│  · Dashboard & Brief           │                               │  · Authentication & RBAC       │
│  · 6-Step Campaign Wizard      │                               │  · Course Brief & Readiness    │
│  · Live Campaigns & Telemetry  │                               │  · Wizard Draft Orchestration  │
│  · Creator Bank & Profiles     │                               │  · Relational Data Store       │
│  · Copilot & Settings          │                               │  · Scheduled Ingestion Jobs    │
└────────────────────────────────┘                               └───────┬────────────────┬───────┘
                                                                         │                │
                                                   mysql2 Connection Pool│                │ HTTP JSON
                                                                         ▼                │ (X-Service-Key)
                                                         ┌───────────────────────┐        ▼
                                                         │   MySQL 8.4 Database  │ ┌──────────────────────────────┐
                                                         │       (Port 3306)     │ │   FastAPI Python AI Service  │
                                                         │                       │ │          (Port 8001)         │
                                                         │ · 28 Relational Tables│ │                              │
                                                         │ · DB-driven lookups   │ │ · 12 Specialized Agents      │
                                                         │ · Audit logs & events │ │ · Deterministic Fallbacks    │
                                                         │ · Plan snapshots (v1) │ │ · Anthropic Claude (Optional)│
                                                         └───────────────────────┘ └──────────────────────────────┘
```

### Core Architecture Principles
1. **Zero UI Hardcoding**: Every dropdown option, district boundary, objective weight, KPI, qualification, and threshold is dynamically loaded from the database via `GET /api/lookups`.
2. **Three-Tier Separation**:
   - **Frontend**: Renders the user experience; enforces UI validations; strictly consumes REST APIs.
   - **Backend API**: The single writer to MySQL. Enforces business logic, role-based access control (RBAC), and manages workflow state machines.
   - **AI Microservice**: Stateless reasoning engine. Receives records and configuration; returns calculations and copy. Operates offline using deterministic algorithms when no LLM API key is present.
3. **Data Provenance**: Every metric carries a provenance tag:
   - **Observed**: Hard data from platform APIs, LMS registration logs, or recorded bookings.
   - **Inferred**: Statistical models, demographic estimates, or sentiment analyses.
   - **Predicted**: Algorithmic forecasts frozen at campaign creation (Version 1).

---

## 3. Repository Structure

```
hireiq/
├── docs/                               # Comprehensive technical documentation
│   ├── ARCHITECTURE.md                 # System architecture, topology & governance
│   ├── AGENTS.md                       # Specifications for Agents A01–A12 & Copilot
│   ├── API.md                          # REST API specification & route contracts
│   ├── DATABASE.md                     # Schema documentation & entity relationships
│   ├── WORKFLOWS.md                    # Detailed step-by-step user journeys
│   ├── HIRE_IQ_SOURCE_ANALYSIS.md      # Prototype deconstruction & audit
│   ├── HIRE_IQ_VERIFICATION_REPORT.md  # Screen verification & UI parity evidence
│   └── screenshots/                    # Verified visual UI screen captures
├── database/                           # Database assets
│   ├── schema.sql                      # MySQL 8.4 schema (28 tables, DDL & indexes)
│   └── seed/                           # Seed datasets
│       ├── config_seed.json            # Dynamic lookups, rules, channel priors
│       ├── prototype_seed.json         # 455 sources, sample courses, and live telemetry
│       └── sample_brochure.txt         # Text brochure for Agent A1 extraction testing
├── backend/                            # Express.js REST API
│   ├── src/
│   │   ├── app.js                      # Express configuration & route middleware
│   │   ├── server.js                   # Server bootstrapper & port listener
│   │   ├── config.js                   # Environment variables & runtime constants
│   │   ├── db.js                       # MySQL2 connection pool & query helpers
│   │   ├── models/                     # Domain entity wrappers (Course, Campaign, Source)
│   │   ├── routes/                     # REST routes (auth, courses, campaigns, sources)
│   │   ├── services/                   # Business logic (wizardService, stats, copilot)
│   │   ├── middleware/                 # JWT authentication & read-only guard
│   │   ├── jobs/                       # Cron jobs (Resolence ingestion, metrics refresh)
│   │   └── utils/                      # Helper utilities & HTTP error classes
│   └── scripts/
│       ├── seed.js                     # Database seeding execution script
│       └── smoke.js                    # 29-step automated API smoke test suite
├── ai-service/                         # Python FastAPI AI Service
│   ├── app/
│   │   ├── main.py                     # FastAPI entrypoint (/v1/agents/{id})
│   │   ├── config.py                   # Service settings & API keys
│   │   ├── governance.py               # Algorithmic screening (RR-H01 to RR-H04)
│   │   ├── llm.py                      # Anthropic Claude client wrapper
│   │   ├── util.py                     # Mathematical utilities & scoring functions
│   │   └── agents/                     # Independent agent modules (A01 to A12 + Copilot)
│   └── tests/
│       └── test_agents.py              # Pytest test suite for all 12 agents
├── frontend/                           # React 18 Single-Page Application
│   ├── src/
│   │   ├── App.jsx                     # Root router & global authentication sync
│   │   ├── main.jsx                    # Application entry point
│   │   ├── screens/                    # Application screens (Dashboard, Wizard, Brief...)
│   │   ├── components/                 # Shell layout, navigation, modals, and icons
│   │   ├── data/hireData.js            # Frontend state client, store & math utilities
│   │   ├── hooks/useHQ.js              # Custom hook for reactive global state
│   │   └── lib/api.js                  # Axios/fetch API client with Bearer tokens
│   └── vite.config.js                  # Vite configuration & dev server proxy
├── scripts/                            # Operational & verification automation
│   ├── run_app.ps1                     # PowerShell one-click application launcher
│   └── verify_campaigns_e2e.js         # 15-step end-to-end integration test
├── docker-compose.yml                  # Container orchestration (db, ai, api)
├── .env.example                        # Template for environment configuration
└── Influence_IQ_prototype.html         # Authoritative visual and functional prototype
```

---

## 4. Quick Start Guide

### Option A: Running with Docker (Recommended)

1. **Clone and Configure**:
   ```bash
   cp .env.example .env
   ```
2. **Start the Multi-Container Cluster**:
   ```bash
   docker compose up --build
   ```
   *This starts MySQL (`hireiq-db-1`), FastAPI AI (`hireiq-ai-1`), and Express API (`hireiq-api-1`) with auto-seeding.*
3. **Launch the Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. **Access the Application**:
   - **Web App**: [http://localhost:5173](http://localhost:5173) (Vite Dev Server) or [http://localhost:4000](http://localhost:4000) (Production container bundle)
   - **Backend API**: [http://localhost:4000/api/health](http://localhost:4000/api/health)
   - **AI Service Docs**: [http://localhost:8001/docs](http://localhost:8001/docs)

---

### Option B: Running Locally (Bare Metal)

#### Prerequisites
- **Node.js**: v20.0.0 or higher
- **Python**: v3.11 or higher
- **MySQL**: MySQL 8.0+ or MariaDB 10.6+

#### Step 1: Database Setup
```sql
CREATE DATABASE hireiq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hireiq'@'localhost' IDENTIFIED BY 'hireiq';
GRANT ALL PRIVILEGES ON hireiq.* TO 'hireiq'@'localhost';
FLUSH PRIVILEGES;
```

#### Step 2: Start the AI Service (Terminal 1)
```bash
cd ai-service
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --port 8001
```

#### Step 3: Seed and Start the Backend API (Terminal 2)
```bash
cd backend
npm install
cp .env.example .env
npm run seed     # Applies schema.sql, config_seed.json, and prototype_seed.json
npm run dev      # Runs Express on port 4000
```

#### Step 4: Start the Frontend (Terminal 3)
```bash
cd frontend
npm install
npm run dev      # Runs Vite dev server on port 5173
```

---

## 5. Pre-Seeded Demonstration Accounts

All accounts share the default development password: `Hireiq@123`

| Name | Email | Role | Permissions |
| :--- | :--- | :--- | :--- |
| **Anika Rao** | `anika.rao@peopletech.com` | Manager | Full access to create courses, plan campaigns, and approve deals. |
| **Vikram Shetty** | `vikram.shetty@peopletech.com` | Admin | Full platform administration, connector keys, and lookup table editing. |
| **Meera Iyer** | `meera.iyer@peopletech.com` | Fairness Reviewer | Audits governance alerts, resolves holds, and approves institutional MoUs. |
| **Divya K** | `divya.k@peopletech.com` | Manager | Secondary programme manager account. |
| **External Auditor** | `reports@nexaskills.org` | Viewer | Read-only access across all dashboards, metrics, and plan exports. |

---

## 6. Testing & Quality Verification

All test suites execute against the live system and verify end-to-end correctness without mock stubs.

### 1. End-to-End Campaign Workflow Test (15 Steps)
Verifies login, course brief readiness, 6-step campaign creation, agent orchestration, MySQL persistence, and telemetry:
```bash
node scripts/verify_campaigns_e2e.js
```
*Expected result: 15/15 verification checks passing (100%).*

### 2. Backend Smoke Test Suite (29 Steps)
Runs full API coverage including auth, brief extraction, governance refusal, channel priors, creator gating, and plan freeze:
```bash
cd backend
npm test
```
*Expected result: 29 passed, 0 failed.*

### 3. AI Service Agent Unit Tests (13 Tests)
Validates individual reasoning modules for Agents A01–A12 and Copilot:
```bash
cd ai-service
pytest tests/test_agents.py
```
*Expected result: 13 passed in ~0.15s.*

### 4. Frontend Production Build Check
```bash
cd frontend
npm run build
```
*Expected result: Vite build succeeds with exit code 0.*

---

## 7. Configuration & Environment Variables

Configuration is handled via `.env` files. Use `.env.example` as a baseline:

```ini
# =====================================================================
# AI Service Configuration
# =====================================================================
# Leave ANTHROPIC_API_KEY blank to run in deterministic rule-based fallback mode
ANTHROPIC_API_KEY=
LLM_MODEL=claude-sonnet-5-5
AI_SERVICE_KEY=generate_a_secure_random_ai_service_token_here

# =====================================================================
# Security & Token Encryption
# =====================================================================
JWT_SECRET=generate_a_strong_random_jwt_secret_at_least_64_characters_here
# 32-byte hex key used to encrypt external connector tokens at rest (AES-256-GCM)
TOKEN_ENC_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# =====================================================================
# Optional External API Keys (Used by Agent A03 & Social Fetchers)
# =====================================================================
YOUTUBE_API_KEY=
```

---

## 8. Implementation Status & Limitations

### Working and Fully Verified
- **Authentication**: JWT bearer token issuance, password bcrypt hashing, role enforcement (`Manager`, `Admin`, `Fairness reviewer`, `Viewer`).
- **Course Brief**: 9-field readiness checklist confirmation, document extraction, and persistence in `brief_fields` and `courses`.
- **Campaign Wizard (Steps 0–5)**:
  - Step 0: Objective, KPI, budget, qualification, skill background, and Agent A4 cohort sizing.
  - Step 1: Agent A5 narrative generation, claim hold tags, custom narrative addition, and primary narrative selection.
  - Step 2: Agent A6 channel allocation with interactive 100% sum validation.
  - Step 3: Agent A7 ranking and reliability gating (1,000-follower rule, activity, consent). Auto-portfolio generation.
  - Step 4: Agent A8 personalized content copy, hook creation, and mandatory `#ad` disclosure.
  - Step 5: Agent A9 prediction interval, Agent A10 13-rule compliance verification, and MySQL plan freezing (Version 1).
- **Campaign Detail & Insights**: Checkpoint tracking (72h, Day 7, Day 14), telemetry verdict assignment ("On track", "Behind"), moves acceptance, and CSV plan exports.
- **Creator Bank**: Search, multi-filtering (platform, tier, district, language, skill), and Excel/sheet bulk ingestion.

### Known Limitations & Future Work
- **Artifacts Library**: The UI currently demonstrates generated cards, PDFs, and MP4 cuts using synthetic client-side objects. File upload and direct binary streaming from `backend/uploads/` via `/api/files` will be wired in Phase 2.
- **Copilot Real-time Streaming**: Copilot uses standard REST JSON requests (`POST /api/copilot/chat`) rather than Server-Sent Events (SSE).
- **External Social APIs**: Live YouTube and Meta Graph API calls fall back to synthetic telemetry when live API keys are not supplied.

---

## 9. Security & Governance Standards

1. **Non-Discrimination & Fairness (RR-H01 / RR-H02)**: Free-text inputs in the course brief, wizard notes, and Copilot prompts are screened against prohibited protected characteristics (caste, religion, gender-exclusion). Infractions are immediately refused and logged to `fairness_escalations`.
2. **Outcome Claim Verification (RR-H03)**: Any placement or salary claim (e.g., "85% placement rate") is automatically held until an audit document or MoU is attached to the course brief.
3. **Mandatory Disclosure (RR-H04)**: All generated post drafts automatically include `#ad` and `#sponsored` tags. Content approval is blocked if disclosures are removed.
4. **Institutional Consent (RR-H06)**: Institutional placement cells, college networks, and student groups cannot be moved to "Confirmed" status until written consent and date of consent are recorded.
5. **Secret Encryption**: Connector secrets and API keys are encrypted at rest using AES-256-GCM via `TOKEN_ENC_KEY`.

---

## 10. Technical Documentation Index

For in-depth architectural and developer documentation, consult the following guides:
- [System Architecture & Governance (`docs/ARCHITECTURE.md`)](docs/ARCHITECTURE.md)
- [AI Agents & Mathematical Specifications (`docs/AGENTS.md`)](docs/AGENTS.md)
- [REST API Endpoint Directory (`docs/API.md`)](docs/API.md)
- [Database Schema & Entity Guide (`docs/DATABASE.md`)](docs/DATABASE.md)
- [User Workflows & Operational Lifecycles (`docs/WORKFLOWS.md`)](docs/WORKFLOWS.md)
- [Verification Evidence & Parity Report (`docs/HIRE_IQ_VERIFICATION_REPORT.md`)](docs/HIRE_IQ_VERIFICATION_REPORT.md)
