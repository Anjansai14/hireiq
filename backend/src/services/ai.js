/**
 * Client for the Python AI service. Every agent call is logged to agent_runs
 * (who, what entity, duration, whether the LLM was used) for observability.
 */
const config = require('../config');
const db = require('../db');
const { HttpError } = require('../utils/helpers');

async function runAgent(agentId, payload, { entityType = null, entityId = null, log = true } = {}) {
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(`${config.ai.url}/v1/agents/${agentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Service-Key': config.ai.key },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new HttpError(503, `AI service unreachable at ${config.ai.url}. Start it with: uvicorn app.main:app --port 8001`);
  }
  const body = await res.json().catch(() => ({}));
  if (log) {
    await db.insert('agent_runs', {
      agent: agentId.toUpperCase(), entity_type: entityType, entity_id: entityId, status: res.ok ? 'ok' : 'error',
      duration_ms: Date.now() - t0, llm_used: body.llm ? 1 : 0, output: res.ok ? null : body,
    }).catch(() => {});
  }
  if (!res.ok) throw new HttpError(502, body.detail || `Agent ${agentId} failed`);
  return body.result;
}

async function health() {
  try {
    const r = await fetch(`${config.ai.url}/health`);
    return await r.json();
  } catch {
    return { ok: false };
  }
}

module.exports = { runAgent, health };
