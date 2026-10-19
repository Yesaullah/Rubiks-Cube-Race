"""Pre-run check: one live move request per model (python -X utf8 probe.py, a few cents). Not part of the benchmark."""
import asyncio
import json

from app.agents.factory import make_agent
from app.agents.prompt import build_state
from app.config import load_settings
from app.cube.scramble import load_puzzles


async def main() -> None:
    s = load_settings()
    p = next(x for x in load_puzzles() if x["set"] == "warmup")
    state = build_state(p["facelets"], [], s.max_moves, s.recent_moves_window)
    for spec in s.models:
        agent = make_agent(spec, s, "live")
        try:
            r = await agent.decide(state)
            d = r.to_dict()
            print(spec.key, spec.model_id, json.dumps({k: d.get(k) for k in
                  ("move", "latency_s", "confidence", "attempts", "invalid_outputs", "error", "cost_usd", "tokens")}, default=str))
            if not d.get("move"):
                print("   raw:", str(d.get("raw"))[:800])
        finally:
            await agent.aclose()


asyncio.run(main())
