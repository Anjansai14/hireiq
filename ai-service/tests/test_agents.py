"""Agent tests run against the prototype seed data (database/seed/*.json).

Run:  cd ai-service && python -m pytest -q
(No API key needed: every agent has a deterministic fallback.)
"""
import json
import os
import sys
from pathlib import Path

os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["GROQ_API_KEY"] = ""
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ai-service"))

from app.agents import REGISTRY  # noqa: E402

SEED = json.loads((ROOT / "database/seed/prototype_seed.json").read_text(encoding="utf-8"))
CFG = json.loads((ROOT / "database/seed/config_seed.json").read_text(encoding="utf-8"))
TODAY = "2026-10-06"


def lk(cat):
    return [x if isinstance(x, dict) else {"code": x} for x in CFG["lookups"][cat]]


def src_dto(c):
    return {"id": c["id"], "name": c["name"], "handle": c["handle"], "platform": c["platform"], "type": c["type"],
            "tier": c["tier"], "followers": c["followers"], "median_views": c["mv"], "er": c["er"], "langs": c["langs"],
            "markets": c["markets"], "topics": c["topics"], "formats": c["formats"], "content_types": c["content"],
            "tone": c["tone"], "rate": c["rate"], "rate_src": c["rateSrc"], "verif": c["verif"], "consent": c["consent"],
            "catchment": c.get("catchment"), "attributed": c.get("attributed", 0), "history": c.get("history", []),
            "last_post": c["lastPost"], "updated_on": c["updated"], "affiliation": c.get("affiliation"),
            "data_source": c["source"], "recent": c.get("recent", [])}


SOURCES = [src_dto(c) for c in SEED["creators"]]
COURSE = SEED["courses"][0]
COURSE_DTO = {"id": COURSE["id"], "title": COURSE["title"], "batch": COURSE["batch"], "form": COURSE["form"],
              "claims": COURSE["claims"], "flags": COURSE["flags"], "ceiling": COURSE["ceiling"],
              "readiness": {"noRegLink": False}}
CAMP = {"id": "k9", "name": "Test cohort", "objective": "Getting onboarded", "markets": ["Warangal", "Hanumakonda"],
        "languages": ["Telugu", "English"], "budget": 800000, "ceiling": 4500, "qual": "B.Tech / B.E.",
        "age_band": "21–26 years", "exp_band": "0–2 years experience", "start": "2026-09-22", "end": "2026-10-26",
        "answers": {"q1": "Career outcome", "q2": "Include partner institutions", "q3": "No"}, "hashtags": ["#AppliedAIBatch4"]}


def run(a, p):
    return REGISTRY[a].run(p)


def test_a1_extracts_and_holds_claims():
    text = ("Applied AI & ML Programme\nEligibility: B.Tech/B.E. or MCA, graduated 2022-2026, 60% aggregate\n"
            "Duration 16 weeks, Hybrid mode, centres in Warangal and Hyderabad. Taught in Telugu and English.\n"
            "No fee. Stipend of ₹2,500/month\nOutcome: 85% placement rate (Batch 3)")
    r = run("a1", {"text": text, "filename": "brochure.pdf", "lookups": {k: [x["code"] for x in lk(k)] for k in
            ("course_mode", "course_level", "course_domain", "district", "language")}})
    assert r["values"]["duration"] == "16 weeks"
    assert set(r["values"]["locations"]) == {"Warangal", "Hyderabad"}
    assert any("85%" in c["text"] for c in r["claims"])
    assert any(f["rule"] == "RR-H03" for f in r["flags"])


