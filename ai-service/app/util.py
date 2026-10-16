"""Small shared helpers (dates, number formatting) used by several agents."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def to_date(s: str | date | None) -> date | None:
    if s is None or s == "":
        return None
    if isinstance(s, date):
        return s
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def days_between(a, b) -> int:
    da, db = to_date(a), to_date(b)
    if not da or not db:
        return 0
    return (db - da).days


def add_days(d, n: int) -> str:
    x = to_date(d) or date.today()
    return (x + timedelta(days=n)).isoformat()


def n(x) -> str:
    """Compact Indian-friendly number format used across the UI (1.2K, 3.4M)."""
    if x is None:
        return "—"
    a = abs(x)
    if a >= 1e6:
        return f"{x / 1e6:.2f}".rstrip("0").rstrip(".") + "M"
    if a >= 1e4:
        return f"{round(x / 1e3)}K"
    if a >= 1e3:
        return f"{x / 1e3:.1f}".rstrip("0").rstrip(".") + "K"
    return str(round(x))


def inr(x) -> str:
    if x is None:
        return "—"
    s = str(int(round(x)))
    # Indian digit grouping: last 3, then groups of 2
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts + [tail])
    return "₹" + s


def ds(s) -> str:
    d = to_date(s)
    return f"{d.day} {MONTHS[d.month - 1]}" if d else "—"


def top(d: dict) -> tuple[str, float]:
    if not d:
        return ("", 0)
    k = max(d, key=lambda key: d[key] or 0)
    return (k, d[k])


def now_iso() -> str:
    """Return current ISO-8601 UTC timestamp."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def make_envelope(
    agent_id: str,
    name: str,
    status: str,
    execution_mode: str,
    data_sources: list[str] | None = None,
    evidence: list[dict] | None = None,
    calculation_details: dict | None = None,
    warnings: list[str] | int | None = None,
    missing_data: list[str] | None = None,
    validation: dict | None = None,
    result: dict | None = None,
    **extra,
) -> dict:
    """Standard explainability envelope for all agents (Section 6)."""
    env = {
        "agent_id": agent_id,
        "name": name,
        "status": status,
        "execution_mode": execution_mode,
        "data_sources": data_sources or [],
        "evidence": evidence or [],
        "calculation_details": calculation_details or {},
        "warnings": warnings if warnings is not None else [],
        "missing_data": missing_data or [],
        "validation": validation or {},
        "timestamp": now_iso(),
    }
    if result is not None:
        env["result"] = result
    env.update(extra)
    return env


