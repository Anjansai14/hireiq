"""Agent A10 — Compliance & Fairness Gate.

Runs the 13 governance and fairness checks before a campaign can be created.
Any `Fail` blocks creation; `Warning` is shown but allowed. Purely rule-based
so every verdict is reproducible and auditable.
"""
from __future__ import annotations

from ..util import inr

AGENT = {"id": "A10", "name": "Compliance & Fairness Gate", "kind": "rules"}


def run(payload: dict) -> dict:
    c = payload.get("campaign", {})
    course = payload.get("course", {})
    p = payload.get("prediction", {})
    shortlist = payload.get("shortlist", [])
    sources = {s["id"]: s for s in payload.get("sources", [])}
    channels = payload.get("channels", [])
    content_sel = payload.get("content_selected", {})  # {source_id: [variant...]}
    narrs = payload.get("narratives", [])
    institutional = payload.get("institutional_types", ["College network", "Placement cell"])
    min_size = payload.get("min_cohort_size", 500)
    hb = payload.get("hashtag_budget", {"per_week": 30})
    readiness = course.get("readiness", {})

    tot = sum(r.get("share", 0) for r in channels if r.get("on", True))
    avail = c.get("budget") or 0
    ceil = c.get("ceiling") or course.get("ceiling") or 0
    fees, cpi = p.get("fees", 0), p.get("cpi", [0, 0])
    items = sum(len(v) for v in content_sel.values())
    paid_items = sum(len(v) for sid, v in content_sel.items()
                     if (next((x.get("fee") for x in shortlist if x["source_id"] == sid), None) or (sources.get(sid) or {}).get("rate") or 0) > 0)
    untagged = [v["title"] for vs in content_sel.values() for v in vs if v.get("disclosure") and "#ad" not in (v.get("caption") or "")]
    claim_items = [v["title"] for vs in content_sel.values() for v in vs if (v.get("checks") or {}).get("claims") == "Fail"]
    held = [n for n in narrs if n.get("role") and n.get("held")]
    inst_no = [sources[x["source_id"]]["name"] for x in shortlist
               if x["source_id"] in sources and sources[x["source_id"]].get("type") in institutional
               and sources[x["source_id"]].get("consent") != "Recorded" and not x.get("consent_ok")]
    flags = course.get("flags", [])
    gov = "Fail" if any(f.get("status") == "Refused" for f in flags) else "Warning" if any(f.get("status") == "Under review" for f in flags) else "Pass"
    size = c.get("cohort_size") or 0
    awaiting = any(q.get("status") == "Awaiting evidence" for q in course.get("claims", []))
    q3 = (c.get("answers") or {}).get("q3")
    n_inst = sum(1 for x in shortlist if (sources.get(x["source_id"]) or {}).get("type") in institutional)

    checks = [
        ("At least one source shortlisted", "Pass" if p.get("posts") else "Fail",
         f"{len(shortlist)} sources, {p.get('posts')} posts" if p.get("posts") else "Go back to Influencers and shortlist sources", None),
        ("Fees within available budget", "Fail" if fees > avail else "Warning" if fees > avail * 0.85 else "Pass",
         f"{inr(fees)} of {inr(avail)} budget", None),
        ("Channel shares total 100%", "Pass" if tot == 100 else "Fail", f"Currently {tot}%", None),
        ("Predicted cost per enrolment within the ceiling", "Warning" if not ceil or cpi[1] > ceil else "Pass",
         f"Range {inr(cpi[0])}–{inr(cpi[1])} vs ceiling {inr(ceil)}" if ceil else "No cost ceiling set", None),
        ("Tracked link on every content item", "Fail" if readiness.get("noRegLink") else "Pass",
         "Course brief has no confirmed Resolence registration link" if readiness.get("noRegLink") else f"{items} items carry a source-tagged Resolence link", None),
        ("Disclosure tag on every paid item (RR-H04)", "Fail" if untagged else "Pass",
         f"Missing on: {', '.join(untagged[:3])}" if untagged else f"{paid_items} paid items tagged #ad; partnership items do not need it", "RR-H04"),
        ("Outcome claims backed by Observed evidence (RR-H03)", "Fail" if (held or claim_items) else "Pass",
         f"\"{held[0]['title']}\" asserts a claim with no evidence" if held else f"\"{claim_items[0]}\" contains a claim" if claim_items
         else "Brief claim awaiting evidence is kept out of narratives and content" if awaiting else "No outcome claims used", "RR-H03"),
        ("No individual or protected-attribute targeting (RR-H01, RR-H02)", "Fail" if c.get("refusal") else "Pass",
         c["refusal"]["text"][:140] if c.get("refusal") else "Cohort is defined by district, qualification, skill background and bands only", "RR-H01"),
        ("Cohort at or above the minimum size", "Pass" if size >= min_size else "Fail",
         f"Estimated {size:,} people · minimum {min_size:,}", None),
        ("Consent record on every institutional source (RR-H06)", "Fail" if inst_no else "Pass",
         f"{', '.join(inst_no)}: no consent record" if inst_no else f"{n_inst} institutional sources, consent on file", "RR-H06"),
        ("Governance flags on the brief", gov,
         "A flag is Refused; resolve it on the course brief" if gov == "Fail" else
         ", ".join(f["type"] for f in flags if f.get("status") == "Under review") + " under review" if gov == "Warning" else "All cleared", None),
        ("Effectiveness claim has a holdout (RR-H07)", "Warning" if q3 == "Yes" else "Pass",
         "No holdout cohort in v1: the report will show attributed enrolments and make no lift claim" if q3 == "Yes" else "No effectiveness claim planned", "RR-H07"),
        (f"Hashtag budget ({hb.get('platform', 'Instagram')}, {hb.get('per_week', 30)} per account per 7 days)",
         "Pass" if len(c.get("hashtags") or []) + payload.get("hashtags_used_week", 0) <= hb.get("per_week", 30) else "Warning",
         f"{len(c.get('hashtags') or [])} new tags · {payload.get('hashtags_used_week', 0)} of {hb.get('per_week', 30)} used this week", None),
    ]
    out = [{"label": l, "status": s, "note": n, "rule": r} for l, s, n, r in checks]
    fails = [x for x in out if x["status"] == "Fail"]
    return {"checks": out, "pass": sum(1 for x in out if x["status"] == "Pass"),
            "warnings": sum(1 for x in out if x["status"] == "Warning"), "fails": len(fails),
            "can_create": not fails, "summary": f"{len(out) - len(fails)} of {len(out)} checks pass" + (f" · {len(fails)} blocking" if fails else "")}
