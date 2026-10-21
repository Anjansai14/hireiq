"""Agent A12 — Diagnosis & Next Moves (campaign Insights tab).

At each checkpoint (72 hours, Day 7, Day 14, Close) compares Observed
enrolments with the frozen prediction's expected band at that point
(band(t) = pred × (t / T)^0.8, RM-09 lag-aware), gives a verdict
(Ahead / On track / Behind), attributes the gap to causes with shares, raises
alerts (RR-H05 message mismatch, Scepticism) and proposes costed next moves
the manager can accept or dismiss. Accepting a move creates a new plan
version; the frozen prediction never changes.
"""
from __future__ import annotations

from datetime import date

from ..llm import complete_json
from ..util import add_days, days_between, ds, inr, make_envelope, n

AGENT = {"id": "A12", "name": "Diagnosis & Next Moves", "kind": "rules+llm-narration"}


def band_at(pred_enrols: list, start: str | None, end: str | None, day: str | None) -> list[int]:
    total = max(1, days_between(start, end))
    t = max(0, min(total, days_between(start, day)))
    f = (t / total) ** 0.8
    return [round(pred_enrols[0] * f), round(pred_enrols[1] * f)]


def verdict_for(actual: float, band: list[int]) -> str:
    return "Behind" if actual < band[0] else "Ahead" if actual > band[1] else "On track"


