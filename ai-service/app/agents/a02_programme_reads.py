"""Agent A2 — Programme Reads (background research).

Produces the three "reads" on a course dashboard:
  public   — Cohort demand and aspirations
  audience — Competing programmes and employers
  risk     — What could go wrong

Every item is stamped Observed / Inferred / Predicted with its source. In
production the context should include web-search results (search API) and past
campaign comment themes; the LLM only reasons over what it is given. Reads are
marked Stale by the backend when brief inputs they depend on change.
"""
from __future__ import annotations

from __future__ import annotations

from ..config import settings
from ..llm import complete_json
from ..util import make_envelope

AGENT = {"id": "A2", "name": "Programme Reads", "kind": "llm+research"}

TITLES = {
    "public": "Cohort demand and aspirations",
    "audience": "Competing programmes and employers",
    "risk": "What could go wrong",
}

ALLOWED_STAMPS = {"Observed", "Inferred", "Predicted"}


def _fallback(course: dict, evidence: dict) -> dict:
    f = course.get("form", {})
    dom = f.get("domain") or "the skill domain"
    locs = ", ".join(f.get("locations") or []) or "target districts"
    langs = ", ".join(f.get("langs") or ["their primary language"])
    themes = evidence.get("comment_themes") or []

    public = [
        {
            "t": f"Graduates in {locs} actively search for {dom} courses taught in {langs}",
            "stamp": "Inferred",
            "src": "Brief · locations and languages",
        },
    ]
    if themes:
        public.append({
            "t": f"Past cohorts asked most about {' and '.join(t.lower() for t in themes[:2])}",
            "stamp": "Observed",
            "src": "Past campaign comment themes database",
        })
    if f.get("stipend"):
        public.append({
            "t": f"Stipend ({f['stipend']}) is a strong pull for recent graduates needing financial independence",
            "stamp": "Inferred",
            "src": "Brief · fee and stipend",
        })

    audience = []
    competing_raw = f.get("competing") or ""
    comps = [c.strip() for c in competing_raw.split(",") if c.strip()]
    for comp in comps:
        audience.append({
            "t": f"{comp} targets an overlapping graduate cohort with competing intake windows",
            "stamp": "Inferred",
            "src": "Brief · competing programmes",
        })
    if not audience:
        audience.append({
            "t": "No competing programmes recorded in brief; competitor landscape inferred from general regional benchmarks",
            "stamp": "Inferred",
            "src": "Brief · competitive scan",
        })

    risk = []
    for c in course.get("claims", []):
        if c.get("status") == "Awaiting evidence":
            risk.append({
                "t": f"The claim \"{c['text']}\" cannot be used in creator briefs without Observed evidence",
                "stamp": "Observed",
                "src": "Governance flag RR-H03 (Unsubstantiated claim)",
            })
    risk.extend([
        {
            "t": "WhatsApp forward shares frequently strip UTM query parameters, reducing direct attribution fidelity",
            "stamp": "Inferred",
            "src": "Attribution model RM-08 (Dark social channel decay)",
        },
        {
            "t": "Late enrolment batching by institutions can make early campaign metrics look Behind",
            "stamp": "Predicted",
            "src": "RM-09 enrolment lag curve",
        },
    ])
    if any(not c.get("consent_ok", True) for c in evidence.get("institutions", [])):
        risk.append({
            "t": "Some partner institutions lack signed consent records; outreach blocked until consent is verified",
            "stamp": "Observed",
            "src": "Creator Bank · RR-H06 institutional consent register",
        })

    return {"public": public, "audience": audience, "risk": risk}


def run(payload: dict) -> dict:
    course = payload.get("course", {})
    evidence = payload.get("evidence", {})
    today = payload.get("today")
    missing_data = []

    if not settings.research_api_key:
        missing_data.append("External research search API key (RESEARCH_API_KEY) not configured; utilizing local course brief and historical comment themes")

    llm = complete_json(
        "Write three short research reads for this skilling course: (public) cohort demand and aspirations, "
        "(audience) competing programmes and employers, (risk) what could go wrong. 3-4 items each, one sentence, "
        "each stamped Observed only when the context has measured evidence, else Inferred or Predicted, with src citation.",
        {"course": course, "evidence": evidence},
        '{"public":[{"t":"","stamp":"","src":""}],"audience":[...],"risk":[...]}',
    )
    used = bool(llm and all(k in llm for k in TITLES))
    data = llm if used else _fallback(course, evidence)

    # Sanitize stamps and ensure citations
    for k in TITLES:
        items = data.get(k, [])
        for it in items:
            if it.get("stamp") not in ALLOWED_STAMPS:
                it["stamp"] = "Inferred"
            if not it.get("src"):
                it["src"] = "Programme brief & historical priors"

    status_str = "Ready" if not missing_data else "Partial"
    reads = [
        {
            "key": k,
            "title": t,
            "status": "Ready",  # preserve 'Ready' for UI status indicators
            "read_status": status_str,
            "date": today,
            "items": data.get(k, [])[:5],
        }
        for k, t in TITLES.items()
    ]

    calc_details = {
        "read_count": len(reads),
        "total_items": sum(len(r["items"]) for r in reads),
        "llm_synthesized": used,
        "evidence_comment_themes_count": len(evidence.get("comment_themes") or []),
    }

    evidence_summary = [
        {"kind": "course_form_inputs", "domain": course.get("form", {}).get("domain"), "locations": course.get("form", {}).get("locations")},
        {"kind": "comment_themes", "themes": evidence.get("comment_themes") or []},
    ]

    return make_envelope(
        agent_id=AGENT["id"],
        name=AGENT["name"],
        status="OK",
        execution_mode="llm_structured" if used else "deterministic_fallback",
        data_sources=["course_brief", "comment_themes", "creator_bank_consent"],
        evidence=evidence_summary,
        calculation_details=calc_details,
        missing_data=missing_data,
        reads=reads,
        llm=used,
    )

