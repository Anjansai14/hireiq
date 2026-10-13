"""Agent A1 — Brief Extractor.

Reads a course page, brochure or syllabus (PDF / text) and proposes values for
the course brief. Nothing is used until a person confirms it: every value comes
back tagged with its source ("From file") so the UI can show it as Unconfirmed.

Also runs two governance screens on the extracted text:
  * RR-H03 — placement / salary / job claims are captured as *claims awaiting
    evidence*, never as facts.
  * RR-H02 — an eligibility rule that mentions a protected attribute is flagged
    and escalated.
"""
from __future__ import annotations

import base64
import io
import re

from .. import governance
from ..llm import complete_json

AGENT = {"id": "A1", "name": "Brief Extractor", "kind": "llm+rules"}


def _pdf_pages(b64: str) -> list[str]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(base64.b64decode(b64)))
    return [(p.extract_text() or "") for p in reader.pages]


def _find(pattern: str, text: str, flags=re.I) -> str:
    m = re.search(pattern, text, flags)
    return m.group(1).strip(" .:-\n") if m else ""


def _fallback(pages: list[str], lookups: dict) -> dict:
    text = "\n".join(pages)
    vals: dict[str, object] = {}
    page_of: dict[str, int] = {}

    def put(key, val, needle=None):
        if not val:
            return
        vals[key] = val
        probe = (needle or str(val))[:25].lower()
        for i, p in enumerate(pages):
            if probe and probe in p.lower():
                page_of[key] = i + 1
                break

    put("title", _find(r"^\s*([A-Z][^\n]{6,80}(?:Programme|Program|Course|Bootcamp|Technician))", text, re.M))
    put("eligibility", _find(r"eligib\w*\s*[:\-]?\s*([^\n]{8,200})", text))
    put("duration", _find(r"(\d{1,2}\s*(?:weeks|months))", text))
    for mode in lookups.get("course_mode", []):
        if re.search(rf"\b{re.escape(mode)}\b", text, re.I):
            put("mode", mode)
            break
    for lvl in lookups.get("course_level", []):
        if re.search(rf"\b{re.escape(lvl)}\b", text, re.I):
            put("level", lvl)
            break
    for dom in lookups.get("course_domain", []):
        if re.search(rf"\b{re.escape(dom)}\b", text, re.I):
            put("domain", dom)
            break
    locs = [d for d in lookups.get("district", []) if re.search(rf"\b{re.escape(d)}\b", text, re.I)]
    if locs:
        put("locations", locs, locs[0])
    langs = [l for l in lookups.get("language", []) if re.search(rf"\b{re.escape(l)}\b", text, re.I)]
    if langs:
        put("langs", langs, langs[0])
    fee = _find(r"\b(no fee|free of cost|fee\s*[:\-]\s*[^\n]{2,40})", text)
    put("fee", "No fee" if fee.lower().startswith(("no fee", "free")) else fee)
    put("stipend", _find(r"stipend\s*(?:of)?\s*[:\-]?\s*(₹?\s?[\d,]+\s*(?:/|per)\s*month)", text))
    put("benefits", _find(r"benefits?\s*[:\-]\s*([^\n]{6,200})", text))
    put("outcome", _find(r"([^\n]*\d+\s?%\s*placement[^\n]*)", text))
    put("provider", _find(r"(?:offered|run|delivered) by\s+([A-Z][^\n,.]{3,60})", text))
    put("batchStart", _find(r"(?:batch )?start(?:s| date)?\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})", text))
    return {"values": vals, "pages": page_of}


def run(payload: dict) -> dict:
    filename = payload.get("filename") or "upload"
    lookups = payload.get("lookups", {})
    if payload.get("file_b64"):
        try:
            pages = _pdf_pages(payload["file_b64"])
        except Exception:
            pages = [base64.b64decode(payload["file_b64"]).decode("utf-8", "ignore")]
    else:
        pages = [p for p in re.split(r"\f|\n-{3,}\s*page\s*\d+\s*-{3,}\n", payload.get("text", ""), flags=re.I) if p.strip()]
    if not pages:
        return {"values": {}, "sources": {}, "claims": [], "flags": [], "note": "No readable text found"}

    fields = [f["code"] for f in payload.get("fields", [])] or [
        "title", "link", "domain", "level", "eligibility", "duration", "mode", "locations",
        "batchName", "batchStart", "batchEnd", "screenClose", "fee", "stipend", "benefits",
        "outcome", "langs", "provider", "competing", "past",
    ]
    llm = complete_json(
        "Extract course brief fields from this brochure. Only use text present in the document. "
        "For each field also give the 1-based page number it came from. Lists (locations, langs) must use "
        "only values from the allowed lookups. Leave a field out if the document does not state it.",
        {"pages": [p[:6000] for p in pages[:12]], "fields": fields, "allowed": lookups},
        '{"values": {"<field>": "<value or list>"}, "pages": {"<field>": <page int>}}',
    )
    used_llm = bool(llm and isinstance(llm.get("values"), dict))
    out = llm if used_llm else _fallback(pages, lookups)

    values = {k: v for k, v in out.get("values", {}).items() if k in fields and v not in (None, "", [])}
    sources = {k: f"{filename} · p.{out.get('pages', {}).get(k, 1)}" for k in values}

    claims, flags = [], []
    full = "\n".join(pages)
    for m in governance.CLAIM.finditer(full):
        line = full[max(0, full.rfind("\n", 0, m.start()) + 1): full.find("\n", m.end()) if full.find("\n", m.end()) > 0 else len(full)]
        line = line.strip()[:200]
        if line and all(c["text"] != line for c in claims):
            page = next((i + 1 for i, p in enumerate(pages) if line[:30] in p), 1)
            claims.append({"text": line, "src": f"{filename} · p.{page}", "status": "Awaiting evidence", "rule": "RR-H03"})
    if values.get("outcome") and governance.has_claim(str(values["outcome"])):
        flags.append({"type": "Outcome claims", "status": "Under review", "rule": "RR-H03",
                      "note": f"File states \"{values['outcome']}\". Held as a claim awaiting Observed evidence; content may not use it until evidence is attached."})
    if values.get("eligibility") and governance.has_protected(str(values["eligibility"])):
        flags.append({"type": "Eligibility", "status": "Refused", "rule": "RR-H02",
                      "note": "Eligibility mentions a protected attribute. Escalated to the fairness reviewer; field stays unconfirmed until changed."})

    return {"values": values, "sources": sources, "claims": claims, "flags": flags,
            "pages": len(pages), "llm": used_llm}
