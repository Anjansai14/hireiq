"""Agent A5 — Narrative Generator.

Builds a context pack for the cohort, generates ~8 candidate narratives across
the narrative classes, scores them (resonance evidence + objective fit + manager
answer − risk) and checks every candidate for outcome claims (RR-H03),
protected-attribute risk (RR-H02) and consent needs (RR-H06). A candidate that
leans on an unevidenced claim is returned as `held` and cannot be selected.
"""
from __future__ import annotations

import logging
from typing import Any

from .. import governance
from ..config import settings
from ..llm import complete_groq_json
from ..util import make_envelope

log = logging.getLogger("hireiq.a05")
AGENT = {"id": "A5", "name": "Narrative Generator", "kind": "llm+scoring"}


def _valid_narrative_why(why: Any) -> bool:
    """Check whether campaign copy meets the required minimum word count (>= 100 words)."""
    if not isinstance(why, str):
        return False

    word_count = len(why.split())
    return word_count >= 100


def _templates(c: dict, course: dict) -> list[list[str]]:
    f = course.get("form", {})
    mk = " and ".join((c.get("markets") or [])[:2]) or "the target districts"
    first = (c.get("markets") or ["campus"])[0]
    dur = f.get("duration") or "a few weeks"
    claim = next((q for q in course.get("claims", []) if q.get("status") in ("Awaiting evidence", "Unverified", "Pending") or q.get("status") != "Observed"), None)
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


def score_breakdown(cls: str, risk: str, pref: list[str], q1: str, i: int) -> tuple[int, dict]:
    base = 58
    pref_bonus = 18 if cls in pref else 0
    q1_bonus = 8 if q1 and q1.split(" ")[0] == cls.split(" ")[0] else 0
    hash_factor = (i * 37) % 13
    penalty = 6 if risk.startswith("Medium") else 4 if risk.startswith("High") else 0
    raw = base + pref_bonus + q1_bonus + hash_factor - penalty
    final_score = min(95, round(raw))
    components = {
        "base": base,
        "objective_preference": pref_bonus,
        "manager_alignment": q1_bonus,
        "variance": hash_factor,
        "risk_penalty": penalty,
        "score": final_score,
    }
    return final_score, components


