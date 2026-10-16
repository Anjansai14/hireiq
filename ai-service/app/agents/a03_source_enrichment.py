"""Agent A3 — Source Enrichment (Creator Bank).

Refreshes an influence source from official APIs only (YouTube Data API,
Meta Graph API) or keeps uploaded metrics for institutional / WhatsApp sources.
No scraping. Computes tier from followers, marks the profile Enriched,
Partial or Failed, and optionally infers type/tone from recent titles.
"""
from __future__ import annotations

from __future__ import annotations

import httpx

from ..config import settings
from ..llm import complete_json
from ..util import make_envelope, now_iso

AGENT = {"id": "A3", "name": "Source Enrichment", "kind": "api+rules"}


def tier_for(followers: int, tiers: list[dict]) -> str:
    for t in tiers:
        meta = t.get("meta") or {}
        lo, hi = meta.get("min") or 0, meta.get("max")
        if followers >= lo and (hi is None or followers < hi):
            return t["code"]
    return tiers[0]["code"] if tiers else "Micro"


def _youtube(handle: str) -> tuple[dict | None, str | None, str]:
    """Returns (data, error_detail, origin_label)."""
    if not settings.youtube_api_key:
        return None, "YouTube API key not configured", "YouTube Data API"
    h = handle.lstrip("@")
    try:
        r = httpx.get(
            "https://www.googleapis.com/youtube/v3/channels",
            params={"part": "statistics,snippet", "forHandle": h, "key": settings.youtube_api_key},
            timeout=10,
        )
        if r.status_code == 429:
            return None, "Rate limit exceeded (HTTP 429)", "YouTube Data API"
        if r.status_code == 403:
            return None, "API quota exhausted (HTTP 403)", "YouTube Data API"
        if r.status_code != 200:
            return None, f"HTTP error {r.status_code}", "YouTube Data API"
        items = r.json().get("items") or []
        if not items:
            return None, f"Channel '{h}' not found", "YouTube Data API"
        st = items[0]["statistics"]
        return {"followers": int(st.get("subscriberCount", 0)), "video_count": int(st.get("videoCount", 0))}, None, "YouTube Data API v3"
    except httpx.TimeoutException:
        return None, "Network request timed out (10s)", "YouTube Data API"
    except Exception as e:
        return None, f"API error: {str(e)}", "YouTube Data API"


def _meta(handle: str) -> tuple[dict | None, str | None, str]:
    if not settings.meta_graph_token:
        return None, "Meta Graph API token not configured", "Meta Graph API"
    return None, "Business discovery endpoint requires connected app ID", "Meta Graph API"


def run(payload: dict) -> dict:
    s = payload.get("source", {})
    tiers = payload.get("tiers", [])
    today = payload.get("today")
    updates: dict = {}
    missing_data = []
    
    status, note, origin = "Enriched", "", "uploaded sheet"
    err_detail = None
    exec_mode = "deterministic_rule"

    try:
        fetched = None
        if s.get("platform") == "YouTube":
            fetched, err_detail, origin = _youtube(s.get("handle", ""))
        elif s.get("platform") in ("Instagram", "Facebook"):
            fetched, err_detail, origin = _meta(s.get("handle", ""))

        if fetched:
            updates.update(fetched)
            exec_mode = "live_api"
            status = "Enriched"
            note = f"Verified from {origin} at {now_iso()}"
        elif err_detail and ("Rate limit" in err_detail or "quota" in err_detail.lower() or "timed out" in err_detail):
            status = "Failed"
            note = f"Last refresh failed: {err_detail}. Retry scheduled."
            exec_mode = "error_fallback"
            missing_data.append(err_detail)
        elif s.get("data_source") == "Uploaded" or s.get("platform") in ("WhatsApp", "LinkedIn"):
            origin = "uploaded sheet"
            status = "Enriched"
            exec_mode = "deterministic_rule"
        else:
            status = "Partial"
            reason = err_detail or f"{origin} not connected"
            note = f"{reason}: kept last known metrics"
            exec_mode = "cached_fallback"
            missing_data.append(note)

        if not s.get("markets"):
            status = "Partial"
            note = "Audience geography unavailable (account did not connect analytics)"
            missing_data.append("Audience geography unavailable")

    except Exception as e:
        status = "Failed"
        note = f"Last refresh failed: {e}. Retry scheduled."
        exec_mode = "error_fallback"
        missing_data.append(str(e))

    followers = updates.get("followers", s.get("followers") or 0)
    if s.get("type") not in payload.get("institutional_types", []):
        updates["tier"] = tier_for(followers, tiers)

    recent = [p.get("title") for p in s.get("recent", [])][:6]
    llm_used = False
    if recent:
        inf = complete_json(
            "Infer the creator's tone (one word) and two content types from these recent post titles.",
            {"titles": recent, "type": s.get("type")},
            '{"tone":"","content":["",""]}',
            max_tokens=200,
        )
        if inf and inf.get("tone"):
            updates["tone"] = inf["tone"]
            updates["content_types"] = inf.get("content") or s.get("content")
            llm_used = True

    activity = f"Profile refreshed from {origin} [{now_iso()}]" if status != "Failed" else note

    calc_details = {
        "status": status,
        "origin": origin,
        "platform": s.get("platform"),
        "tier_assigned": updates.get("tier", s.get("tier")),
        "followers_count": followers,
        "llm_tone_inferred": llm_used,
    }

    return make_envelope(
        agent_id=AGENT["id"],
        name=AGENT["name"],
        status=status,
        execution_mode=exec_mode,
        data_sources=[origin, "database_cache"],
        calculation_details=calc_details,
        missing_data=missing_data,
        updates=updates,
        note=note,
        updated_on=today,
        activity=activity,
    )

