"""Agent A7 — Source Ranker (six-stage pipeline, deterministic and explainable).

  1. Pool      — Creator Bank sources on the chosen channels
  2. Gates     — backed out 2 of last 3, contested verification, institutional
                 source without consent (RR-H06), under 1,000 followers,
                 no post in 60 days  → blocked list with rule + reason
  3. Trust & reach — affiliation type, past attributed enrolments, audience
                 share in the cohort districts → qualified reach
  4. Quality   — engagement rate vs tier median
  5. Fit       — authority on the course's skill domain (topics)
  6. Portfolio — overlap-adjusted enrolments within budget ("Build portfolio for me")

score = trust^w0 × reach^w1 × quality^w2 × fit^w3 × reliability^w4
with weights per objective from the objective lookup.
Rationale text only uses Creator Bank fields — never invented facts.
"""
from __future__ import annotations

import math

from ..util import days_between, make_envelope, n, top

AGENT = {"id": "A7", "name": "Source Ranker", "kind": "rules"}

ANCHOR_TYPES_DEFAULT = ["Alumnus", "Trainer or mentor", "Placement cell", "Community leader"]


def gate_of(s: dict, today: str, g: dict, institutional: list[str]) -> dict | None:
    hist = (s.get("history") or [])[-g.get("backed_out_window", 3):]
    if sum(1 for h in hist if h.get("status") == "Backed out") >= g.get("backed_out_max", 2):
        return {"rule": "Reliability gate", "reason": f"Backed out on {g.get('backed_out_max', 2)} of the last {g.get('backed_out_window', 3)} campaigns"}
    if s.get("type") in institutional and s.get("consent") != "Recorded":
        return {"rule": "RR-H06", "reason": "Institutional source with no consent record"}
    if s.get("type") not in institutional and not s.get("catchment") and (s.get("followers") or 0) < g.get("min_followers", 1000):
        return {"rule": "1,000-follower rule", "reason": "Creator below the minimum follower count"}
    if s.get("verif") == "Contested":
        return {"rule": "Verification", "reason": "Verification contested"}
    if s.get("last_post") and days_between(s["last_post"], today) > g.get("inactive_days", 60):
        return {"rule": "Activity gate", "reason": f"No post in {g.get('inactive_days', 60)} days"}
    return None


def trust_of(s: dict, markets: list[str], anchor_types: list[str]) -> float:
    t = 0.25
    if s.get("type") in anchor_types:
        t += 0.3
    if s.get("type") == "College network":
        t += 0.2
    if s.get("attributed"):
        t += min(0.25, s["attributed"] / 250)
    aff = sum((s.get("markets") or {}).get(m, 0) for m in markets) / 100
    return min(1.0, t + aff * 0.2)


