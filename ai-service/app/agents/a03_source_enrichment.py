"""Agent A3 — Source Enrichment (Creator Bank).

Refreshes an influence source from official APIs only (YouTube Data API,
Meta Graph API) or keeps uploaded metrics for institutional / WhatsApp sources.
No scraping. Computes tier from followers, marks the profile Enriched,
Partial or Failed, and optionally infers type/tone from recent titles.
"""
from __future__ import annotations

import httpx

from ..config import settings
from ..llm import complete_json

AGENT = {"id": "A3", "name": "Source Enrichment", "kind": "api+rules"}


def tier_for(followers: int, tiers: list[dict]) -> str:
    for t in tiers:
        meta = t.get("meta") or {}
        lo, hi = meta.get("min") or 0, meta.get("max")
        if followers >= lo and (hi is None or followers < hi):
            return t["code"]
    return tiers[0]["code"] if tiers else "Micro"


def _youtube(handle: str) -> dict | None:
    if not settings.youtube_api_key:
        return None
    h = handle.lstrip("@")
    r = httpx.get(
        "https://www.googleapis.com/youtube/v3/channels",
        params={"part": "statistics,snippet", "forHandle": h, "key": settings.youtube_api_key},
        timeout=10,
    )
    items = r.json().get("items") or []
    if not items:
        return None
    st = items[0]["statistics"]
    return {"followers": int(st.get("subscriberCount", 0)), "video_count": int(st.get("videoCount", 0))}


def _meta(handle: str) -> dict | None:
    if not settings.meta_graph_token:
        return None
    # Business discovery requires the connected business account id; kept as the integration point.
    return None


def run(payload: dict) -> dict:
    s = payload.get("source", {})
    tiers = payload.get("tiers", [])
    today = payload.get("today")
    updates: dict = {}
    status, note, origin = "Enriched", "", "uploaded sheet"
    try:
        fetched = None
        if s.get("platform") == "YouTube":
            fetched, origin = _youtube(s.get("handle", "")), "YouTube Data API"
        elif s.get("platform") in ("Instagram", "Facebook"):
            fetched, origin = _meta(s.get("handle", "")), "Meta Graph API"
        if fetched:
            updates.update(fetched)
        elif s.get("data_source") == "Uploaded" or s.get("platform") in ("WhatsApp", "LinkedIn"):
            origin = "uploaded sheet"
        else:
            status, note = "Partial", f"{origin} not connected: kept last known metrics"
        if not s.get("markets"):
            status, note = "Partial", "Audience geography unavailable (account did not connect analytics)"
    except Exception as e:  # network / quota
        status, note = "Failed", f"Last refresh failed: {e}. Retry scheduled."

    followers = updates.get("followers", s.get("followers") or 0)
    if s.get("type") not in payload.get("institutional_types", []):
        updates["tier"] = tier_for(followers, tiers)

    recent = [p.get("title") for p in s.get("recent", [])][:6]
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

    activity = f"Profile refreshed from {origin}" if status != "Failed" else note
    return {"updates": updates, "status": status, "note": note, "updated_on": today, "activity": activity}