def run(payload: dict) -> dict:
    c = payload.get("campaign", {})
    today: str = payload.get("today") or date.today().isoformat()
    pred = c.get("pred") or {}
    pe = pred.get("enrols") or [0, 0]
    stats = payload.get("stats", {})
    rows = payload.get("sources", [])  # per-source metrics
    listening = payload.get("listening", {})
    cfg = payload.get("settings", {})
    floor = cfg.get("enrol_rate_floor_pct", 4)
    sk = cfg.get("scepticism_threshold_pct", 15)
    cps_cfg = cfg.get("checkpoints") or [
        {"label": "72 hours", "days": 3},
        {"label": "Day 7", "days": 7},
        {"label": "Day 14", "days": 14},
        {"label": "Close", "days": None},
    ]
    series = payload.get("series", [])  # [{day, v}] cumulative enrolments by day
    end_or_today: str = c.get("end") if (c.get("status") == "Closed" and c.get("end")) else today

    def actual_on(day: str) -> float:
        pts = [p for p in series if p.get("day") and p["day"] <= day]
        return pts[-1]["v"] if pts else 0

    checkpoints = []
    for cp in cps_cfg:
        d = c.get("end") if cp.get("days") is None else add_days(c.get("start"), cp["days"])
        b = band_at(pe, c.get("start"), c.get("end"), d)
        if d is not None and d <= end_or_today:
            a = round(actual_on(d))
            checkpoints.append({
                "label": cp["label"],
                "date": d,
                "verdict": verdict_for(a, b),
                "note": f"{a} enrolments vs band {b[0]}–{b[1]}",
            })
        else:
            checkpoints.append({
                "label": cp["label"],
                "date": d,
                "verdict": None,
                "note": f"Expected band {b[0]}–{b[1]}",
            })

    band_now = band_at(pe, c.get("start"), c.get("end"), end_or_today)
    actual = stats.get("enrols", 0)
    verdict = verdict_for(actual, band_now)
    gap = (
        f"{band_now[0] - actual} enrolments below the low end of the expected band ({band_now[0]}–{band_now[1]})"
        if verdict == "Behind"
        else f"{actual - band_now[1]} enrolments above the high end of the expected band"
        if verdict == "Ahead"
        else f"{actual} enrolments, inside the expected band ({band_now[0]}–{band_now[1]})"
    )
    pc = pred.get("clicks")
    if pc and verdict == "Behind":
        cb = band_at(pc, c.get("start"), c.get("end"), end_or_today)
        gap += "; clicks are inside their band" if cb[0] <= stats.get("clicks", 0) <= cb[1] * 1.5 else "; clicks are also below their band"

    # ---- causes & moves --------------------------------------------------
    causes, alerts, moves = [], [], []
    cohort = c.get("markets") or []
    mismatch = [
        r for r in rows
        if r.get("clicks", 0) >= 500 and r.get("regs") and r["enrols"] / max(r["regs"], 1) * 100 < floor
    ]
    for r in mismatch:
        causes.append({
            "key": "mismatch",
            "label": "Message and programme mismatch (RR-H05)",
            "weight": r["clicks"] / 100,
            "detail": f"{r['name']}: {r['clicks']:,} clicks but {r['enrols']} enrolments ({r['enrols'] / max(r['clicks'], 1) * 100:.2f}%). "
                      f"{r.get('cohort_share', 0)}% of its audience is in {', '.join(cohort)}",
        })
        alerts.append({
            "kind": "Message mismatch",
            "rule": "RR-H05",
            "level": "warning",
            "text": f"{r['name']}: click-through healthy but enrolment rate {r['enrols'] / max(r['regs'], 1) * 100:.1f}% of registrations, below the {floor}% floor. Treat as message and programme mismatch, not channel failure.",
        })

    late = [
        r for r in rows
        if r.get("late") and not r.get("posts_done") and r.get("status") not in ("Live", "Delivered", "Declined", "Backed out")
    ]
    if late:
        causes.append({
            "key": "adoption",
            "label": "Adoption gap",
            "weight": 20 * len(late),
            "detail": f"{' and '.join(r['name'] for r in late)} {'are' if len(late) > 1 else 'is'} confirmed but past the post date",
        })
        moves.append({
            "type": "Chase posting",
            "title": f"Get {' and '.join(r['name'] for r in late)} live in the next 3 days",
            "impact": f"+{sum(r.get('pred_enrols', [3, 6])[0] for r in late)} to {sum(r.get('pred_enrols', [3, 6])[1] for r in late)} enrolments",
            "cost": 0,
            "cost_label": "₹0 (already committed)",
            "why": "Trust anchors for this cohort that are already paid for.",
        })

    doubt = (listening.get("theme_shares") or {}).get("Placement doubt", 0)
    if doubt > sk:
        causes.append({
            "key": "doubt",
            "label": "Placement doubt",
            "weight": doubt / 2,
            "detail": f"{doubt}% of comments doubt placement outcomes; Scepticism threshold is {sk}%",
        })
        alerts.append({
            "kind": "Scepticism",
            "rule": "Scepticism",
            "level": "warning",
            "text": f"Placement-doubt share at {doubt}% of comments (threshold {sk}%). Consider an alumni testimonial or live Q&A.",
        })
        best_alum = max(
            [r for r in rows if r.get("type") == "Alumnus" and r.get("clicks")],
            key=lambda r: r["enrols"] / max(r["clicks"], 1),
            default=None,
        )
        if best_alum:
            moves.append({
                "type": "Alumni testimonial",
                "title": f"Add a second {best_alum['name']} post answering placement doubts",
                "impact": "+5 to 9 enrolments; placement-doubt share −6 pts",
                "cost": best_alum.get("fee", 0),
                "cost_label": inr(best_alum.get("fee", 0)),
                "why": "Highest enrolment rate per click on the campaign and directly addresses Scepticism.",
            })

    avg_reg = stats.get("regRate", 0)
    for r in rows:
        if r.get("clicks", 0) >= 1000 and r.get("regs") is not None and avg_reg and r["regs"] / r["clicks"] * 100 < avg_reg * 0.7:
            causes.append({
                "key": "dropoff",
                "label": f"{r['platform']} registration drop-off",
                "weight": 8,
                "detail": f"{r['name']}: {r['clicks']:,} clicks, {r['regs'] / r['clicks'] * 100:.0f}% registration rate vs {avg_reg:.0f}% campaign average",
            })

    tw = sum(x["weight"] for x in causes) or 1
    for x in causes:
        x["share"] = round(x.pop("weight") / tw * 100)
    causes.sort(key=lambda x: -x["share"])
    if causes:
        tot_share = sum(x["share"] for x in causes)
        if tot_share != 100 and tot_share > 0:
            causes[0]["share"] += (100 - tot_share)

    # Reallocation move: unposted paid deliverables on mismatched sources → best-converting institutional source
    if mismatch:
        best = max([r for r in rows if r.get("clicks")], key=lambda r: r["enrols"] / max(r["clicks"], 1), default=None)
        m = mismatch[0]
        left = (m.get("posts_deal", 0) - m.get("posts_done", 0)) * m.get("fee", 0)
        if best and left > 0 and best["name"] != m["name"]:
            moves.append({
                "type": "Reallocate budget",
                "title": f"Move {inr(left)} from {m['name']}'s remaining posts to {best['name']}",
                "impact": "+10 to 18 enrolments",
                "cost": 0,
                "cost_label": "₹0 (reallocation)",
                "why": f"{best['name']} converts {best['enrols'] / max(best['clicks'], 1) * 100:.1f}% click-to-enrolment against {m['enrols'] / max(m['clicks'], 1) * 100:.2f}% for {m['name']}.",
            })

    top_themes = list((listening.get("theme_shares") or {}).keys())[:3]
    if any(t in top_themes for t in ("Eligibility", "Schedule")) and verdict != "Ahead":
        moves.append({
            "type": "Live Q&A",
            "title": "Run a live Q&A with past-batch alumni on the programme's channel",
            "impact": "+6 to 12 enrolments",
            "cost": 8000,
            "cost_label": inr(8000),
            "why": "Eligibility and schedule are top question themes; a live Q&A answers both at once.",
        })

    if verdict == "Ahead":
        best = max([r for r in rows if r.get("clicks")], key=lambda r: r["enrols"] / max(r["clicks"], 1), default=None)
        if best:
            causes.insert(0, {
                "label": f"{best['name']} over-delivered",
                "detail": f"{best['enrols']} enrolments from {n(best['clicks'])} clicks",
                "share": 60,
            })
            moves.append({
                "type": "Campus session" if best.get("type") in ("College network", "Placement cell") else "Swap source",
                "title": f"Book a repeat with {best['name']}",
                "impact": "+12 to 20 enrolments",
                "cost": best.get("fee", 0),
                "cost_label": inr(best.get("fee", 0)),
                "why": "Highest-converting item on the campaign.",
            })

    narration = complete_json(
        "Explain in 2-3 sentences why this campaign is where it is, citing only the given numbers.",
        {"verdict": verdict, "gap": gap, "causes": causes[:4]},
        '{"text":""}',
        max_tokens=300,
    )
    llm_used = bool(narration and narration.get("text"))
    text_content = (narration or {}).get("text") or f"{verdict} at {ds(today)}: {gap}."

    moves_formatted = [dict(m, id=f"m{i + 1}", status="Open") for i, m in enumerate(moves[:5])]

    calc_details = {
        "verdict": verdict,
        "band_now": band_now,
        "actual_enrolments": actual,
        "lag_curve_formula": "band(t) = pred * (t / T)^0.8",
        "causes_count": len(causes),
        "moves_count": len(moves_formatted),
        "alerts_count": len(alerts),
    }

    evidence = [
        {"kind": "campaign_stats", "enrols": actual, "clicks": stats.get("clicks", 0)},
        {"kind": "checkpoints", "count": len(checkpoints)},
    ]

    return make_envelope(
        agent_id=AGENT["id"],
        name=AGENT["name"],
        status="OK",
        execution_mode="llm_structured" if llm_used else "deterministic_rules",
        data_sources=["campaign_stats", "frozen_prediction", "source_performance", "listening_insights"],
        evidence=evidence,
        calculation_details=calc_details,
        verdict=verdict,
        gap=gap,
        when=today,
        band_now=band_now,
        actual=actual,
        causes=causes[:5],
        checkpoints=checkpoints,
        alerts=alerts,
        moves=moves_formatted,
        text=text_content,
        stamp="Inferred",
    )

