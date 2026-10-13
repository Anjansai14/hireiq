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

AGENT = {"id": "A9", "name": "Predictor", "kind": "model"}


def source_pred(c: dict, s: dict, posts: int, f: dict, institutional: list[str], anchors: list[str]) -> dict:
    inst = s.get("type") in institutional
    anchor = s.get("type") in anchors
    mk = max(0.15, sum((s.get("markets") or {}).get(m, 0) for m in c.get("markets") or []) / 100)
    reach = (s.get("median_views") or (s.get("catchment") or 1000) * 0.55) * posts * mk
    ctr_cfg = f.get("ctr", {})
    ctr = ctr_cfg.get("WhatsApp", 0.28) if s.get("platform") == "WhatsApp" else ctr_cfg.get("institutional", 0.05) if inst else ctr_cfg.get("anchor", 0.035) if anchor else ctr_cfg.get("default", 0.02)
    rr = f.get("reg_rate", {}).get("anchor", 0.2) if (anchor or inst) else f.get("reg_rate", {}).get("default", 0.1)
    er = f.get("enrol_rate", {}).get("anchor", 0.075) if (anchor or inst) else f.get("enrol_rate", {}).get("default", 0.06)
    clicks = reach * ctr
    regs = clicks * rr
    enr = regs * er
    return {
        "reach": [reach * 0.7, reach * 1.35], "clicks": [clicks * 0.7, clicks * 1.35],
        "regs": [regs * 0.65, regs * 1.4],
        "enrols": [max(1, int(enr * 0.6)), max(2, math.ceil(enr * 1.45))],
        "views": [reach / max(mk, 0.15) * 0.62, reach / max(mk, 0.15) * 1.45],
    }


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
    for sl in shortlist:
        s = sources.get(sl["source_id"])
        if not s:
            continue
        p = source_pred(c, s, sl.get("posts", 1), f, institutional, anchors)
        fee = (sl["fee"] if sl.get("fee") is not None else s.get("rate") or 0) * sl.get("posts", 1)
        for i in (0, 1):
            reach[i] += p["reach"][i]; clicks[i] += p["clicks"][i]; regs[i] += p["regs"][i]
            enrols[i] += p["enrols"][i]; views[i] += p["views"][i]
        fees += fee
        posts += sl.get("posts", 1)
        rows.append({"source_id": s["id"], "name": s["name"], "platform": s.get("platform"), "posts": sl.get("posts", 1),
                     "fee": fee, "enrols": p["enrols"], "views": [round(v) for v in p["views"]]})

    k = len(rows)
    ov = min(0.3, 0.05 * (k - 1)) if k > 1 else 0
    reach = [v * (1 - ov) for v in reach]
    views = [v * (1 - ov) for v in views]
    enrols = [round(v * (1 - ov * 0.6)) for v in enrols]
    with_hist = sum(1 for sl in shortlist if (sources.get(sl["source_id"]) or {}).get("history"))
    conf = "Medium" if k and with_hist >= k / 2 else "Low"
    tot_en = sum(r["enrols"][1] for r in rows) or 1
    for r in rows:
        r["share"] = round(r["enrols"][1] / tot_en * 100)
    pred = {
        "views": [round(v) for v in views], "reach": [round(v) for v in reach],
        "eng": [round(reach[0] * 0.05), round(reach[1] * 0.08)],
        "clicks": [round(v) for v in clicks], "regs": [round(v) for v in regs], "enrols": enrols,
        "cpi": [round(fees / enrols[1]) if enrols[1] else 0, round(fees / enrols[0]) if enrols[0] else 0],
        "fees": fees, "posts": posts, "overlap": ov, "conf": conf, "pos": 70,
        "basis": f"Source medians, {with_hist} of {k} sources with Observed history, funnel priors",
        "stamp": "Predicted",
    }
    return {"prediction": pred, "rows": rows}
