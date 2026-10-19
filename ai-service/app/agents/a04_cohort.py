"""Agent A4 — Objective & Cohort.

Step 1 of the campaign wizard. Rules-based, by design:
  1. Load confirmed brief fields.
  2. Resolve districts to standard names (RM-05).
  3. Check past batches of the course.
  4. Propose cohorts with an estimated size (aggregate only; minimum size from settings).
  5. Choose up to 3 questions to ask the manager (from the cohort_question lookup).
It also screens the free-text field for RR-H01 / RR-H02 violations.
"""
from __future__ import annotations

import difflib

from .. import governance
from ..util import make_envelope

AGENT = {"id": "A4", "name": "Objective & Cohort", "kind": "rules"}


def normalise_districts(raw: list[str], standard: list[str]) -> tuple[list[str], list[dict]]:
    out, changes = [], []
    lower = {d.lower(): d for d in standard}
    for r in raw or []:
        key = r.strip().lower()
        if key in lower:
            out.append(lower[key])
            continue
        m = difflib.get_close_matches(key, list(lower), n=1, cutoff=0.6)
        if m:
            out.append(lower[m[0]])
            changes.append({"from": r, "to": lower[m[0]], "rule": "RM-05"})
        else:
            changes.append({"from": r, "to": None, "rule": "RM-05", "note": "Unknown district, dropped"})
    return list(dict.fromkeys(out)), changes


def estimate_size(markets, qual, age_band, exp_band, lk: dict) -> tuple[dict, dict]:
    geo_items = (lk.get("state") or []) + (lk.get("district") or [])
    pool = {d["code"]: (d.get("meta") or {}).get("grad_pool", 0) for d in geo_items}
    share = lambda cat, code: next(((x.get("meta") or {}).get("share", 1.0) for x in lk.get(cat, []) if x["code"] == code), 1.0)
    base = sum(pool.get(m, 0) for m in markets)
    q_share = share("qualification", qual)
    a_share = share("age_band", age_band)
    e_share = share("exp_band", exp_band)
    size = base * q_share * a_share * e_share
    details = {
        "base_graduate_pool": base,
        "qualification_share": q_share,
        "age_band_share": a_share,
        "experience_band_share": e_share,
        "raw_size": size,
    }
    return {"size": int(round(size, -1)), "stamp": "Inferred", "basis": "District graduate pool × qualification × band shares"}, details


def run(payload: dict) -> dict:
    c = payload.get("campaign", {})
    course = payload.get("course", {})
    lk = payload.get("lookups", {})
    settings = payload.get("settings", {})
    std = [d["code"] for d in (lk.get("state") or [])] + [d["code"] for d in (lk.get("district") or [])]

    refusal = governance.screen_request(" ".join(str(c.get(k) or "") for k in ("free_text", "cohort", "name")))
    markets, changes = normalise_districts(c.get("markets") or [], std)
    course_locs = (course.get("form") or {}).get("locations") or []
    outside = [m for m in markets if course_locs and m not in course_locs]

    size, details = estimate_size(markets, c.get("qual"), c.get("age_band"), c.get("exp_band"), lk)
    min_size = settings.get("min_cohort_size", 500)

    proposals = []
    for d in (markets or course_locs)[:3]:
        s, _ = estimate_size([d], c.get("qual"), c.get("age_band"), c.get("exp_band"), lk)
        proposals.append({"label": f"{c.get('qual') or 'Graduates'}, {d}", "markets": [d], "size": s["size"],
                          "ok": s["size"] >= min_size})
    if len(markets) > 1:
        proposals.insert(0, {"label": f"{c.get('qual') or 'Graduates'}, {' and '.join(markets)}", "markets": markets,
                             "size": size["size"], "ok": size["size"] >= min_size})

    questions = [{"k": q["code"], "q": q["label"], "opts": (q.get("meta") or {}).get("options", []),
                  "why": (q.get("meta") or {}).get("why", "")} for q in lk.get("cohort_question", [])][:3]

    past = payload.get("past_campaigns", [])
    notes = []
    if past:
        best = max(past, key=lambda p: p.get("enrols") or 0)
        notes.append(f"Past batch: {best.get('name')} delivered {best.get('enrols', 0)} enrolments (Observed)")
    if outside:
        notes.append(f"{', '.join(outside)} has no delivery centre for this course; campaign will be flagged")

    status = "Blocked" if refusal else "Success"
    warnings = []
    if outside:
        warnings.append(f"Districts outside delivery centre: {', '.join(outside)}")
    if size["size"] < min_size:
        warnings.append(f"Cohort size ({size['size']}) is below minimum required size ({min_size})")

    return make_envelope(
        agent_id="A4",
        name="Objective & Cohort",
        status=status,
        execution_mode="rules",
        data_sources=["lookup_values.district", "lookup_values.qualification", "lookup_values.age_band", "lookup_values.exp_band", "lookup_values.cohort_question"],
        calculation_details=details,
        warnings=warnings,
        validation={"refusal": refusal, "size_ok": size["size"] >= min_size, "min_cohort_size": min_size},
        markets=markets,
        district_changes=changes,
        cohort_size=size,
        min_size=min_size,
        size_ok=size["size"] >= min_size,
        proposals=proposals,
        questions=questions,
        notes=notes,
        outside_delivery=outside,
        refusal=refusal,
    )

