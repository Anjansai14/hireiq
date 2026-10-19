# HireIQ — REST API Reference Guide

> **Base URL**: `http://localhost:4000/api`  
> **Protocol**: HTTPS / JSON  
> **Authentication**: Bearer JWT token in the `Authorization` header (`Authorization: Bearer <token>`)

---

## 1. Authentication & Common Conventions

### Authentication Headers
All endpoints except `/auth/login` and `/health` require a valid JWT token:
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Standard Error Response Format
All error responses return standard HTTP error status codes and a consistent JSON error schema:
```json
{
  "error": "Human-readable explanation of error",
  "rule": "RR-H06",
  "checks": []
}
```

### Common Status Codes
- `200 OK`: Successful read or update.
- `201 Created`: Resource successfully created.
- `204 No Content`: Successful deletion (e.g. draft deleted).
- `400 Bad Request`: Invalid payload or missing parameters.
- `401 Unauthorized`: Token missing, expired, or invalid.
- `403 Forbidden`: Authenticated user lacks required role (e.g. Viewer attempting a mutation).
- `404 Not Found`: Target entity ID does not exist.
- `409 Conflict`: Business logic or governance block (e.g. course has a Refused governance flag).
- `422 Unprocessable Entity`: Governance pre-flight check failure.

---

## 2. Authentication Endpoints

### `POST /auth/login`
Authenticates a user by email and password, returning a JWT token and user profile.
- **Request Body**:
  ```json
  {
    "email": "anika.rao@peopletech.com",
    "password": "Hireiq@123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "u1",
      "name": "Anika Rao",
      "email": "anika.rao@peopletech.com",
      "role": "Manager",
      "title": "Campaign manager"
    }
  }
  ```

### `GET /auth/me`
Validates the current session token and returns current user details.

---

## 3. Configuration & Lookups

### `GET /lookups`
Returns all dynamic, database-driven lookups, options, channel priors, and governance rules.
- **Response (200 OK)**:
  ```json
  {
    "categories": {
      "district": [ ... ],
      "source_type": [ ... ],
      "skill_domain": [ ... ],
      "qualification": [ ... ]
    },
    "channel_priors": [ ... ],
    "governance_rules": [ ... ],
    "settings": { ... },
    "today": "2026-10-06"
  }
  ```

---

## 4. Course Brief Endpoints

### `GET /courses`
Lists all courses/programmes.
- **Query Parameters**: None.
- **Response (200 OK)**: Array of course objects including `id`, `title`, `batch`, `provider`, and `readiness` status.

### `GET /courses/:id`
Retrieves a complete course record with full brief, readiness checklist, flags, claims, reads, and files.

### `PATCH /courses/:id/form`
Updates brief form field values. Immediately re-syncs field confirmation states and clears unconfirmed tags.
- **Request Body**:
  ```json
  {
    "values": {
      "fee": "Zero tuition fee (government sponsored)",
      "target": "300"
    }
  }
  ```

### `POST /courses/:id/confirm`
Confirms brief fields, clearing the `From file` status so the field counts toward 9/9 readiness.
- **Request Body**:
  ```json
  {
    "keys": ["fee", "target"]
  }
  ```
  *(Pass an empty array `[]` to confirm all populated fields)*

### `POST /courses/:id/extract`
Uploads a course brochure/syllabus PDF or triggers sample brochure extraction via Agent A01.
- **Request (Multipart or JSON)**:
  ```json
  {
    "sample": true
  }
  ```

---

## 5. Campaign Wizard Endpoints

### `POST /campaigns`
Creates a new draft campaign in MySQL linked to a course.
- **Request Body**:
  ```json
  {
    "course_id": "f1",
    "name": "Warangal Engineering Graduates"
  }
  ```
- **Response (201 Created)**: Returns campaign object and initialized wizard state (`step: 0`).

### `GET /campaigns/:id/wizard`
Returns current wizard state, completed steps, needs-attention flags, and cached agent recommendations.

### `PATCH /campaigns/:id/wizard/objective`
Saves Step 0 fields (Objective, KPI, budget, targets, districts, qualifications, skill background).

### `POST /campaigns/:id/wizard/cohort`
Executes Agent A04 to calculate the aggregate cohort pool size and screen free-text notes for RR-H01/RR-H02 infractions.

### `POST /campaigns/:id/wizard/narratives`
Executes Agent A05 to generate 4 narrative recruitment angles.

### `POST /campaigns/:id/wizard/narratives/select`
Designates a narrative as Primary or Supporting.
- **Request Body**:
  ```json
  {
    "id": "narr_01"
  }
  ```

### `POST /campaigns/:id/wizard/channels`
Executes Agent A06 to recommend optimal channel prior allocation.

### `PATCH /campaigns/:id/wizard/channels`
Updates channel percentage shares (enforces sum equals 100%).

### `POST /campaigns/:id/wizard/rank`
Executes Agent A07 to rank Creator Bank sources and apply eligibility gates.

### `POST /campaigns/:id/wizard/portfolio`
Builds an auto-portfolio of the top 8 balanced sources matching the channel mix.

### `POST /campaigns/:id/wizard/content`
Executes Agent A08 to generate post copy, hooks, script beats, and `#ad` disclosures for shortlisted creators.

### `POST /campaigns/:id/wizard/review`
Executes Agent A09 (Enrolment Predictor) and Agent A10 (13 Governance Checks).

### `POST /campaigns/:id/wizard/create`
Freezes the prediction as Version 1 (`campaigns.pred_frozen`), schedules 4 checkpoints, sets status to `Live`, and activates the campaign in MySQL.

---

## 6. Live Campaign Management & Telemetry

### `GET /campaigns?course=:courseId`
Lists all campaigns filtered by course ID with active status filters (`Live`, `Draft`, `Closed`).

### `GET /campaigns/:id`
Retrieves detailed campaign telemetry, booked sources, funnel metrics, checkpoints, and alerts.

### `POST /campaigns/:id/insights/run`
Executes Agents A11 and A12 against latest telemetry. Assigns milestone verdicts (`Ahead`, `On track`, `Behind`) and generates costed move proposals.

### `POST /campaigns/:id/moves/:mid/accept`
Accepts a recommended diagnostic move and creates a new plan version in MySQL (`plan_versions`).

### `POST /campaigns/:id/close`
Closes an active campaign, records post-campaign learnings, and writes delivery ratings back to the Creator Bank.

### `GET /campaigns/:id/export?format=csv`
Streams an audit-ready CSV file of the campaign plan, booked creators, deal commercials, and attributed enrolments.

---

## 7. Creator Bank Endpoints

### `GET /sources`
Lists influence sources with multi-filter query support:
- `platform`: `YouTube`, `Instagram`, `WhatsApp`, `Campus`
- `tier`: `Nano`, `Micro`, `Mid`, `Macro`, `Mega`, `Institutional`
- `district`: `Warangal`, `Hyderabad`, `Karimnagar`, etc.
- `q`: Free-text search by creator handle or name.

### `POST /sources/import`
Uploads a partner sheet or Excel file (`.xlsx`, `.csv`) to bulk-ingest creators into MySQL.

---

## 8. Health & Observability

### `GET /health`
Returns connection health across database, backend, and AI service.
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "db": true,
    "ai": {
      "ok": true,
      "llm": true,
      "model": "claude-sonnet-5-5",
      "agents": 13
    }
  }
  ```
