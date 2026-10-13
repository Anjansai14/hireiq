"""Agent A6 — Channel Planner.

share ∝ objective prior × cohort behaviour × measurability
  * prior matrix per objective comes from the channel_priors table
  * behaviour: ITI / diploma cohorts lean on WhatsApp & Facebook, not LinkedIn
  * measurability: 1.0 measured, 0.8 tracked link only, 0.6 manual
The programme's own page is always locked in as Anchor at 10%.
"""
from __future__ import annotations

import re

from ..llm import complete_json

AGENT = {"id": "A6", "name": "Channel Planner", "kind": "rules+llm-reasons"}

DEFAULT_REASON = {
    "WhatsApp": "Placement cells and youth forums broadcast to verified graduate lists; tracked clicks only",
    "YouTube": "Long-form explainers carry the syllabus walkthrough and handle scepticism",
    "Instagram": "Reach among younger graduates; weaker on conversion",
    "LinkedIn": "Alumni stories reach recent graduates already job hunting",
    "Facebook": "Student and district groups across many colleges",
    "Campus events": "Info sessions with tagged QR codes convert well",
}


def run(payload: dict) -> dict:
    c = payload.get("campaign", {})
    cfg = payload.get("channel_priors", {})
    chans: dict = cfg.get("channels", {})
    priors: dict = cfg.get("priors", {}).get(c.get("objective")) or next(iter(cfg.get("priors", {}).values()), {})
    iti = bool(re.search(r"ITI|Diploma", c.get("qual") or "", re.I))
    allowed = payload.get("allowed_channels") or list(chans)

    weights = {}
    for name, meta in chans.items():
        if name not in allowed:
            continue
        beh = meta.get("iti", 1.0) if iti else 1.0
        weights[name] = priors.get(name, 1) * beh * meta.get("meas", 1.0)
    tot = sum(weights.values()) or 1

    rows = [{"name": "Programme's own page", "role": "Anchor", "share": 10, "locked": True, "on": True,
             "meas": "Measurable now", "formats": "YouTube, Instagram, WhatsApp channel",
             "reason": "Always included; tracked links and boosts run from the programme's handles"}]
    # Floor every channel at 10%, then share the rest proportionally among the
    # unfloored ones, so floors never reorder channels against the prior matrix.
    shares, floored, budget = {}, set(), 90
    while True:
        free = {k: w for k, w in weights.items() if k not in floored}
        tot_free = sum(free.values()) or 1
        rem = budget - 10 * len(floored)
        newly = {k for k, w in free.items() if w / tot_free * rem < 10}
        if not newly:
            shares = {k: (10 if k in floored else free[k] / tot_free * rem) for k in weights}
            break
        floored |= newly
    for name, w in weights.items():
        meta = chans[name]
        rows.append({"name": name, "role": meta.get("role"), "formats": meta.get("formats"),
                     "meas": meta.get("meas_label"), "share": round(shares[name]), "on": True,
                     "locked": False, "reason": DEFAULT_REASON.get(name, ""),
                     "factors": {"prior": priors.get(name, 1), "behaviour": meta.get("iti", 1.0) if iti else 1.0,
                                 "measurability": meta.get("meas", 1.0)}})
    diff = 100 - sum(r["share"] for r in rows)
    if len(rows) > 1:
        max(rows[1:], key=lambda r: r["share"])["share"] += diff
    rows[1:] = sorted(rows[1:], key=lambda r: -r["share"])

    llm = complete_json(
        "Write a one-sentence reason for each channel's role in this cohort campaign. Do not change shares.",
        {"campaign": {k: c.get(k) for k in ("objective", "qual", "markets", "languages", "cohort")},
         "channels": [{"name": r["name"], "role": r["role"], "share": r["share"]} for r in rows[1:]]},
        '{"reasons": {"<channel>": "<sentence>"}}', max_tokens=500,
    )
    if llm and isinstance(llm.get("reasons"), dict):
        for r in rows[1:]:
            r["reason"] = llm["reasons"].get(r["name"], r["reason"])
    return {"channels": rows, "cohort_behaviour": "ITI/diploma" if iti else "graduate", "llm": bool(llm)}
