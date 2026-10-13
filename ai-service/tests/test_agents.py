"""Agent tests run against the prototype seed data (database/seed/*.json).

Run:  cd ai-service && python -m pytest -q
(No API key needed: every agent has a deterministic fallback.)
"""
import json
import os
import sys
from pathlib import Path

os.environ["ANTHROPIC_API_KEY"] = ""
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
