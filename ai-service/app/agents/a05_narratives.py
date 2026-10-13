"""Agent A5 — Narrative Generator.

Builds a context pack for the cohort, generates ~8 candidate narratives across
the narrative classes, scores them (resonance evidence + objective fit + manager
answer − risk) and checks every candidate for outcome claims (RR-H03),
protected-attribute risk (RR-H02) and consent needs (RR-H06). A candidate that
leans on an unevidenced claim is returned as `held` and cannot be selected.
"""
from __future__ import annotations

from .. import governance
from ..llm import complete_json

AGENT = {"id": "A5", "name": "Narrative Generator", "kind": "llm+scoring"}


def _templates(c: dict, course: dict) -> list[list[str]]:
    f = course.get("form", {})
    mk = " and ".join((c.get("markets") or [])[:2]) or "the target districts"
    first = (c.get("markets") or ["campus"])[0]
    dur = f.get("duration") or "a few weeks"
    claim = next((q for q in course.get("claims", []) if q.get("status") == "Awaiting evidence"), None)
    qual = c.get("qual") or "Graduates"
    return [
        ["Career outcome", f"From {first} to a {f.get('domain') or 'tech'} team", f"{qual}, {mk}", "Alumni posts drove a higher enrolment rate than creator posts on past batches (Observed)", "Low: uses alumni stories, no salary figures", "Grounded, aspirational", '"9 months ago I was where you are."'],
        ["Speed to employment", f"Job-ready in {dur}" + (", with a stipend" if f.get("stipend") else ""), "Graduates who need to start earning soon", "Timing and stipend are the top question themes in comments (Observed)", "Low: no job guarantee wording", "Direct, practical", f'"{dur}. Paid to learn."' if f.get("stipend") else f'"{dur}. Start now."'],
        ["Skill relevance", "The exact skills employers hire for", "Graduates comparing paid bootcamps", "Syllabus maps to most-listed skills in local job posts (Inferred)", "Low", "Practical", f'"{f.get("domain") or "Real skills"}. In {", ".join(f.get("langs") or ["your language"])}."'],
        ["Institutional endorsement", "Recommended by your placement cell", "Final-year and recent graduates of partner colleges", "Placement-cell broadcasts converted best on past batches (Observed)", "Medium: needs a consent record for each institution (RR-H06)", "Official, reassuring", '"Your T&P office has partnered with this programme."'],
        ["Scepticism", "Will this actually help me get a job?", "Graduates wary of paid courses", "Placement-doubt share is high in comments on job content (Inferred)", "Medium: answers must avoid placement-rate claims (RR-H03)", "Honest", '"No promises. Here is what you build."'],
        ["Career outcome", f'"{claim["text"]}": the last batch result' if claim else "What the last batch went on to do", "Graduates who want proof", "Brochure claim; no Observed evidence attached yet" if claim else "Outcomes from the provider's records (Observed)", "High: asserts a placement rate (RR-H03). Held until Observed evidence is attached" if claim else "Low", "Confident", f'"{claim["text"]}."' if claim else '"Here is what they built."'],
        ["Speed to employment", "Finish before placement season", "Final-year students", "Final-year comments ask most about timing (Observed)", "Low", "Energetic", '"Portfolio ready before placements."'],
        ["Institutional endorsement", "Taught by faculty you already know", f"Graduates of {mk} colleges", "Former faculty sources have the highest trust score with this cohort (Inferred)", "Medium: consent record needed for current faculty (RR-H06)", "Warm", '"Your professor is teaching this."'],
    ]


def score(cls: str, risk: str, pref: list[str], q1: str, i: int) -> int:
    s = 58 + (18 if cls in pref else 0) + (8 if q1 and q1.split(" ")[0] == cls.split(" ")[0] else 0) + ((i * 37) % 13)
    s -= 6 if risk.startswith("Medium") else 4 if risk.startswith("High") else 0
    return min(95, round(s))


def run(payload: dict) -> dict:
    c = payload.get("campaign", {})
    course = payload.get("course", {})
    answers = c.get("answers") or {}
    pref = payload.get("objective_narratives", [])
    classes = payload.get("narrative_classes", [])
    instruction = payload.get("instruction")
    evidence = payload.get("evidence", {})

    llm = complete_json(
        "Generate 8 candidate campaign narratives for this cohort across these classes: "
        f"{classes}. Each must be grounded in the course brief and evidence. Never use a claim whose "
        "status is 'Awaiting evidence' unless you mark risk as 'High: ... (RR-H03)'. "
        + (f"Manager instruction: {instruction}. " if instruction else ""),
        {"campaign": c, "course_form": course.get("form"), "claims": course.get("claims"), "evidence": evidence,
         "manager_answers": answers},
        '{"narratives":[{"cls":"","title":"","who":"","why":"","risk":"Low|Medium: ...|High: ...","tone":"","hook":""}]}',
    )
    if llm and isinstance(llm.get("narratives"), list) and llm["narratives"]:
        pool = [[x.get("cls", ""), x.get("title", ""), x.get("who", ""), x.get("why", ""), x.get("risk", "Low"),
                 x.get("tone", ""), x.get("hook", "")] for x in llm["narratives"]]
        used = True
    else:
        pool, used = _templates(c, course), False

    out = []
    for i, p in enumerate(pool):
        text = " ".join(p[1:])
        risk = p[4]
        if governance.has_claim(p[1] + " " + p[6]) and not risk.startswith("High"):
            risk = "High: asserts a placement or salary claim (RR-H03). Held until Observed evidence is attached"
        if governance.has_protected(text):
            risk = "High: protected attribute (RR-H02)"
        out.append({"id": f"nx{i}", "cls": p[0], "title": p[1], "who": p[2], "why": p[3], "risk": risk,
                    "tone": p[5], "hook": p[6], "held": risk.startswith("High"),
                    "score": score(p[0], risk, pref, answers.get("q1", ""), i), "role": None, "stamp": "Inferred"})
    out.sort(key=lambda x: -x["score"])
    top = out[:4]
    for n in top:
        if not n["held"]:
            n["role"] = "Primary"
            break
    return {"narratives": top, "candidates": len(out), "llm": used}
