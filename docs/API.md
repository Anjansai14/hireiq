# Hire IQ — REST API (Node backend)

Base `/api`. All routes except `/auth/login` and `/health` need `Authorization: Bearer <jwt>`.
Viewer role is read-only. Errors: `{ "error": "...", "rule"?: "RR-H06", "checks"?: [...] }`.

## Auth & config
| Method | Path | Notes |
|---|---|---|
| POST | /auth/login | `{email, password}` → `{token, user}` |
| GET | /auth/me | current user |
| GET | /lookups | all DB-driven options, settings, channel priors, rules, `today` |
| POST / DELETE | /lookups/:category[/:code] | Admin |
| PUT | /lookups/settings/:key | Admin, `{value}` |

## Courses
| Method | Path | Agent |
|---|---|---|
| GET / POST | /courses | list / create (`{title, link, language, batch_start}`) |
| GET | /courses/:id | full brief, readiness, claims, flags, reads, files |
| PATCH | /courses/:id/form | `{values:{field: value}}` → re-syncs readiness + governance |
| POST | /courses/:id/confirm | `{keys?}` confirm From-file values |
| POST | /courses/:id/extract | multipart `file` or `{sample:true}` | A1 |
| POST | /courses/:id/reads/run | | A2 |
| POST | /courses/:id/claims/:cid/evidence | multipart evidence file (RR-H03) |
| PATCH | /courses/:id/flags/:fid | Admin / Fairness reviewer |
| GET | /courses/:id/alerts · /dashboard | needs-attention list · dashboard aggregate |

## Campaign wizard (draft)
| Method | Path | Agent |
|---|---|---|
| POST | /campaigns | `{course_id, name}` new draft |
| GET | /campaigns/:id/wizard | draft state |
| PATCH | /campaigns/:id/wizard/objective | step 0 fields + `answers` |
| POST | /campaigns/:id/wizard/cohort | A4 |
| POST | /campaigns/:id/wizard/narratives | A5 `{instruction?}` |
| POST | /campaigns/:id/wizard/narratives/select · /own | |
| POST / PATCH | /campaigns/:id/wizard/channels | A6 / edit shares |
| POST | /campaigns/:id/wizard/rank | A7 |
| POST | /campaigns/:id/wizard/portfolio | A7 portfolio → shortlist |
| POST | /campaigns/:id/wizard/shortlist | `{source_id, posts, fee, deal_type, consent_basis?, consent_date?, remove?}` |
| POST | /campaigns/:id/wizard/content | A8 `{source_id?, instruction?}` |
| POST | /campaigns/:id/wizard/content/select | `{source_id, sel:[variantIds]}` |
| POST | /campaigns/:id/wizard/review | A9 + A10 |
| POST | /campaigns/:id/wizard/create | freeze prediction v1, go Live (422 with checks if any Fail) |

## Live campaigns
| Method | Path | Notes |
|---|---|---|
| GET | /campaigns?course= · /campaigns/:id | list · full detail with stats + series |
| DELETE | /campaigns/:id | drafts only |
| POST | /campaigns/:id/sources | add source (Identified) |
| PATCH | /campaigns/:id/sources/:ccId/status | `{status, reason?}` — RR-H06 enforced |
| PATCH | /campaigns/:id/sources/:ccId/deal | deal fields |
| PATCH | /campaigns/:id/sources/:ccId/content/:ciId | `{status}` — RR-H03/H04 enforced |
| POST | /campaigns/:id/sources/:ccId/posts | post link + metrics |
| POST | /campaigns/:id/comments | `{comments:[{text, source_id}]}` |
| POST | /campaigns/:id/insights/run | A11 + A12 |
| POST | /campaigns/:id/moves/:mid/accept · dismiss | accept → plan version +1 |
| POST | /campaigns/:id/close | `{lessons:[]}` writes back to Creator Bank |
| GET | /campaigns/:id/export?format=csv | plan export |

## Creator Bank, metrics, copilot, settings
| Method | Path | Notes |
|---|---|---|
| GET / POST | /sources | filters `q, platform, type, status, filter=attention`; includes gate preview |
| GET / PATCH | /sources/:id | |
| POST | /sources/:id/consent | `{basis, date}` (RR-H06) |
| POST | /sources/:id/refresh · /sources/refresh-failed | A3 |
| POST | /sources/import | CSV |
| POST | /metrics/resolence | `{rows:[{tracking_tag,date,clicks,regs,enrols}]}` or CSV → attribution |
| GET / POST | /copilot/threads | `{course_id, scope_type, scope_id}` |
| POST | /copilot/threads/:id/messages | `{text}` → Copilot |
| POST | /copilot/messages/:mid/accept · discard | execute proposal |
| GET | /settings/connectors · /ratecard · /team · /escalations | |
| POST | /settings/connectors/:id/connect · disconnect · test | token encrypted at rest |
| GET / POST / DELETE | /files | artifacts |
| GET | /agents · /agents/runs | AI health + agent list · run log |