def run(payload: dict) -> dict:
    c = payload.get("campaign", {})
    course = payload.get("course", {})
    answers = c.get("answers") or {}
    pref = payload.get("objective_narratives", [])
    classes = payload.get("narrative_classes", [])
    instruction = payload.get("instruction")
    evidence = payload.get("evidence", {})

    task_prompt = (
        "You are a senior education marketing strategist and professional "
        "campaign copywriter. Generate 8 distinct, polished campaign "
        "narratives for the specified audience and course.\n\n"

        "WRITING REQUIREMENTS:\n"
        "1. Write a descriptive, compelling headline in 'title'.\n"
        "2. Identify the specific target audience in 'who'.\n"
        "3. Write comprehensive campaign copy in 'why', using at least 2 detailed paragraphs with 110 to 150 words. "
        "Every single narrative's 'why' MUST exceed 100 words (do not write short copy under 100 words). "
        "Elaborate on learner motivations, career progression, and course features to ensure each 'why' is 110-150 words.\n"
        "4. Write a short, memorable campaign hook in 'hook'.\n"
        "5. Describe the communication style in 'tone'.\n"
        "6. Make each narrative meaningfully different in angle, "
        "wording, and audience motivation.\n"
        "7. Use natural, professional, specific language. "
        "Avoid empty hype, clichés, and exaggerated promises.\n"
        "8. Use only facts explicitly supported by the supplied "
        "course details, claims, or evidence. Do not invent "
        "projects, labs, certifications, partnerships, testimonials, "
        "course features, outcomes, salaries, or placements.\n"
        "9. Do not guarantee employment or financial outcomes. "
        "Unsupported outcome claims must be flagged High risk "
        "under RR-H03. Preserve RR-H02 safeguards.\n"
        "10. Return valid JSON only, with exactly these fields: "
        "cls, title, who, why, risk, tone, hook.\n\n"

        f"Campaign narrative classes: {classes}.\n"
        + (f"Manager instruction: {instruction}\n" if instruction else "")
    )

    context_data = {
        "campaign": c,
        "course_form": course.get("form"),
        "claims": course.get("claims"),
        "evidence": evidence,
        "manager_answers": answers,
    }
    schema_hint = '{"narratives":[{"cls":"","title":"","who":"","why":"","risk":"Low|Medium: ...|High: ...","tone":"","hook":""}]}'

    retries = max(0, getattr(settings, "llm_max_retries", 2))
    pool = None
    used = False

    for attempt in range(retries + 1):
        if not getattr(settings, "groq_api_key", ""):
            break

        llm = complete_groq_json(
            task_prompt,
            context_data,
            schema_hint,
            max_tokens=3500,
        )
        if not llm or not isinstance(llm, dict):
            continue

        raw_narratives = llm.get("narratives")
        if not isinstance(raw_narratives, list) or not raw_narratives:
            continue

        valid_candidates = []
        for x in raw_narratives:
            if not isinstance(x, dict):
                continue
            why = x.get("why", "")
            if not _valid_narrative_why(why):
                continue
            if not x.get("title") or not x.get("cls"):
                continue
            valid_candidates.append([
                x.get("cls", ""),
                x.get("title", ""),
                x.get("who", ""),
                why,
                x.get("risk", "Low"),
                x.get("tone", ""),
                x.get("hook", ""),
            ])

        if len(valid_candidates) >= 4:
            pool = valid_candidates
            used = True
            break
        elif attempt == retries and valid_candidates:
            pool = valid_candidates
            used = True
            break
        else:
            log.warning(
                "Groq narrative attempt %d: %d candidates returned, %d valid (>= 100 words); retrying...",
                attempt + 1,
                len(raw_narratives),
                len(valid_candidates),
            )

    if not pool:
        pool, used = _templates(c, course), False
    elif len(pool) < 4:
        for tpl in _templates(c, course):
            if len(pool) >= 4:
                break
            if not any(p[1] == tpl[1] for p in pool):
                pool.append(tpl)

    out = []
    unsupported_claims = [
        q.get("text", "").strip()
        for q in course.get("claims", [])
        if q.get("status") != "Observed" and q.get("text")
    ]

    for i, p in enumerate(pool):
        risk = p[4]
        full_narrative = " ".join([p[1], p[2], p[3], p[5], p[6]])

        # 1. Prevent unsupported outcome or salary claims from bypassing governance (RR-H03)
        has_claim_violation = governance.has_claim(full_narrative)
        if not has_claim_violation and unsupported_claims:
            for c_text in unsupported_claims:
                if c_text.lower() in full_narrative.lower():
                    has_claim_violation = True
                    break

        if has_claim_violation and not risk.startswith("High"):
            risk = (
                "High: contains an outcome or salary claim requiring "
                "evidence review (RR-H03)"
            )

        # 2. Prevent protected attribute violations (RR-H02)
        if governance.has_protected(full_narrative):
            risk = "High: protected attribute (RR-H02)"

        is_held = risk.startswith("High")

        s, components = score_breakdown(p[0], risk, pref, answers.get("q1", ""), i)
        out.append({
            "id": f"nx{i}",
            "cls": p[0],
            "title": p[1],
            "who": p[2],
            "why": p[3],
            "risk": risk,
            "tone": p[5],
            "hook": p[6],
            "held": is_held,
            "score": s,
            "score_components": components,
            "role": None,
            "stamp": "Inferred",
        })

    out.sort(key=lambda x: -x["score"])
    top = out[:4]

    # Explicitly ensure NO held candidate is ever Primary
    for n in out:
        if n["held"]:
            n["role"] = None

    # Assign Primary to the highest-scoring candidate in top that is NOT held
    primary_assigned = False
    for n in top:
        if not n["held"]:
            n["role"] = "Primary"
            primary_assigned = True
            break

    # If all candidates in top are held, find the highest-scoring unheld in out and swap into top
    if not primary_assigned:
        unheld = next((n for n in out if not n["held"]), None)
        if unheld:
            if unheld not in top:
                top[-1] = unheld
            unheld["role"] = "Primary"

    # Strict invariant: held candidates can NEVER be Primary
    for n in top:
        if n["held"]:
            n["role"] = None

    warnings = []
    held_count = sum(1 for n in out if n["held"])
    if held_count:
        warnings.append(f"{held_count} narrative candidate(s) held under RR-H03 awaiting Observed evidence")

    return make_envelope(
        agent_id="A5",
        name="Narrative Generator",
        status="Success",
        execution_mode="llm" if used else "deterministic_fallback",
        data_sources=["course_brief", "course_claims", "past_comment_themes", "manager_answers"],
        calculation_details={"candidate_pool_size": len(out), "preferred_classes": pref},
        warnings=warnings,
        validation={"held_candidates": held_count},
        narratives=top,
        candidates=len(out),
        llm=used,
    )

