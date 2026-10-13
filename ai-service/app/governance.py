"""Governance screening shared by agents and the Copilot.

These are the hard guardrails from the prototype (RR-H01..RR-H07). They are
pattern-based on purpose: a refusal must be deterministic and auditable, not
dependent on an LLM's mood.
"""
from __future__ import annotations

import re

PROTECTED = re.compile(
    r"\b(caste|castes|religion|religious|hindu|muslim|christian|sikh|dalit|brahmin|sc/st|obc|"
    r"gender|women|woman|female|females|girls|boys only|men only|male only|only (?:men|males|boys)|transgender|disab\w*|handicap\w*)\b",
    re.I,
)
INDIVIDUAL = re.compile(
    r"(this candidate|this student|roll no|roll number|target (him|her)|\bphone number\b|\baadhaar\b|"
    r"specific (person|student|candidate)|\+91\s?\d{5})",
    re.I,
)
CLAIM = re.compile(
    r"(\d+\s?%\s*(placement|placed|hired|jobs?)|placement rate|guaranteed? (job|placement)|job guarantee|"
    r"salary|lpa\b|lakh(s)? per annum|₹\s?\d[\d,]*\s*(per month|/month|pm)\s*(salary|package)|package of)",
    re.I,
)
DISCLOSURE = re.compile(r"#ad\b|#sponsored\b|paid partnership", re.I)


def screen_request(text: str) -> dict | None:
    """Return a refusal dict if the request breaks RR-H01 / RR-H02, else None."""
    if not text:
        return None
    if PROTECTED.search(text):
        return {
            "rule": "RR-H02",
            "refused": True,
            "text": (
                "I can't do that. Hire IQ cannot segment or exclude by caste, religion, gender, disability "
                "or another protected attribute (RR-H02). The request has been logged and routed to the "
                "fairness reviewer. I can help define the cohort by district, qualification, skill background "
                "and age or experience bands instead."
            ),
        }
    if INDIVIDUAL.search(text) or re.search(r"(^|\s)@\w{3,}.*\b(target|reach|message|contact)\b", text, re.I):
        return {
            "rule": "RR-H01",
            "refused": True,
            "text": (
                "I can't do that. Hire IQ only reaches aggregate cohorts and never targets or isolates an "
                "individual candidate (RR-H01). The request has been logged with its basis. Individuals should "
                "use the standard enrolment channel: the programme's registration link."
            ),
        }
    return None


def has_claim(text: str) -> bool:
    return bool(text and CLAIM.search(text))


def has_protected(text: str) -> bool:
    return bool(text and PROTECTED.search(text))


def has_disclosure(text: str) -> bool:
    return bool(text and DISCLOSURE.search(text))
