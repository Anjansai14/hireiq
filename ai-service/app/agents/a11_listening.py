"""Agent A11 — Listening & Sentiment.

Classifies comments on campaign posts (Telugu, romanised Telugu, English and
code-mixed): language, English translation, sentiment, theme and intent-to-apply.
Aggregates into shares per theme and raises a Scepticism alert when the
placement-doubt share crosses the threshold from settings. Writes the
"What the cohort is saying" summary.
"""
from __future__ import annotations

from __future__ import annotations

import re

from ..llm import complete_json
from ..util import make_envelope

AGENT = {"id": "A11", "name": "Listening & Sentiment", "kind": "llm+rules"}

THEME_RULES = [
    ("Intent to apply", r"register(ed)?|applying|applied|chesa\b|done!|joined|signed up"),
    ("Placement doubt", r"job guarantee|placement|never place|waste|placed|fake|scam"),
    ("Eligibility", r"eligib|pass ?out|qualif|percentage|aggregate|branch|cgpa"),
    ("Fees", r"\bfee|free|cost|paid course|doubt ga|stipend"),
    ("Schedule", r"weekend|timing|schedule|batch|working|evening|part time"),
    ("Location", r"hyderabad lo|location|centre|center|online|where|warangal lo"),
    ("Language", r"telugu lo|english lo|language|hindi"),
]
POS = r"registered|applying|great|thanks|useful|done|🙌|exactly|good|super|chala bagundi|best"
NEG = r"waste|never|fake|scam|doubt|not worth|lekapothe|worst"
TELUGU_ROMAN = r"\b(enti|eppudu|chesa|lo|unda|leda|nijamga|istara|ante|untunda|chestunna|na\b|ki\b|ga\b|ekkada|chala|bagundi)\b"

COMMON_TRANSLATIONS = {
    r"job guarantee unda": "Is there a job guarantee?",
    r"placement istara": "Will placements be provided?",
    r"fee entha": "How much is the fee?",
    r"eppudu start": "When does the batch start?",
    r"register chesa": "I have registered",
    r"chala bagundi": "Very good",
    r"hyderabad lo ekkada": "Where in Hyderabad is the centre?",
    r"telugu lo untunda": "Will classes be taught in Telugu?",
}


def _translate_romanised(text: str) -> str:
    low = text.lower()
    for pattern, trans in COMMON_TRANSLATIONS.items():
        if re.search(pattern, low):
            return trans
    return text


def _classify(text: str, themes: list[str]) -> dict:
    low = text.lower()
    theme = next((t for t, rx in THEME_RULES if t in themes and re.search(rx, low)), themes[0] if themes else "Other")
    intent = theme == "Intent to apply" or bool(re.search(r"register(ed)?|applying|applied|chesa\b", low))
    sent = "Positive" if re.search(POS, low) else "Negative" if re.search(NEG, low) else "Neutral"
    
    if re.search(r"[ఀ-౿]", text):
        lang = "Telugu"
        trans = text  # in deterministic fallback, retain original script
    elif re.search(TELUGU_ROMAN, low):
        lang = "Telugu (romanised)"
        trans = _translate_romanised(text)
    else:
        lang = "English"
        trans = text

    return {"lang": lang, "translation": trans, "sentiment": sent, "theme": theme, "intent": intent}


def run(payload: dict) -> dict:
    comments = payload.get("comments", [])
    themes = payload.get("themes") or [t for t, _ in THEME_RULES]
    threshold = payload.get("scepticism_threshold_pct", 15)
    todo = [c for c in comments if not c.get("sentiment")]

    used = False
    if todo:
        llm = complete_json(
            "Classify each comment: language (Telugu | Telugu (romanised) | English | Hindi), English translation "
            f"(empty if already English), sentiment (Positive|Neutral|Negative), theme (one of {themes}), "
            "intent (true if the person says they registered or will apply).",
            {"comments": [c["text"] for c in todo]},
            '{"items":[{"lang":"","translation":"","sentiment":"","theme":"","intent":false}]}',
        )
        items = llm.get("items") if llm else None
        if items and len(items) == len(todo):
            used = True
            for c, r in zip(todo, items):
                c.update({k: r.get(k) for k in ("lang", "translation", "sentiment", "theme", "intent")})
                if not c.get("translation"):
                    c["translation"] = c["text"]
        else:
            for c in todo:
                c.update(_classify(c["text"], themes))

    total = len(comments) or 1
    by_theme: dict[str, int] = {}
    for c in comments:
        by_theme[c.get("theme") or "Other"] = by_theme.get(c.get("theme") or "Other", 0) + 1
    shares = {k: round(v / total * 100) for k, v in sorted(by_theme.items(), key=lambda kv: -kv[1])}
    sent = {s: round(sum(1 for c in comments if c.get("sentiment") == s) / total * 100) for s in ("Positive", "Neutral", "Negative")}
    intent = sum(1 for c in comments if c.get("intent"))
    alerts = []
    doubt = shares.get("Placement doubt", 0)
    if comments and doubt > threshold:
        alerts.append({
            "kind": "Scepticism",
            "rule": "Scepticism",
            "level": "warning",
            "text": f"Placement-doubt share at {doubt}% of comments (threshold {threshold}%). Consider an alumni testimonial or live Q&A.",
        })

    top_themes = list(shares)[:2]
    summary = None
    if comments:
        llm2 = complete_json(
            "Write a 3-4 sentence plain-English summary of what the cohort is saying, citing theme shares. No invented numbers.",
            {"theme_shares": shares, "sentiment": sent, "samples": [c.get("translation") or c["text"] for c in comments[:15]]},
            '{"summary":""}',
            max_tokens=400,
        )
        summary = (llm2 or {}).get("summary") or (
            f"Comments are led by {' and '.join(t.lower() for t in top_themes)} questions. "
            f"{sent['Positive']}% are positive and {sent['Negative']}% negative; {intent} comments say they registered or will apply. "
            + (f"Placement doubt is {doubt}% of comments, above the {threshold}% threshold." if doubt > threshold else "")
        ).strip()

    calc_details = {
        "total_comments": len(comments),
        "theme_shares": shares,
        "sentiment_shares": sent,
        "placement_doubt_pct": doubt,
        "threshold_pct": threshold,
        "alert_triggered": doubt > threshold,
    }

    evidence = [
        {"kind": "top_themes", "themes": top_themes},
        {"kind": "scepticism_metric", "doubt_share": doubt, "threshold": threshold},
    ]

    return make_envelope(
        agent_id=AGENT["id"],
        name=AGENT["name"],
        status="OK",
        execution_mode="llm_structured" if used else "deterministic_rules",
        data_sources=["campaign_comments"],
        evidence=evidence,
        calculation_details=calc_details,
        comments=comments,
        theme_shares=shares,
        sentiment=sent,
        intent=intent,
        alerts=alerts,
        summary=summary,
        stamp="Inferred",
        llm=used,
    )

