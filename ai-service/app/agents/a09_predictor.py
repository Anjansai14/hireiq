"""Agent A9 — Predictor.

Per source:  reach = (median views | catchment × 0.55) × posts × share-of-audience-in-cohort-districts
             clicks = reach × CTR(platform/type) → registrations → screening enrolments
Ranges are lo/hi bands (not points). Overlap in shared districts is discounted
(5% per extra source, capped at 30%). The campaign prediction is frozen at
creation (v1) and later used for checkpoints and the final verdict.
Priors come from settings.funnel_defaults until Observed rates exist; when a
source has delivered before, its Observed enrolment history widens confidence.
"""
from __future__ import annotations

import math
from ..util import make_envelope

AGENT = {"id": "A9", "name": "Predictor", "kind": "model"}


def source_pred(c: dict, s: dict, posts: int, f: dict, institutional: list[str], anchors: list[str]) -> tuple[dict, list[str]]:
    missing_flags = []
    stype = (s.get("type") or "").strip().lower()
    inst = any(stype == it.strip().lower() for it in institutional)
    anchor = any(stype == at.strip().lower() for at in anchors)

    sm = {k.strip().lower(): v for k, v in (s.get("markets") or {}).items()}
    mk_val = sum(sm.get(m.strip().lower(), 0) for m in c.get("markets") or []) / 100
    mk = max(0.15, mk_val)
    
    mv = s.get("median_views") or s.get("mv")
    if not mv:
        catchment = s.get("catchment") or 1000
        base_views = catchment * 0.55
        missing_flags.append(f"Unobserved median views for {s.get('name', s.get('id'))}; used catchment proxy ({catchment} * 0.55)")
    else:
        base_views = mv

    if not s.get("history"):
        missing_flags.append(f"No observed enrolment history for {s.get('name', s.get('id'))}")

    reach = base_views * posts * mk
    ctr_cfg = f.get("ctr", {})
    ctr = ctr_cfg.get("WhatsApp", 0.28) if s.get("platform") == "WhatsApp" else ctr_cfg.get("institutional", 0.05) if inst else ctr_cfg.get("anchor", 0.035) if anchor else ctr_cfg.get("default", 0.02)
    rr = f.get("reg_rate", {}).get("anchor", 0.2) if (anchor or inst) else f.get("reg_rate", {}).get("default", 0.1)
    er = f.get("enrol_rate", {}).get("anchor", 0.075) if (anchor or inst) else f.get("enrol_rate", {}).get("default", 0.06)
    
    clicks = reach * ctr
    regs = clicks * rr
    enr = regs * er

    # Standardized 0.60 to 1.45 low/high bands across all funnel tiers (Section 4.5)
    pred_dict = {
        "reach": [reach * 0.60, reach * 1.45],
        "clicks": [clicks * 0.60, clicks * 1.45],
        "regs": [regs * 0.60, regs * 1.45],
        "enrols": [max(1, int(enr * 0.60)), max(2, math.ceil(enr * 1.45))],
        "views": [reach / max(mk, 0.15) * 0.60, reach / max(mk, 0.15) * 1.45],
    }
    return pred_dict, missing_flags


def run(payload: dict) -> dict:
    c = payload.get("campaign", {})
    shortlist = payload.get("shortlist", [])
    sources = {s["id"]: s for s in payload.get("sources", [])}
    f = payload.get("funnel", {})
    institutional = payload.get("institutional_types", ["College network", "Placement cell"])
    anchors = payload.get("anchor_types", ["Alumnus", "Trainer or mentor", "Placement cell", "Community leader"])

    z = lambda: [0.0, 0.0]
    reach, clicks, regs, enrols, views = z(), z(), z(), z(), z()
    fees = posts = 0
    rows = []
    missing_data = []

    for sl in shortlist:
        s = sources.get(sl["source_id"])
        if not s:
            continue
        p, flags = source_pred(c, s, sl.get("posts", 1), f, institutional, anchors)
        missing_data.extend(flags)
        fee = (sl["fee"] if sl.get("fee") is not None else s.get("rate") or 0) * sl.get("posts", 1)
        for i in (0, 1):
            reach[i] += p["reach"][i]
            clicks[i] += p["clicks"][i]
            regs[i] += p["regs"][i]
            enrols[i] += p["enrols"][i]
            views[i] += p["views"][i]
        fees += fee
        posts += sl.get("posts", 1)
        rows.append({
            "source_id": s["id"],
            "name": s["name"],
            "platform": s.get("platform"),
            "posts": sl.get("posts", 1),
            "fee": fee,
            "enrols": p["enrols"],
            "views": [round(v) for v in p["views"]],
        })

    k = len(rows)
    ov = min(0.30, 0.05 * (k - 1)) if k > 1 else 0.0
    reach = [v * (1 - ov) for v in reach]
    views = [v * (1 - ov) for v in views]
    enrols = [round(v * (1 - ov * 0.6)) for v in enrols]
    if enrols[0] > enrols[1]:
        enrols[0] = enrols[1]
    with_hist = sum(1 for sl in shortlist if (sources.get(sl["source_id"]) or {}).get("history"))
    conf = "Medium" if k and with_hist >= k / 2 else "Low"
    tot_en = sum(r["enrols"][1] for r in rows) or 1
    for r in rows:
        r["share"] = round(r["enrols"][1] / tot_en * 100)

    pred = {
        "views": [round(v) for v in views],
        "reach": [round(v) for v in reach],
        "eng": [round(reach[0] * 0.05), round(reach[1] * 0.08)],
        "clicks": [round(v) for v in clicks],
        "regs": [round(v) for v in regs],
        "enrols": enrols,
        "cpi": [round(fees / enrols[1]) if enrols[1] else 0, round(fees / enrols[0]) if enrols[0] else 0],
        "fees": fees,
        "posts": posts,
        "overlap": ov,
        "conf": conf,
        "pos": 70,
        "basis": f"Source medians, {with_hist} of {k} sources with Observed history, funnel priors",
        "stamp": "Predicted",
    }

    evidence = [
        {"kind": "source_count", "total": k, "with_history": with_hist},
        {"kind": "overlap_discount", "value": ov, "formula": "min(0.30, 0.05 * (k - 1))"},
        {"kind": "band_limits", "low_multiplier": 0.60, "high_multiplier": 1.45},
    ]

    calc_details = {
        "overlap_discount": ov,
        "band_multipliers": {"low": 0.60, "high": 1.45},
        "sources_with_history": with_hist,
        "sources_total": k,
        "confidence": conf,
    }

    return make_envelope(
        agent_id=AGENT["id"],
        name=AGENT["name"],
        status="OK",
        execution_mode="deterministic_rule",
        data_sources=["sources", "campaign", "funnel_defaults"],
        evidence=evidence,
        calculation_details=calc_details,
        missing_data=missing_data,
        prediction=pred,
        rows=rows,
    )