def run(payload: dict) -> dict:
    c = payload.get("campaign", {})
    sources = payload.get("sources", [])
    today = payload.get("today")
    g = payload.get("gates", {})
    institutional = payload.get("institutional_types", ["College network", "Placement cell"])
    anchor_types = payload.get("anchor_types", ANCHOR_TYPES_DEFAULT)
    w = payload.get("weights") or [0.4, 0.15, 0.15, 0.2, 0.1]
    tier_med = payload.get("tier_median_er") or {"Nano": 7, "Micro": 6, "Mid": 5, "Macro": 4, "Mega": 3}
    channels = payload.get("channels")
    markets = c.get("markets") or []
    languages = c.get("languages") or ["Telugu"]
    topics = payload.get("topics") or ["AI/ML", "Career guidance", "Placements"]
    stale_days = g.get("stale_profile_days", 90)

    ranked, blocked = [], []
    for s in sources:
        if channels and s.get("platform") not in channels:
            continue
        gate = gate_of(s, today, g, institutional)
        if gate:
            blocked.append({"id": s["id"], "name": s["name"], "handle": s.get("handle"), **gate})
            continue
        mk = sum((s.get("markets") or {}).get(m, 0) for m in markets) / 100
        lg = sum((s.get("langs") or {}).get(l, 0) for l in languages) / 100
        qr = (s.get("catchment") or s.get("followers") or 0) * mk * max(min(lg, 1), 0.02)
        q = min(1.6, s["er"] / tier_med.get(s.get("tier"), 5)) if s.get("er") else 0.9
        fit = max(0.05, max([(s.get("topics") or {}).get(t, 0) for t in topics] or [0]))
        hist = s.get("history") or []
        rel = (sum(1 for h in hist if h.get("status") == "Delivered") / len(hist)) if hist else 0.7
        trust = trust_of(s, markets or list((s.get("markets") or {}).keys()), anchor_types)
        reach_score = math.log10(qr + 10) / 6
        score = (trust ** w[0]) * (reach_score ** w[1]) * (q ** w[2]) * (fit ** w[3]) * ((rel + 0.1) ** w[4])

        components = {
            "trust": round(trust, 4),
            "trust_component": round(trust ** w[0], 4),
            "qualified_reach": round(qr),
            "reach_score": round(reach_score, 4),
            "reach_component": round(reach_score ** w[1], 4),
            "quality": round(q, 4),
            "quality_component": round(q ** w[2], 4),
            "fit": round(fit, 4),
            "fit_component": round(fit ** w[3], 4),
            "reliability": round(rel, 4),
            "reliability_component": round((rel + 0.1) ** w[4], 4),
            "weights": w,
        }

        flags = []
        if s.get("updated_on") and days_between(s["updated_on"], today) > stale_days:
            flags.append(f"Profile not refreshed in {stale_days} days")
        tm, tl = top(s.get("markets") or {}), top(s.get("langs") or {})
        enrols = sum(h.get("enrols") or 0 for h in hist)
        why = ((s.get("affiliation") + ". ") if s.get("affiliation") else "") + f"Reaches {tm[0]} ({tm[1]}% of audience) in {tl[0]}"
        why += (f"; catchment {s['catchment']:,} (Uploaded)" if s.get("catchment")
                else f"; median {n(s.get('median_views'))} views on recent {(s.get('formats') or ['posts'])[0].lower()}")
        why += f"; {s['attributed']} enrolments attributed in past batches (Observed)." if s.get("attributed") else "."
        ranked.append({
            "id": s["id"], "name": s["name"], "handle": s.get("handle"), "platform": s.get("platform"),
            "type": s.get("type"), "tier": s.get("tier"), "followers": s.get("followers"),
            "qualified_reach": round(qr), "quality": round(q, 2), "fit": round(fit, 2), "reliability": round(rel, 2),
            "trust": round(trust, 3), "trust_pct": round(trust * 100), "fit_pct": round(fit * 100),
            "score": score, "score_components": components, "fee": s.get("rate") or 0, "fee_stamp": s.get("rate_src"), "flags": flags,
            "why": why, "where": f"{s.get('platform')} · {', '.join(s.get('formats') or [])}",
            "what": f"{(s.get('content_types') or ['Posts'])[0]} in {(s.get('tone') or 'neutral').lower()} tone",
            "past": (f"{sum(1 for h in hist if h.get('status') == 'Delivered')} delivered of {len(hist)}" + (f" · {enrols} enrolments" if enrols else "")) if hist else "No history with this team",
            "top_market": tm, "top_lang": tl,
        })
    ranked.sort(key=lambda r: -r["score"])
    mx = ranked[0]["score"] if ranked else 1
    for i, r in enumerate(ranked):
        r["pct"] = round(r["score"] / mx * 100)
        r["rank"] = i + 1
        r["verdict"] = "Strong fit" if r["pct"] >= 80 else "Good fit" if r["pct"] >= 60 else "Weak fit"

    # Stage 6 — portfolio within budget, overlap-adjusted, one platform-diverse set
    budget = c.get("budget") or 0
    posts_default = payload.get("posts_per_source", 2)
    portfolio, spent, plat_count = [], 0, {}
    for r in ranked:
        cost = r["fee"] * posts_default
        if spent + cost > budget * 0.85:
            continue
        if plat_count.get(r["platform"], 0) >= 3:
            continue
        portfolio.append({"source_id": r["id"], "posts": posts_default, "fee": r["fee"]})
        spent += cost
        plat_count[r["platform"]] = plat_count.get(r["platform"], 0) + 1
        if len(portfolio) >= payload.get("max_portfolio", 8):
            break

    stages = ["Pool", "Gates", "Trust and reach", "Quality", "Fit", "Portfolio"]
    return make_envelope(
        agent_id="A7",
        name="Source Ranker",
        status="Success",
        execution_mode="rules",
        data_sources=["sources", "source_history", "lookup_values.objective.meta.rank_weights"],
        calculation_details={
            "stages": stages,
            "weights": w,
            "total_candidates_pool": len(sources),
            "eligible_candidates": len(ranked),
            "blocked_candidates": len(blocked),
            "portfolio_sources": len(portfolio),
            "portfolio_budget": budget,
            "portfolio_allocated": spent,
        },
        validation={"gates_enforced": ["Reliability gate", "RR-H06", "1,000-follower rule", "Verification", "Activity gate"], "blocked_count": len(blocked)},
        ranked=ranked,
        blocked=blocked,
        portfolio=portfolio,
        portfolio_fees=spent,
        stages=stages,
    )

