# Hire IQ — AI agents

The prototype names agents **A4–A11** in the campaign wizard and insights. **A1–A3 and A12** are
the remaining jobs the prototype shows (reading brochures, programme reads, Creator Bank enrichment,
diagnosis & moves) given their own agent numbers here.

All agents live in `ai-service/app/agents/`, expose `run(payload) -> dict`, and are called by the Node
backend at `POST /v1/agents/{id}`. Every agent has a **deterministic fallback**, so the platform works
without an API key; with `ANTHROPIC_API_KEY` set, the agents marked *LLM* use Claude for language work while
scores, gates, predictions and checks stay rule-based and auditable.

| ID | Agent | Kind | Input → Output | Where it runs |
|---|---|---|---|---|
| A1 | **Brief Extractor** | LLM + rules | brochure PDF/text → brief values tagged *From file*, outcome claims held (RR-H03), eligibility screen (RR-H02) | Course brief → Upload |
| A2 | **Programme Reads** | LLM + research | course + evidence → 3 reads (demand, competitors, risks), each item stamped | Dashboard → Run Agent A2 |
| A3 | **Source Enrichment** | official APIs + rules | source → followers, tier, tone, Enriched/Partial/Failed | Creator Bank refresh, monthly job |
| A4 | **Objective & Cohort** | rules | campaign + lookups → normalised districts (RM-05), cohort size vs minimum, up to 3 questions, RR-H01/H02 refusal | Wizard step 0 |
| A5 | **Narrative Generator** | LLM + scoring | cohort + brief + evidence → 8 candidates over narrative classes, scored, held if they lean on an unevidenced claim | Wizard step 1 (+ Rewrite) |
| A6 | **Channel Planner** | rules (+LLM reasons) | objective prior × cohort behaviour × measurability → channel shares (sum 100, own page locked 10%) | Wizard step 2 |
| A7 | **Source Ranker** | rules | 6 stages: pool → gates → trust & reach → quality → fit → portfolio within budget | Wizard step 3, Creator Bank gate preview, Copilot |
| A8 | **Content Studio** | LLM + checks | source + narrative → content per post: hook, beats, caption in source language, tracked link, `#ad` | Wizard step 4 (+ Rewrite) |
| A9 | **Predictor** | model | shortlist → reach / clicks / registrations / enrolments ranges, overlap discount, CPI; frozen at create | Wizard step 5 |
| A10 | **Compliance & Fairness Gate** | rules | 13 checks; any Fail blocks Create | Wizard step 5 |
| A11 | **Listening & Sentiment** | LLM + rules | comments → language, translation, sentiment, theme, intent; theme shares; Scepticism alert; summary | Insights |
| A12 | **Diagnosis & Next Moves** | rules + LLM narration | frozen prediction vs actual → verdict, checkpoint verdicts, causes with shares, RR-H05 alerts, costed moves | Insights, 09:00 checkpoint job |
| COP | **Copilot** | orchestrator | message + scoped context → answer with sources, optional proposal (accept move, add source, save artifact); refuses RR-H01/H02 | Copilot page |

## Key formulas

**A7 score** `trust^w0 · (log10(qualified_reach+10)/6)^w1 · quality^w2 · fit^w3 · (reliability+0.1)^w4`
with weights per objective (`lookup_values.objective.meta.rank_weights`).

* trust = 0.25 + 0.30 (anchor type) + 0.20 (college network) + min(0.25, attributed/250) + 0.2 × audience share in cohort districts
* qualified reach = (catchment | followers) × share in cohort districts × share in cohort languages
* quality = min(1.6, ER / tier median ER)
* gates (from `app_settings.gates`): backed out ≥2 of last 3 · institutional without consent (RR-H06) · < 1,000 followers · contested verification · no post in 60 days

**A9 prediction per source**
`reach = (median views | catchment × 0.55) × posts × cohort-district share` →
`clicks = reach × CTR(platform/type)` → `regs = clicks × reg rate` → `enrols = regs × enrol rate`
(rates from `app_settings.funnel_defaults`), lo/hi band ×0.6 / ×1.45, overlap discount 5% per extra source (cap 30%).

**A12 expected band at day t** `pred × (t / T)^0.8` → Ahead / On track / Behind.

## Calling an agent directly

```bash
curl -X POST localhost:8001/v1/agents/a6 -H 'X-Service-Key: change-me' -H 'Content-Type: application/json' \
  -d '{"campaign":{"objective":"Getting onboarded","qual":"ITI"},"channel_priors":{...}}'
```

Tests: `cd ai-service && python -m pytest -q` (runs every agent against the prototype data).
