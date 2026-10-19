# HireIQ — AI Agents & Mathematical Specifications

> **AI Architecture**: 12 Specialized Reasoning Agents + Copilot Orchestrator  
> **Service Layer**: Python FastAPI running on port 8001  
> **Execution Mode**: Dual-Mode (Anthropic Claude 3.5 Sonnet when `ANTHROPIC_API_KEY` is present; deterministic rule-based algorithms as fallback)

---

## 1. Agent Directory & Overview

All agents are stateless Python modules located under [`ai-service/app/agents/`](../ai-service/app/agents/). The Node.js Express backend communicates with the AI service over HTTP via `POST /v1/agents/{agent_id}` using a shared secret header (`X-Service-Key`).

| Agent ID | Name | Role | Primary Logic | Fallback Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **A01** | **Brief Extractor** | Parses brochures/syllabi into structured brief fields | LLM semantic extraction + PDF parsing | Regex key-value extraction & standard defaults |
| **A02** | **Programme Reads** | Synthesizes cohort demand, competitors & risks | LLM market analysis + web search grounding | Historical regional skilling heuristics |
| **A03** | **Source Enrichment** | Enriches influencer metrics & engagement | Official APIs (YouTube Data / Meta Graph) | Historical synthetic seed metrics |
| **A04** | **Cohort Sizing** | Sizes addressable learner pool | Demographic factor multiplication | Formula based on district graduate baseline |
| **A05** | **Narratives** | Generates tailored recruitment angles | LLM creative copywriting + tone scoring | 4 rule-based demographic narrative angles |
| **A06** | **Channel Planner** | Optimizes budget split across 7 channels | Bayesian objective priors × ITI multipliers | Deterministic normalized channel priors |
| **A07** | **Source Ranker** | Ranks and gates Creator Bank sources | Multi-factor weighted geometric mean | Formula ranking + 6 reliability gates |
| **A08** | **Content Studio** | Generates platform post concepts & scripts | LLM multi-lingual copywriting | Template-based localized post formats |
| **A09** | **Predictor** | Forecasts reach, clicks & enrolments | Funnel decay model with overlap discount | Parametric funnel simulation |
| **A10** | **Compliance** | Evaluates 13 governance & fairness checks | Deterministic rule verification | Complete deterministic 13-rule check suite |
| **A11** | **Social Listening** | Analyzes comments for sentiment & intent | LLM classification + sentiment parsing | Keyword lexicon & intent rule matching |
| **A12** | **Diagnosis** | Evaluates checkpoint performance & moves | Time-decay trajectory comparison | Empirical pacing curve comparison |
| **COP** | **Copilot** | Contextual conversational assistant | LLM grounded in course/campaign state | Contextual rule-based retrieval & actions |

---

## 2. Mathematical Specifications & Core Algorithms

### 2.1 Agent A04 — Cohort Sizing Formula
Agent A04 estimates the addressable student pool based on geographical markets, qualifications, age, experience, and skill background:

$$\text{Cohort Size} = \left( \sum_{m \in \text{Markets}} \text{Pool}(m) \right) \times Q_{\text{factor}} \times A_{\text{factor}} \times E_{\text{factor}} \times S_{\text{multiplier}}$$

- **Baseline Market Pool $\text{Pool}(m)$**: Inferred from district graduate statistics (e.g. Warangal = 18,000, Hyderabad = 45,000).
- **Qualification Factor $Q_{\text{factor}}$**: `B.Tech final year` = 0.35, `B.Tech graduate` = 1.0, `Diploma` = 0.45, `ITI` = 0.50.
- **Skill Background Multiplier $S_{\text{multiplier}}$**: Scales from 0.35 up to 1.0 based on relevant engineering or vocational domains selected.
- **Minimum Threshold Gate**: If the estimated size is $< 500$ learners, rule **RR-H02** raises a warning or refusal to avoid non-viable micro-targeting.

---

### 2.2 Agent A07 — Source Ranking & Scoring Formula
Agent A07 ranks candidate sources from the Creator Bank using a weighted geometric mean that balances trust, reach, content quality, cohort fit, and historical reliability:

$$\text{Score} = \text{Trust}^{w_0} \times \left( \frac{\log_{10}(\text{Qualified Reach} + 10)}{6} \right)^{w_1} \times \text{Quality}^{w_2} \times \text{Fit}^{w_3} \times (\text{Reliability} + 0.1)^{w_4}$$

