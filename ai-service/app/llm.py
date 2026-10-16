"""Thin wrapper around Claude.

Every agent calls `complete_json(...)`. When no API key is configured, or the
call fails, it returns None and the agent falls back to its deterministic
logic. That keeps the whole platform runnable offline and makes every LLM
output optional rather than load-bearing.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from .config import settings

log = logging.getLogger("hireiq.llm")
_client = None

GUARDRAILS = (
    "You are an agent inside Hire IQ, a platform that plans influencer micro-campaigns that "
    "drive screening enrolments for skilling programmes in India. Hard rules you must follow:\n"
    "- RR-H01: never target or isolate an individual person; only aggregate cohorts.\n"
    "- RR-H02: never define, include or exclude people by caste, religion, gender, disability or any protected attribute.\n"
    "- RR-H03: never state placement rates, salaries or job guarantees unless the context marks them as Observed evidence.\n"
    "- RR-H04: paid content must include a disclosure tag such as #ad.\n"
    "- Never invent creator handles, numbers or sources. Use only facts in the provided context.\n"
    "- Stamp claims as Observed (measured), Inferred (reasoned) or Predicted (model output).\n"
    "Respond with JSON only, no prose before or after."
)


def _get_client():
    global _client
    if _client is None and settings.llm_enabled:
        try:
            import anthropic

            _client = anthropic.Anthropic(
                api_key=settings.anthropic_api_key,
                timeout=settings.llm_timeout,
            )
        except Exception as e:  # pragma: no cover
            log.warning("Anthropic client unavailable: %s", e)
    return _client


def _extract_json(text: str) -> Any:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fence:
        text = fence.group(1).strip()
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=0)
    return json.loads(text[start:])


def complete_structured(
    task: str,
    context: dict | str,
    schema_hint: str,
    max_tokens: int | None = None,
) -> tuple[Any | None, bool, str | None]:
    """Ask Claude for a JSON answer with timeouts and retries.
    
    Returns:
        (parsed_json, used_llm: bool, error_reason: str | None)
    """
    client = _get_client()
    if client is None:
        if not settings.llm_enabled:
            return None, False, "ANTHROPIC_API_KEY not configured; using deterministic fallback"
        return None, False, "Anthropic client unavailable; using deterministic fallback"

    ctx = context if isinstance(context, str) else json.dumps(context, ensure_ascii=False, default=str)
    retries = max(0, settings.llm_max_retries)
    last_err: Exception | None = None

    import time
    for attempt in range(retries + 1):
        try:
            msg = client.messages.create(
                model=settings.llm_model,
                max_tokens=max_tokens or settings.llm_max_tokens,
                system=GUARDRAILS,
                messages=[{
                    "role": "user",
                    "content": f"TASK:\n{task}\n\nCONTEXT (JSON):\n{ctx}\n\nReturn JSON matching:\n{schema_hint}",
                }],
            )
            text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
            data = _extract_json(text)
            return data, True, None
        except Exception as e:
            last_err = e
            if attempt < retries:
                backoff = 0.5 * (2 ** attempt)
                log.warning("LLM call attempt %d failed: %s; retrying in %.1fs", attempt + 1, e, backoff)
                time.sleep(backoff)
            else:
                log.warning("LLM call failed after %d attempts: %s; falling back", retries + 1, e)

    return None, False, f"LLM call failed ({last_err}); using deterministic fallback"


def complete_json(task: str, context: dict | str, schema_hint: str, max_tokens: int | None = None) -> Any | None:
    """Ask Claude for a JSON answer. Returns parsed JSON or None (fallback)."""
    data, _, _ = complete_structured(task, context, schema_hint, max_tokens)
    return data

