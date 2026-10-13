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

from ..llm import complete_json

AGENT = {"id": "A2", "name": "Programme Reads", "kind": "llm+research"}

TITLES = {
    "public": "Cohort demand and aspirations",
    "audience": "Competing programmes and employers",
    "risk": "What could go wrong",
}


def _fallback(course: dict, evidence: dict) -> dict:
    f = course.get("form", {})
    dom, locs = f.get("domain") or "the skill domain", ", ".join(f.get("locations") or []) or "target districts"
    themes = evidence.get("comment_themes") or []
    public = [
        {"t": f"Graduates in {locs} search for {dom} courses taught in {', '.join(f.get('langs') or ['their language'])}", "stamp": "Inferred", "src": "Brief · locations and languages"},
    ]
    if themes:
        public.append({"t": "Past cohorts asked most about " + " and ".join(t.lower() for t in themes[:2]), "stamp": "Observed", "src": "Past campaign comment themes"})
    if f.get("stipend"):
        public.append({"t": f"Stipend ({f['stipend']}) is a strong pull for recent graduates who need to earn", "stamp": "Inferred", "src": "Brief · fee and stipend"})
    audience = []
    for comp in [c.strip() for c in (f.get("competing") or "").split(",") if c.strip()]:
        audience.append({"t": f"{comp} targets an overlapping cohort", "stamp": "Inferred", "src": "Brief · competing programmes"})
    if not audience:
        audience.append({"t": "No competing programmes recorded; add them to the brief for a sharper read", "stamp": "Inferred", "src": "Brief"})
    risk = []
    for c in course.get("claims", []):
        if c.get("status") == "Awaiting evidence":
            risk.append({"t": f"The claim \"{c['text']}\" cannot be used without Observed evidence", "stamp": "Observed", "src": "Governance flag RR-H03"})
    risk += [
        {"t": "WhatsApp forwards can strip the tracked link", "stamp": "Inferred", "src": "Attribution risk"},
        {"t": "Late enrolment records make a healthy campaign look Behind", "stamp": "Predicted", "src": "RM-09 lag model"},
    ]
    if any(not c.get("consent_ok", True) for c in evidence.get("institutions", [])):
        risk.append({"t": "Some partner institutions have no consent record yet (RR-H06)", "stamp": "Observed", "src": "Creator Bank"})
    return {"public": public, "audience": audience, "risk": risk}


def run(payload: dict) -> dict:
    course = payload.get("course", {})
    evidence = payload.get("evidence", {})
    today = payload.get("today")
    llm = complete_json(
        "Write three short research reads for this skilling course: (public) cohort demand and aspirations, "
        "(audience) competing programmes and employers, (risk) what could go wrong. 3-4 items each, one sentence, "
        "each stamped Observed only when the context has measured evidence, else Inferred or Predicted, with src.",
        {"course": course, "evidence": evidence},
        '{"public":[{"t":"","stamp":"","src":""}],"audience":[...],"risk":[...]}',
    )
    used = bool(llm and all(k in llm for k in TITLES))
    data = llm if used else _fallback(course, evidence)
    reads = [{"key": k, "title": t, "status": "Ready", "date": today, "items": data.get(k, [])[:5]} for k, t in TITLES.items()]
    return {"reads": reads, "llm": used}
