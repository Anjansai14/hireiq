"""Copilot — conversational orchestrator scoped to a course or a campaign.

Contract (from the prototype):
  * Answers cite their sources.
  * Changes arrive as *proposals* the user accepts or discards; Copilot never
    writes to the database itself.
  * Copilot never invents source handles; it only names sources from context.
  * RR-H01 / RR-H02 requests are refused, logged and routed to the fairness reviewer.

Routing: governance screen → intent detection → specialist agent context → LLM
answer (or deterministic fallback built from the same context).
"""
from __future__ import annotations

import re

from .. import governance
from ..llm import complete_json

AGENT = {"id": "COP", "name": "Copilot", "kind": "orchestrator"}

INTENTS = [
    ("diagnose", r"behind|why|working|gap|diagnos"),
    ("fix", r"whatsapp|placement cell|reach|fix|improve"),
    ("creative", r"poster|creative|card|carousel|generate|image"),
    ("caption", r"caption|hook|script|telugu"),
    ("recommend", r"who|recommend|source|creator|influencer|swap|add"),
    ("summary", r"summar|report|status|overview|how"),
]


def detect_intent(msg: str) -> str:
    low = msg.lower()
    return next((k for k, rx in INTENTS if re.search(rx, low)), "general")


def _fallback(intent: str, msg: str, ctx: dict) -> dict:
    camp, course, diag = ctx.get("campaign") or {}, ctx.get("course") or {}, ctx.get("diagnosis") or {}
    srcs = ctx.get("sources") or []
    form = course.get("form") or {}
    if intent == "diagnose" and diag:
        causes = diag.get("causes") or []
        txt = f"{camp.get('name', 'The campaign')} is {diag.get('verdict', 'being tracked')}: {diag.get('gap', '')}."
        if causes:
            txt += f" The largest cause ({causes[0].get('share')}%) is {causes[0]['label'].lower()}: {causes[0].get('detail', '')}."
        prop = None
        mv = next((m for m in (ctx.get("moves") or []) if m.get("status") == "Open"), None)
        if mv:
            prop = {"title": mv["title"], "detail": f"{mv.get('impact', '')} · {mv.get('cost_label', '')}",
                    "action": {"type": "accept_move", "move_id": mv["id"], "campaign_id": camp.get("id")}}
        return {"text": txt, "sources": [f"Diagnosis · {diag.get('when', '')}", "Frozen prediction v1", "Resolence counts"], "proposal": prop}
    if intent == "recommend" and srcs:
        top3 = srcs[:3]
        txt = "Top-ranked eligible sources for this cohort: " + "; ".join(
            f"{s['name']} ({s.get('platform')}, trust {s.get('trust_pct', '—')}%) — {s.get('why', '')}" for s in top3)
        return {"text": txt, "sources": ["Creator Bank", "Agent A7 ranking"],
                "proposal": {"title": f"Add {top3[0]['name']} to {camp.get('name', 'the campaign')}",
                             "detail": "Status Identified; gates still apply", "action": {"type": "add_source", "source_id": top3[0]["id"], "campaign_id": camp.get("id")}} if camp.get("id") else None}
    if intent == "caption":
        t = course.get("title") or form.get("title") or "the programme"
        cap = f"{t}: {form.get('eligibility', 'check eligibility')}. {form.get('fee', '')} {('· ' + form['stipend'] + ' stipend') if form.get('stipend') else ''}. Register through the link. #ad"
        return {"text": f"Draft caption: \"{cap.strip()}\"", "sources": ["Course brief: Eligibility, Fee and stipend"], "proposal": None}
    if intent == "creative":
        return {"text": "Here is a concept: a square WhatsApp-forwardable card with the programme logo, the eligibility line, batch start date and a source-tagged QR code.",
                "sources": ["Course brief"], "concept": {"title": "Eligibility card", "desc": "Square card · eligibility · dates · tagged QR"},
                "proposal": {"title": "Save concept to Artifacts", "detail": "Brand assets lane", "action": {"type": "save_artifact", "name": "eligibility-card.png"}}}
    if intent == "summary" and camp:
        st = ctx.get("stats") or {}
        return {"text": f"{camp.get('name')}: {st.get('enrols', 0)} screening enrolments from {st.get('clicks', 0):,} tracked clicks and {st.get('regs', 0):,} registrations; "
                        f"{st.get('live', 0)} of {st.get('creators', 0)} sources live; committed spend ₹{st.get('committed', 0):,}.",
                "sources": ["Campaign stats", "Resolence counts"], "proposal": None}
    return {"text": "I can explain campaign performance, recommend sources from the Creator Bank, draft captions in the cohort's language, or create content concepts. What would you like?",
            "sources": [], "proposal": None}


def run(payload: dict) -> dict:
    msg = payload.get("message", "")
    ctx = payload.get("context", {})
    refusal = governance.screen_request(msg)
    if refusal:
        return {"text": refusal["text"], "sources": [f"Governance rule {refusal['rule']}"], "refused": True,
                "rule": refusal["rule"], "intent": "refused", "proposal": None, "llm": False}
    intent = detect_intent(msg)
    llm = complete_json(
        f"You are Hire IQ Copilot scoped to '{payload.get('scope')}'. Answer the user's message using ONLY the context. "
        "Cite 1-3 sources (names of context sections). If you suggest a change, return it as a proposal with an action "
        "the app can execute (types: accept_move, add_source, save_artifact, update_brief_field). Never name a source "
        "that is not in context.sources.",
        {"message": msg, "history": payload.get("history", [])[-6:], "context": ctx, "intent": intent},
        '{"text":"","sources":[""],"proposal":null|{"title":"","detail":"","action":{"type":""}}}',
    )
    if llm and llm.get("text"):
        known = {s.get("id") for s in ctx.get("sources") or []}
        prop = llm.get("proposal")
        if prop and (prop.get("action") or {}).get("type") == "add_source" and prop["action"].get("source_id") not in known:
            prop = None  # never invent sources
        return {"text": llm["text"], "sources": llm.get("sources", []), "proposal": prop, "intent": intent, "llm": True}
    out = _fallback(intent, msg, ctx)
    out.update({"intent": intent, "llm": False})
    return out