def test_a1_resilience_and_dict_lookups():
    text = "Applied AI & ML Programme\nDuration 12 weeks, Hybrid mode in Warangal. Taught in Telugu."
    # Pass raw dicts in lookups as lk(k) returns, plus string fields
    r = run("a1", {
        "text": text,
        "fields": ["title", "duration", "mode", "locations", "langs"],
        "lookups": {
            "course_mode": [{"code": "Hybrid", "name": "Hybrid"}],
            "district": [{"code": "Warangal", "name": "Warangal"}],
            "language": [{"code": "Telugu", "name": "Telugu"}],
        }
    })
    assert r["status"] == "Success"
    assert r["values"]["duration"] == "12 weeks"
    assert r["values"]["mode"] == "Hybrid"
    assert r["values"]["locations"] == ["Warangal"]
    assert r["values"]["langs"] == ["Telugu"]
    assert "extracted_fields_count" in r["calculation_details"]


def test_a4_sizes_cohort_and_screens():
    r = run("a4", {"campaign": dict(CAMP, markets=["warangal", "Hanamkonda"]), "course": COURSE_DTO,
                   "lookups": {"district": lk("district"), "qualification": lk("qualification"), "age_band": lk("age_band"),
                               "exp_band": lk("exp_band"), "cohort_question": lk("cohort_question")},
                   "settings": {"min_cohort_size": 500}})
    assert r["markets"] == ["Warangal", "Hanumakonda"]
    assert r["size_ok"] and len(r["questions"]) == 3
    bad = run("a4", {"campaign": dict(CAMP, free_text="women only cohort"), "course": COURSE_DTO, "lookups": {}, "settings": {}})
    assert bad["refusal"]["rule"] == "RR-H02"


def test_a5_holds_unevidenced_claim():
    r = run("a5", {"campaign": CAMP, "course": COURSE_DTO, "objective_narratives": ["Career outcome"]})
    assert len(r["narratives"]) == 4
    prim = [n for n in r["narratives"] if n["role"] == "Primary"]
    assert len(prim) == 1 and not prim[0]["held"]


def test_a5_valid_narrative_why_word_count():
    from app.agents.a05_narratives import _valid_narrative_why
    assert not _valid_narrative_why(None)
    assert not _valid_narrative_why(123)
    assert not _valid_narrative_why("")
    assert not _valid_narrative_why(" ".join(["word"] * 50))
    assert not _valid_narrative_why(" ".join(["word"] * 99))
    assert _valid_narrative_why(" ".join(["word"] * 100))
    assert _valid_narrative_why(" ".join(["word"] * 125))
    assert _valid_narrative_why(" ".join(["word"] * 150))
    assert _valid_narrative_why(" ".join(["word"] * 151))
    assert _valid_narrative_why(" ".join(["word"] * 250))


def test_a5_held_candidates_never_become_primary():
    # Test 1: Fallback template with unevidenced claim is held, and Primary is assigned to an unheld candidate
    r = run("a5", {"campaign": CAMP, "course": COURSE_DTO, "objective_narratives": ["Career outcome"]})
    for n in r["narratives"]:
        if n["held"]:
            assert n["role"] != "Primary", f"Held candidate {n['id']} was marked as Primary"
    prim = [n for n in r["narratives"] if n["role"] == "Primary"]
    assert len(prim) == 1 and not prim[0]["held"]

    # Test 2: If all candidates in pool are held, ensure NO candidate has role == "Primary"
    course_all_claims = dict(COURSE_DTO, claims=[
        {"text": "Placement rate 100%", "status": "Awaiting evidence"},
        {"text": "12 LPA package", "status": "Awaiting evidence"}
    ])
    all_held_pool = [
        ["Career outcome", "100% placement rate guaranteed", "Audience", "Why copy text with 100% placement rate", "High: claim", "Confident", "Hook 1"],
        ["Career outcome", "Package of 12 LPA", "Audience", "Why copy text with 12 LPA salary", "High: claim", "Confident", "Hook 2"],
    ]
    from unittest.mock import patch
    with patch("app.agents.a05_narratives._templates", return_value=all_held_pool):
        r_all_held = run("a5", {"campaign": CAMP, "course": course_all_claims})
        assert all(n["held"] for n in r_all_held["narratives"])
        assert not any(n["role"] == "Primary" for n in r_all_held["narratives"])


