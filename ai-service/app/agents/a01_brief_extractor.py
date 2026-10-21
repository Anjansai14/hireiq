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
from typing import Any

# pyrefly: ignore[missing-import]
import httpx

try:
    from .. import governance
    from ..llm import complete_json
    from ..util import make_envelope
except (ImportError, ValueError):
    import sys
    from pathlib import Path
    _root = Path(__file__).resolve().parents[2]
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from app import governance  # type: ignore
    from app.llm import complete_json  # type: ignore
    from app.util import make_envelope  # type: ignore

AGENT = {"id": "A1", "name": "Brief Extractor", "kind": "llm+rules"}


def _item_code(item: Any) -> str:
    if isinstance(item, dict):
        return str(item.get("code") or item.get("name") or "")
    return str(item or "")


def _fetch_url_text(url: str) -> list[str]:
    """Fetch external web page text if a URL is provided."""
    try:
        resp = httpx.get(url, timeout=15.0, follow_redirects=True)
        if resp.status_code == 200:
            # Strip simple HTML tags and extra spaces
            text = re.sub(r"<[^>]+>", " ", resp.text)
            text = re.sub(r"\s+", " ", text).strip()
            return [text] if text else []
    except Exception:
        pass
    return []


def _pdf_pages(b64: str) -> list[str]:
    # pyrefly: ignore[missing-import]
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(base64.b64decode(b64)))
    return [(p.extract_text() or "") for p in reader.pages]


def _find(pattern: str, text: str, flags=re.I) -> str:
    m = re.search(pattern, text, flags)
    return m.group(1).strip(" .:-\n") if m else ""


def _fallback(pages: list[str], lookups: dict | None) -> dict:
    lookups = lookups or {}
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
    for raw_mode in (lookups.get("course_mode") or []):
        mode = _item_code(raw_mode)
        if mode and re.search(rf"\b{re.escape(mode)}\b", text, re.I):
            put("mode", mode)
            break
    for raw_lvl in (lookups.get("course_level") or []):
        lvl = _item_code(raw_lvl)
        if lvl and re.search(rf"\b{re.escape(lvl)}\b", text, re.I):
            put("level", lvl)
            break
    for raw_dom in (lookups.get("course_domain") or []):
        dom = _item_code(raw_dom)
        if dom and (re.search(rf"\b{re.escape(dom)}\b", text, re.I) or (dom == "AI/ML" and re.search(r"\bAI\s*(?:/|&)\s*ML\b", text, re.I))):
            put("domain", dom)
            break
    locs = []
    for raw_d in (lookups.get("district") or []):
        d = _item_code(raw_d)
        if d and re.search(rf"\b{re.escape(d)}\b", text, re.I):
            locs.append(d)
    if locs:
        put("locations", locs, locs[0])
    langs = []
    for raw_l in (lookups.get("language") or []):
        l = _item_code(raw_l)
        if l and re.search(rf"\b{re.escape(l)}\b", text, re.I):
            langs.append(l)
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


def run(payload: dict | None) -> dict:
    payload = payload or {}
    filename = payload.get("filename") or "upload"
    lookups = payload.get("lookups") or {}
    data_sources = [filename]

    if payload.get("file_b64"):
        try:
            pages = _pdf_pages(payload["file_b64"])
        except Exception:
            try:
                pages = [base64.b64decode(payload["file_b64"]).decode("utf-8", "ignore")]
            except Exception:
                pages = [str(payload["file_b64"])]
    elif payload.get("url"):
        pages = _fetch_url_text(payload["url"])
        if not pages and payload.get("text"):
            pages = [p for p in re.split(r"\f|\n-{3,}\s*page\s*\d+\s*-{3,}\n", payload.get("text", ""), flags=re.I) if p.strip()]
        data_sources.append(payload["url"])
    else:
        pages = [p for p in re.split(r"\f|\n-{3,}\s*page\s*\d+\s*-{3,}\n", payload.get("text", ""), flags=re.I) if p.strip()]

    if not pages:
        return make_envelope(
            agent_id="A1",
            name="Brief Extractor",
            status="Failed",
            execution_mode="deterministic_fallback",
            data_sources=data_sources,
            calculation_details={"extracted_fields_count": 0, "claims_count": 0, "flags_count": 0},
            warnings=["No readable text or pages found in the brief upload"],
            values={},
            sources={},
            claims=[],
            flags=[],
            pages=0,
            llm=False,
            note="No readable text found",
        )

    raw_fields = payload.get("fields") or []
    if raw_fields and isinstance(raw_fields[0], dict):
        fields = [f["code"] for f in raw_fields if isinstance(f, dict) and "code" in f]
    elif raw_fields and isinstance(raw_fields[0], str):
        fields = [str(f) for f in raw_fields]
    else:
        fields = [
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
    used_llm = bool(llm and isinstance(llm, dict) and isinstance(llm.get("values"), dict))
    out = (llm if used_llm and llm is not None else _fallback(pages, lookups)) or {}

    out_vals = out.get("values")
    vals_map = out_vals if isinstance(out_vals, dict) else {}
    values = {k: v for k, v in vals_map.items() if k in fields and v not in (None, "", [])}

    out_pages = out.get("pages")
    pages_map = out_pages if isinstance(out_pages, dict) else {}
    sources = {k: f"{filename} · p.{pages_map.get(k, 1)}" for k in values}

    claims, flags = [], []
    full = "\n".join(pages)
    for m in governance.CLAIM.finditer(full):
        end_idx = full.find("\n", m.end())
        line_end = end_idx if end_idx != -1 else len(full)
        line = full[max(0, full.rfind("\n", 0, m.start()) + 1): line_end].strip()[:200]
        if line and all(c.get("text") != line for c in claims):
            page = next((i + 1 for i, p in enumerate(pages) if line[:30] in p), 1)
            claims.append({"text": line, "src": f"{filename} · p.{page}", "status": "Awaiting evidence", "rule": "RR-H03"})
    if values.get("outcome") and governance.has_claim(str(values["outcome"])):
        flags.append({"type": "Outcome claims", "status": "Under review", "rule": "RR-H03",
                      "note": f"File states \"{values['outcome']}\". Held as a claim awaiting Observed evidence; content may not use it until evidence is attached."})
    if values.get("eligibility") and governance.has_protected(str(values["eligibility"])):
        flags.append({"type": "Eligibility", "status": "Refused", "rule": "RR-H02",
                      "note": "Eligibility mentions a protected attribute. Escalated to the fairness reviewer; field stays unconfirmed until changed."})

    status = "Blocked" if any(f.get("status") == "Refused" for f in flags) else "Success"
    exec_mode = "llm" if used_llm else "deterministic_fallback"

    return make_envelope(
        agent_id="A1",
        name="Brief Extractor",
        status=status,
        execution_mode=exec_mode,
        data_sources=data_sources,
        evidence=[{"claim": c.get("text", ""), "src": c.get("src", "")} for c in claims],
        calculation_details={"extracted_fields_count": len(values), "claims_count": len(claims), "flags_count": len(flags)},
        validation={"flags": flags, "claims_awaiting_evidence": len(claims)},
        values=values,
        sources=sources,
        claims=claims,
        flags=flags,
        pages=len(pages),
        llm=used_llm,
    )

