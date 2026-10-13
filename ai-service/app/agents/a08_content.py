"""Agent A8 — Content Studio.

Drafts one content item per post in each source's deal, personalised to the
cohort: language & register, aspiration, career outcome, benefit, format and
call to action. Every item gets a source-tagged Resolence link
(…?t=hq-{campaign}-{source}-{n}) and, when paid, a disclosure tag (RR-H04).
Claims awaiting evidence are never used (RR-H03) — checked after generation.
"""
from __future__ import annotations

from .. import governance
from ..llm import complete_json

AGENT = {"id": "A8", "name": "Content Studio", "kind": "llm+checks"}


def _templates(c: dict, course: dict, s: dict, narr: dict) -> list[dict]:
    f = course.get("form", {})
    t = course.get("title") or f.get("title") or "the programme"
    elig = f.get("eligibility") or "see eligibility on the link"
    fee = " · ".join(x for x in [f.get("fee"), f.get("stipend") and f"{f['stipend']} stipend"] if x)
    batch = course.get("batch") or "the next batch"
    vid = "Reel" if s.get("platform") == "Instagram" else "Short"
    nt = narr.get("title", "")
    return [
        {"kind": "Video", "format": "Alumni testimonial", "dur": "45 sec", "title": "Alumni testimonial: what changed after the course",
         "hook": narr.get("hook") or '"9 months ago I was where you are."',
         "beats": [["0–3s", "Alumnus on camera, one line about where they started"], ["3–20s", "What they built (from the syllabus only)"], ["20–35s", f"Who is eligible and when {batch} starts"], ["35–45s", "Register through the link"]],
         "caption": f"{t} registrations are open. {fee}."},
        {"kind": "Video", "format": "Long video" if s.get("platform") == "YouTube" else vid, "dur": "8–10 min" if s.get("platform") == "YouTube" else "60 sec",
         "title": "Syllabus walkthrough: week by week", "hook": f'"{f.get("duration") or "Every week"}. Here is every week."',
         "beats": [["Intro", "Hook over the syllabus page"], ["Part 1", "Foundations"], ["Part 2", "Projects and the capstone"], ["Part 3", nt or "Why it matters"], ["Close", "Eligibility and the link"]],
         "caption": f"Everything {t} teaches, week by week."},
        {"kind": "Video", "format": "Live Q&A", "dur": "30 min live", "title": "Live Q&A: eligibility, schedule, stipend",
         "hook": '"Ask us anything before you register."',
         "beats": [["0–5 min", "Who the programme is for"], ["5–20 min", "Top questions: eligibility, schedule, stipend"], ["20–30 min", "How screening works and where to register"]],
         "caption": "Live tonight at 7 pm: your questions answered."},
        {"kind": "Image", "format": "WhatsApp-forwardable card", "title": "Forwardable card: eligibility and dates",
         "visual": "Square card with programme logo, eligibility line, batch date and a tagged QR code", "overlay": "Free for eligible graduates" if "no fee" in (f.get("fee") or "").lower() else t,
         "caption": f"{t}: {fee or 'see fees'}. Eligibility: {elig}. Forward to a friend who should apply."},
        {"kind": "Image", "format": "Carousel", "title": "Carousel: can you apply?", "visual": "Five slides, one question each", "overlay": "Can you apply?",
         "frames": [x.strip() for x in elig.split(",")][:4] + ["Register for screening"],
         "caption": f"Swipe to check if you can apply for {t}. Last slide has the link."},
        {"kind": "Image", "format": "Campus session poster", "title": "Campus info session poster",
         "visual": "Event poster for a 45-minute info session at the placement cell, tagged QR for registration", "overlay": "Info session · this Friday",
         "caption": f"Meet the {t} team on campus this Friday. Scan the QR to register."},
    ]


def _fits(v: dict, s: dict) -> bool:
    p, fmts = s.get("platform"), " ".join(s.get("formats") or []).lower()
    if p == "WhatsApp":
        return v["kind"] == "Image" and v["format"] != "Carousel"
    if p == "LinkedIn":
        return v["format"] in ("Alumni testimonial", "Carousel", "Campus session poster")
    if v["format"] == "Live Q&A":
        return "live" in fmts or p == "YouTube"
    if v["format"] == "Campus session poster":
        return s.get("type") in ("College network", "Placement cell", "Community leader")
    return True


def run(payload: dict) -> dict:
    c = payload.get("campaign", {})
    course = payload.get("course", {})
    s = payload.get("source", {})
    narr = payload.get("narrative", {})
    reg = payload.get("reg_link") or "resolence.in/r/register"
    paid = (payload.get("fee") if payload.get("fee") is not None else s.get("rate") or 0) > 0
    lang = next(iter(sorted((s.get("langs") or {"English": 100}).items(), key=lambda kv: -kv[1])))[0]
    hashtags = c.get("hashtags") or []

    llm = complete_json(
        "Draft 4-6 content variants for this influence source, personalised to the cohort. Write captions in the "
        f"source's primary language ({lang}), code-mixed if that is how the source writes. Use only facts from the "
        "course form. Never use claims awaiting evidence. "
        + (f"Manager instruction: {payload['instruction']}" if payload.get("instruction") else ""),
        {"campaign": {k: c.get(k) for k in ("name", "cohort", "markets", "languages", "objective")},
         "course_form": course.get("form"), "claims": course.get("claims"),
         "source": {k: s.get(k) for k in ("name", "platform", "type", "formats", "tone", "content_types", "langs")},
         "narrative": narr},
        '{"variants":[{"kind":"Video|Image","format":"","dur":"","title":"","hook":"","beats":[["0–3s",""]],"caption":"","visual":"","overlay":"","frames":[]}]}',
    )
    variants = llm.get("variants") if llm and isinstance(llm.get("variants"), list) else None
    used = bool(variants)
    if not variants:
        variants = [v for v in _templates(c, course, s, narr) if _fits(v, s)]

    out = []
    for i, v in enumerate(variants):
        tag = f"hq-{c.get('id', 'new')}-{s.get('id')}-{i + 1}"
        tags = list(dict.fromkeys(hashtags + (["#ad"] if paid else [])))
        caption = (v.get("caption") or "").strip()
        if paid and not governance.has_disclosure(caption):
            caption += " #ad"
        link = f"{reg}?t={tag}"
        claim_hit = governance.has_claim(" ".join([v.get("title", ""), v.get("hook", ""), caption]))
        out.append({
            "id": f"v{i + 1}_{s.get('id')}", "kind": v.get("kind", "Video"), "format": v.get("format"), "dur": v.get("dur", ""),
            "title": v.get("title"), "hook": v.get("hook", ""), "lang": lang,
            "beats": [{"k": b[0], "t": b[1]} if isinstance(b, (list, tuple)) else b for b in v.get("beats", [])],
            "visual": v.get("visual", ""), "overlay": v.get("overlay", ""), "frames": v.get("frames", []),
            "caption": f"{caption} Register: {link}", "tags": tags, "cta": "Register for screening", "link": link,
            "tracking_tag": tag, "disclosure": paid,
            "checks": {"claims": "Fail" if claim_hit else "Pass", "disclosure": "Pass" if paid else "Not required", "link": "Pass"},
        })
    return {"variants": out, "llm": used, "posts_in_deal": payload.get("posts", 1)}