def test_a5_groq_validation_and_bounded_retries(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "groq_api_key", "mock-groq-key")
    monkeypatch.setattr(settings, "llm_max_retries", 2)

    # Sub-test 1: Groq returns narratives with why < 100 words -> must be rejected and fallback used
    short_why = "This is a short narrative explanation with only a few words."
    short_narratives = {
        "narratives": [
            {"cls": "Career outcome", "title": "T1", "who": "W1", "why": short_why, "risk": "Low", "tone": "T", "hook": "H"}
        ]
    }
    call_count = 0
    def mock_short(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        return short_narratives

    monkeypatch.setattr("app.agents.a05_narratives.complete_groq_json", mock_short)
    r_short = run("a5", {"campaign": CAMP, "course": COURSE_DTO})
    assert r_short["llm"] is False  # Rejected and fell back to templates
    assert call_count == 3  # 1 initial attempt + 2 retries = 3 bounded retries

    # Sub-test 2: Groq returns valid 120-word narratives -> must be accepted
    valid_why = " ".join(["word"] * 120)
    valid_narratives = {
        "narratives": [
            {"cls": "Career outcome", "title": f"T{i}", "who": "Audience", "why": valid_why, "risk": "Low", "tone": "T", "hook": "H"}
            for i in range(5)
        ]
    }
    monkeypatch.setattr("app.agents.a05_narratives.complete_groq_json", lambda *a, **k: valid_narratives)
    r_valid = run("a5", {"campaign": CAMP, "course": COURSE_DTO})
    assert r_valid["llm"] is True
    assert len(r_valid["narratives"]) == 4
    for n in r_valid["narratives"]:
        assert len(n["why"].split()) == 120


def test_a5_governance_blocks_claims_and_protected():
    from unittest.mock import patch
    valid_why = " ".join(["word"] * 120)
    # Narrative asserting 95% placement rate claim and another with protected attribute
    test_narratives = {
        "narratives": [
            {"cls": "Career outcome", "title": "Top Tech Career", "who": "Engineers", "why": valid_why + " 95% placement rate achieved.", "risk": "Low", "tone": "T", "hook": "H"},
            {"cls": "Speed to employment", "title": "Fast Tech", "who": "women only students", "why": valid_why, "risk": "Low", "tone": "T", "hook": "H"},
            {"cls": "Skill relevance", "title": "Real Skills", "who": "Students", "why": valid_why, "risk": "Low", "tone": "T", "hook": "H"},
            {"cls": "Institutional endorsement", "title": "Endorsed", "who": "Students", "why": valid_why, "risk": "Low", "tone": "T", "hook": "H"},
        ]
    }
    with patch("app.config.settings.groq_api_key", "mock-groq-key"), \
         patch("app.agents.a05_narratives.complete_groq_json", return_value=test_narratives):
        r = run("a5", {"campaign": CAMP, "course": COURSE_DTO})
        # Check claim narrative was caught and held under RR-H03
        claim_n = next(n for n in r["narratives"] if "Top Tech Career" in n["title"])
        assert claim_n["held"] is True
        assert "RR-H03" in claim_n["risk"]
        assert claim_n["role"] != "Primary"

        # Check protected attribute was caught and held under RR-H02
        prot_n = next(n for n in r["narratives"] if "women only" in n["who"])
        assert prot_n["held"] is True
        assert "RR-H02" in prot_n["risk"]
        assert prot_n["role"] != "Primary"


def test_a6_shares_sum_to_100():
    r = run("a6", {"campaign": CAMP, "channel_priors": CFG["channel_priors"]})
    assert sum(x["share"] for x in r["channels"]) == 100
    assert r["channels"][0]["locked"]


def test_a7_gates_match_prototype():
    r = run("a7", {"campaign": CAMP, "sources": SOURCES, "today": TODAY,
                   "gates": CFG["settings"]["gates"]["value"]})
    blocked = {b["name"]: b["rule"] for b in r["blocked"]}
    assert blocked.get("Placement Prep Telugu") == "Reliability gate"
    assert blocked.get("SNIST Placement Cell") == "RR-H06"
    assert r["ranked"][0]["pct"] == 100
    assert r["portfolio"]


def test_a8_a9_a10_pipeline():
    shortlist = [{"source_id": "c3", "posts": 2, "fee": 0}, {"source_id": "c4", "posts": 2, "fee": 15000},
                 {"source_id": "c1", "posts": 2, "fee": 75000}]
    sel = {}
    for sl in shortlist:
        s = next(x for x in SOURCES if x["id"] == sl["source_id"])
        v = run("a8", {"campaign": CAMP, "course": COURSE_DTO, "source": s, "narrative": {"title": "From Warangal to a data team"},
                       "reg_link": "resolence.in/r/applied-ai-b4", "fee": sl["fee"], "posts": sl["posts"]})
        assert all("?t=hq-k9-" in x["link"] for x in v["variants"])
        if sl["fee"]:
            assert all("#ad" in x["caption"] for x in v["variants"])
        sel[sl["source_id"]] = v["variants"][: sl["posts"]]
    p = run("a9", {"campaign": CAMP, "shortlist": shortlist, "sources": SOURCES,
                   "funnel": CFG["settings"]["funnel_defaults"]["value"]})["prediction"]
    assert p["enrols"][0] <= p["enrols"][1] and p["fees"] == 180000
    ch = run("a6", {"campaign": CAMP, "channel_priors": CFG["channel_priors"]})["channels"]
    r = run("a10", {"campaign": dict(CAMP, cohort_size=4000), "course": COURSE_DTO, "prediction": p, "shortlist": shortlist,
                    "sources": SOURCES, "channels": ch, "content_selected": sel, "narratives": []})
    assert len(r["checks"]) == 13 and r["can_create"], [c for c in r["checks"] if c["status"] == "Fail"]


def test_a11_scepticism_alert():
    r = run("a11", {"comments": [{"text": c["text"]} for c in SEED["campaigns"][0]["comments"]], "scepticism_threshold_pct": 15})
    assert r["theme_shares"] and r["summary"]
    assert any(a["kind"] == "Scepticism" for a in r["alerts"])


def test_a12_diagnoses_behind():
    rows = [{"name": "Hyderabad Tech Jobs", "type": "Digital creator", "platform": "Instagram", "status": "Live", "clicks": 6100,
             "regs": 410, "enrols": 2, "fee": 60000, "posts_done": 1, "posts_deal": 2, "cohort_share": 7},
            {"name": "KITS Warangal Placement Cell", "type": "Placement cell", "platform": "WhatsApp", "status": "Delivered",
             "clicks": 1850, "regs": 450, "enrols": 24, "fee": 0, "posts_done": 2, "posts_deal": 2},
            {"name": "Prof. Lakshmi Narayana", "type": "Trainer or mentor", "platform": "YouTube", "status": "Content in review",
             "late": True, "clicks": 0, "regs": 0, "enrols": 0, "posts_done": 0, "posts_deal": 2, "fee": 30000}]
    r = run("a12", {"campaign": {"name": "W", "start": "2026-09-22", "end": "2026-10-26", "status": "Live", "markets": ["Warangal"],
                                 "pred": {"enrols": [105, 160], "clicks": [17000, 26000]}},
                    "today": TODAY, "stats": {"enrols": 45, "clicks": 21000, "regRate": 10}, "sources": rows,
                    "series": [{"day": TODAY, "v": 45}], "settings": {"enrol_rate_floor_pct": 4, "scepticism_threshold_pct": 15}})
    assert r["verdict"] == "Behind"
    assert r["causes"][0]["label"].startswith("Message and programme mismatch")
    assert any(m["type"] == "Chase posting" for m in r["moves"])


def test_copilot_refuses_and_routes():
    assert run("cop", {"message": "Target only women in Warangal"})["rule"] == "RR-H02"
    assert run("cop", {"message": "Send this to this student roll no 22"})["rule"] == "RR-H01"
    r = run("cop", {"message": "Why is it behind?", "context": {"campaign": {"id": "k1", "name": "W"},
                                                               "diagnosis": {"verdict": "Behind", "gap": "15 below", "causes": [{"label": "Adoption gap", "share": 50, "detail": "x"}]},
                                                               "moves": [{"id": "m1", "title": "Chase", "status": "Open"}]}})
    assert r["intent"] == "diagnose" and r["proposal"]["action"]["type"] == "accept_move"


def test_explainability_envelopes_present():
    """Verify that all agents output standard Section 6 explainability envelope metadata."""
    # A1
    r1 = run("a1", {"text": "Duration 16 weeks in Warangal", "lookups": {"district": ["Warangal"]}})
    assert r1["agent_id"] == "A1" and r1["status"] and r1["timestamp"] and "calculation_details" in r1

    # A4
    r4 = run("a4", {"campaign": CAMP, "course": COURSE_DTO, "lookups": {"district": lk("district")}, "settings": {}})
    assert r4["agent_id"] == "A4" and "calculation_details" in r4 and "execution_mode" in r4

    # A5
    r5 = run("a5", {"campaign": CAMP, "course": COURSE_DTO, "objective_narratives": ["Career outcome"]})
    assert r5["agent_id"] == "A5" and "calculation_details" in r5

    # A6
    r6 = run("a6", {"campaign": CAMP, "channel_priors": CFG["channel_priors"]})
    assert r6["agent_id"] == "A6" and "calculation_details" in r6

    # A7
    r7 = run("a7", {"campaign": CAMP, "sources": SOURCES, "today": TODAY, "gates": CFG["settings"]["gates"]["value"]})
    assert r7["agent_id"] == "A7" and "calculation_details" in r7

    # A9
    shortlist = [{"source_id": "c1", "posts": 2, "fee": 75000}]
    r9 = run("a9", {"campaign": CAMP, "shortlist": shortlist, "sources": SOURCES, "funnel": CFG["settings"]["funnel_defaults"]["value"]})
    assert r9["agent_id"] == "A9" and "calculation_details" in r9 and "missing_data" in r9

    # A10
    ch = run("a6", {"campaign": CAMP, "channel_priors": CFG["channel_priors"]})["channels"]
    r10 = run("a10", {"campaign": dict(CAMP, cohort_size=4000), "course": COURSE_DTO, "prediction": r9["prediction"], "shortlist": shortlist,
                      "sources": SOURCES, "channels": ch, "content_selected": {}, "narratives": []})
    assert r10["agent_id"] == "A10" and "validation" in r10

    # A11
    r11 = run("a11", {"comments": [{"text": "eppudu start batch?"}], "scepticism_threshold_pct": 15})
    assert r11["agent_id"] == "A11" and "calculation_details" in r11

    # A12
    r12 = run("a12", {"campaign": {"start": "2026-09-22", "end": "2026-10-26", "pred": {"enrols": [50, 100]}}, "today": TODAY, "stats": {"enrols": 30}, "sources": [], "settings": {}})
    assert r12["agent_id"] == "A12" and "calculation_details" in r12


def test_a7_mathematical_weights_and_breakdown():
    r = run("a7", {"campaign": CAMP, "sources": SOURCES, "today": TODAY, "gates": CFG["settings"]["gates"]["value"]})
    assert r["ranked"]
    top = r["ranked"][0]
    sc = top["score_components"]
    assert all(k in sc for k in ("trust", "qualified_reach", "quality", "fit", "reliability", "reach_score", "weights"))
    
    # Check weights sum to 1.0 (0.40, 0.15, 0.15, 0.20, 0.10)
    w = sc["weights"]
    assert sum(w) == 1.0
    assert w == [0.4, 0.15, 0.15, 0.2, 0.1]
    
    # Recompute composite score with formula: trust^w0 * reach_score^w1 * quality^w2 * fit^w3 * (reliability + 0.1)^w4
    expected_score = (
        (sc["trust"] ** w[0]) *
        (sc["reach_score"] ** w[1]) *
        (sc["quality"] ** w[2]) *
        (sc["fit"] ** w[3]) *
        ((sc["reliability"] + 0.1) ** w[4])
    )
    assert abs(top["score"] - round(expected_score, 4)) < 0.001
    assert r["calculation_details"]["weights"] == [0.4, 0.15, 0.15, 0.2, 0.1]


def test_a9_bands_and_overlap_cap():
    # 1 source: overlap discount is 0
    sl1 = [{"source_id": "c1", "posts": 1}]
    r1 = run("a9", {"campaign": CAMP, "shortlist": sl1, "sources": SOURCES, "funnel": CFG["settings"]["funnel_defaults"]["value"]})
    assert r1["prediction"]["overlap"] == 0.0
    # 8 sources: overlap discount min(0.30, 0.05 * 7) = 0.30
    sl8 = [{"source_id": f"c{i}", "posts": 1} for i in range(1, 9)]
    r8 = run("a9", {"campaign": CAMP, "shortlist": sl8, "sources": SOURCES, "funnel": CFG["settings"]["funnel_defaults"]["value"]})
    assert r8["prediction"]["overlap"] == 0.30
    assert r8["calculation_details"]["band_multipliers"] == {"low": 0.60, "high": 1.45}


def test_a12_lag_curve_and_cause_shares_sum_100():
    rows = [
        {"name": "S1", "type": "Digital creator", "platform": "Instagram", "clicks": 2000, "regs": 100, "enrols": 1, "fee": 10000, "cohort_share": 10},
        {"name": "S2", "type": "Trainer or mentor", "platform": "YouTube", "late": True, "clicks": 0, "regs": 0, "enrols": 0, "fee": 5000},
    ]
    r = run("a12", {
        "campaign": {"name": "Test", "start": "2026-09-01", "end": "2026-10-01", "pred": {"enrols": [100, 200], "clicks": [10000, 20000]}},
        "today": "2026-09-16",
        "stats": {"enrols": 15, "clicks": 5000, "regRate": 8},
        "sources": rows,
        "listening": {"theme_shares": {"Placement doubt": 25}},
        "settings": {"enrol_rate_floor_pct": 4, "scepticism_threshold_pct": 15},
    })
    assert r["verdict"] == "Behind"
    assert len(r["causes"]) >= 2
    total_shares = sum(c["share"] for c in r["causes"])
    assert total_shares == 100, f"Expected 100 but got {total_shares}"


def test_a9_source_pred_resilience():
    # Test handling of mv key, lowercase markets and monotonicity
    raw_source = {
        "id": "c_raw",
        "name": "Raw Creator",
        "type": "Digital creator",
        "platform": "YouTube",
        "mv": 12000,
        "markets": {"warangal": 60, "karimnagar": 40},
        "history": [{"status": "Delivered", "enrols": 10}],
    }
    shortlist = [{"source_id": "c_raw", "posts": 2, "fee": 10000}]
    r = run("a9", {
        "campaign": {"markets": ["Warangal", "Karimnagar"]},
        "shortlist": shortlist,
        "sources": [raw_source],
        "funnel": CFG["settings"]["funnel_defaults"]["value"],
    })
    pred = r["prediction"]
    assert pred["enrols"][0] <= pred["enrols"][1]
    assert pred["reach"][0] > 0
    assert pred["cpi"][0] <= pred["cpi"][1]


def test_a12_missing_today_and_dates():
    # Verify that a12 runs safely when today is omitted or None
    r1 = run("a12", {"campaign": {"start": "2026-09-22", "end": "2026-10-26", "pred": {"enrols": [50, 100]}}, "stats": {"enrols": 30}})
    assert r1["status"] == "OK"
    assert r1["agent_id"] == "A12"

    r2 = run("a12", {"campaign": {"start": "2026-09-22", "pred": {"enrols": [50, 100]}}, "today": None, "stats": {"enrols": 30}})
    assert r2["status"] == "OK"
    assert r2["agent_id"] == "A12"