Where the weights $(w_0, w_1, w_2, w_3, w_4)$ are dynamically loaded from `lookup_values` based on the campaign objective:
- **Trust**: Base $0.25$ + $0.30$ for anchor channels + $0.20$ for verified college networks + $\min(0.25, \text{Attributed Enrolments} / 250)$.
- **Qualified Reach**: $(\text{Followers} \text{ or } \text{Catchment}) \times \text{Share in Cohort Districts} \times \text{Share in Cohort Languages}$.
- **Quality**: Ratio of creator engagement rate to their tier median engagement rate: $\min(1.6, \text{ER} / \text{Median ER}_{\text{tier}})$.
- **Reliability Gates**:
  1. $\ge 1,000$ followers.
  2. Active within the last 60 days.
  3. Institutional consent recorded on file (RR-H06).
  4. Delivery history (cannot have backed out of $\ge 2$ of last 3 bookings).

---

### 2.3 Agent A09 — Enrolment Prediction Funnel
Agent A09 projects expected performance through a multi-stage funnel model:

1. **Gross Potential Reach**:
   $$\text{Reach}_i = (\text{Median Views}_i \text{ or } \text{Catchment}_i \times 0.55) \times \text{Posts}_i \times \text{District Share}_i$$
2. **Overlap Discount Factor**:
   $$\text{Discount} = \min(0.30, 0.05 \times (\text{Shortlist Count} - 1))$$
   $$\text{Net Reach} = \left(\sum \text{Reach}_i\right) \times (1 - \text{Discount})$$
3. **Conversion Intervals**:
   - $\text{Clicks} = \text{Net Reach} \times \text{CTR}_{\text{platform}}$
   - $\text{Registrations} = \text{Clicks} \times \text{Reg Rate}_{\text{channel}}$
   - $\text{Screening Enrolments} = \text{Registrations} \times \text{Enrolment Rate}$
4. **Uncertainty Interval**: Bounded by a parametric interval of $[-40\%, +45\%]$ to provide realistic confidence bands.

---

### 2.4 Agent A12 — Trajectory & Checkpoint Pacing
At milestones ($t = \text{72h, Day 7, Day 14, Close}$), Agent A12 evaluates actual performance against the non-linear time-decay trajectory:

$$\text{Expected Enrolments}(t) = \text{Prediction}_{\text{frozen}} \times \left( \frac{t}{T} \right)^{0.8}$$

- **Verdict Logic**:
  - $\text{Actual} \ge 1.15 \times \text{Expected}$: **Ahead**
  - $0.85 \times \text{Expected} \le \text{Actual} < 1.15 \times \text{Expected}$: **On track**
  - $\text{Actual} < 0.85 \times \text{Expected}$: **Behind** (Triggers diagnostic root causes and recommended moves)

---

## 3. Governance Enforcement Standards

Every agent operates under the supervision of the 7 core InfluenceIQ governance rules:

- **RR-H01 (No Individual Learner Targeting)**: Tested by Agent A04 and Copilot. Any prompt attempting to identify single individuals is refused.
- **RR-H02 (No Discriminatory Criteria)**: Eligibility and cohort screening block exclusion by gender, religion, or caste.
- **RR-H03 (Evidence Requirement for Claims)**: Agent A01 flags outcome claims ("85% placement"); Agent A05 holds narratives relying on unverified claims.
- **RR-H04 (Commercial Disclosure)**: Agent A08 injects `#ad` and `#sponsored` tags into all commercial post concepts.
- **RR-H05 (Message/Programme Realignment)**: Agent A11 identifies student scepticism spikes and Agent A12 recommends messaging pivots.
- **RR-H06 (Institutional Consent)**: Agent A07 and Campaign Operations block unconsented institutional channels from confirmation.
- **RR-H07 (Causal Lift Holdout)**: Agent A10 warns when incremental lift claims lack a randomized control holdout.

---

## 4. Testing the AI Service Directly

To test individual agents directly via cURL:

```bash
# Health check
curl -X GET http://localhost:8001/health

# Run Agent A04 Cohort Sizing
curl -X POST http://localhost:8001/v1/agents/a04 \
  -H "X-Service-Key: change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign": {
      "markets": ["Warangal", "Karimnagar"],
      "qual": "B.Tech / B.E.",
      "age_band": "21–26 years",
      "exp_band": "Fresher"
    }
  }'
```

To run the automated agent test suite:
```bash
cd ai-service
pytest tests/test_agents.py -v
```
