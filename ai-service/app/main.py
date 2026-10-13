"""Hire IQ AI service (FastAPI).

Stateless: the Node backend sends all context (records + DB-driven settings)
with every call and persists the results. Endpoints:

  GET  /health
  GET  /v1/agents                      list agents
  POST /v1/agents/{agent_id}           run one agent (a1..a12, cop)
  POST /v1/governance/screen           RR-H01/H02 screen for any free text
"""
from __future__ import annotations

import logging
import time

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

from . import governance
from .agents import REGISTRY
from .config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("hireiq.ai")

app = FastAPI(title="Hire IQ AI Service", version="1.0.0")


def require_key(x_service_key: str | None = Header(default=None)):
    if settings.service_key and x_service_key != settings.service_key:
        raise HTTPException(status_code=401, detail="Invalid service key")


class ScreenIn(BaseModel):
    text: str


@app.get("/health")
def health():
    return {"ok": True, "llm": settings.llm_enabled, "model": settings.llm_model if settings.llm_enabled else None,
            "agents": len(REGISTRY)}


@app.get("/v1/agents", dependencies=[Depends(require_key)])
def list_agents():
    return [{**m.AGENT, "doc": (m.__doc__ or "").strip().split("\n")[0]} for m in REGISTRY.values()]


@app.post("/v1/agents/{agent_id}", dependencies=[Depends(require_key)])
def run_agent(agent_id: str, payload: dict):
    mod = REGISTRY.get(agent_id.lower())
    if not mod:
        raise HTTPException(status_code=404, detail=f"Unknown agent {agent_id}")
    t0 = time.perf_counter()
    try:
        result = mod.run(payload or {})
    except Exception as e:
        log.exception("Agent %s failed", agent_id)
        raise HTTPException(status_code=500, detail=f"{mod.AGENT['id']} failed: {e}")
    ms = int((time.perf_counter() - t0) * 1000)
    log.info("agent=%s ms=%s llm=%s", mod.AGENT["id"], ms, result.get("llm") if isinstance(result, dict) else None)
    return {"agent": mod.AGENT["id"], "name": mod.AGENT["name"], "ms": ms,
            "llm": bool(isinstance(result, dict) and result.get("llm")), "result": result}


@app.post("/v1/governance/screen", dependencies=[Depends(require_key)])
def screen(body: ScreenIn):
    r = governance.screen_request(body.text)
    return {"refused": bool(r), **(r or {}), "claim": governance.has_claim(body.text)}
