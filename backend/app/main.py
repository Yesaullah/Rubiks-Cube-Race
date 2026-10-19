"""FastAPI backend: puzzles, race control, live SSE stream, results. The API key never leaves here."""
from __future__ import annotations

import asyncio
import json

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .benchmark import store
from .benchmark.metrics import full_summary
from .benchmark.runner import Broadcaster, RaceRunner
from .config import FRONTEND_DIST, load_settings
from .cube.scramble import PUZZLES_FILE, load_puzzles, write_suite

app = FastAPI(title="Rubik's Cube Race")
settings = load_settings()
bus = Broadcaster()
_job: dict = {"task": None, "label": None, "runner": None}


def _puzzles() -> list[dict]:
    if not PUZZLES_FILE.exists():
        write_suite()
    return load_puzzles()


class RaceRequest(BaseModel):
    puzzle_id: str
    mode: str = "live"
    repeat: int = 1


class SuiteRequest(BaseModel):
    set: str = "primary"
    mode: str = "live"
    repeats: int = 1


def _check_mode(mode: str) -> None:
    if mode not in ("live", "mock"):
        raise HTTPException(400, "mode must be 'live' or 'mock'")
    if mode == "live" and not settings.api_key:
        raise HTTPException(400, "OPENROUTER_API_KEY is not configured on the server")


def _start(label: str, mode: str, puzzles: list[dict], repeats: int, run_kind: str = "benchmark") -> None:
    if _job["task"] and not _job["task"].done():
        raise HTTPException(409, f"already running: {_job['label']}")
    runner = RaceRunner(settings, mode, bus)

    async def job():
        bus.publish({"type": "job_start", "label": label, "mode": mode,
                     "puzzle_ids": [p["id"] for p in puzzles], "repeats": repeats})
        try:
            for r in range(1, repeats + 1):
                for p in puzzles:
                    await runner.run_race(p, repeat=r, run_kind=run_kind)
                    if mode == "live" and runner.spent_usd >= settings.budget_usd:
                        bus.publish({"type": "job_note", "message": "budget reached, stopping"})
                        return
        finally:
            bus.publish({"type": "job_end", "label": label, "spent_usd": runner.spent_usd})

    _job.update(task=asyncio.create_task(job()), label=label, runner=runner)


@app.get("/api/config")
def get_config():
    return {
        "student_name": settings.student_name,
        "roll_no": settings.roll_no,
        "live_available": bool(settings.api_key),
        "models": [{"key": m.key, "label": m.label, "model_id": m.model_id, "kind": m.kind}
                   for m in settings.models],
        "rules": {"max_moves": settings.max_moves, "time_limit_s": settings.game_time_limit_s,
                  "move_timeout_s": settings.move_timeout_s, "max_retries": settings.max_retries,
                  "recent_moves_window": settings.recent_moves_window,
                  "opus_reasoning_effort": settings.opus_reasoning_effort},
    }


@app.get("/api/puzzles")
def get_puzzles():
    return _puzzles()


@app.post("/api/race")
async def post_race(req: RaceRequest):
    _check_mode(req.mode)
    puzzle = next((p for p in _puzzles() if p["id"] == req.puzzle_id), None)
    if not puzzle:
        raise HTTPException(404, "unknown puzzle")
    _start(f"demo race {puzzle['id']}", req.mode, [puzzle], 1, run_kind="demo")
    return {"ok": True}


@app.post("/api/suite")
async def post_suite(req: SuiteRequest):
    _check_mode(req.mode)
    puzzles = [p for p in _puzzles() if req.set == "all" or p["set"] == req.set]
    if not puzzles:
        raise HTTPException(404, "no puzzles in that set")
    _start(f"suite {req.set} x{req.repeats}", req.mode, puzzles, max(1, req.repeats))
    return {"ok": True, "races": len(puzzles) * max(1, req.repeats)}


@app.post("/api/stop")
async def post_stop():
    task = _job["task"]
    if task and not task.done():
        task.cancel()
    return {"ok": True}


@app.get("/api/status")
def get_status():
    task = _job["task"]
    runner = _job["runner"]
    return {"running": bool(task and not task.done()), "label": _job["label"],
            "spent_usd": runner.spent_usd if runner else 0.0, "budget_usd": settings.budget_usd}


@app.get("/api/events")
async def events(request: Request):
    q = bus.subscribe()

    async def stream():
        try:
            yield "retry: 2000\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"data: {json.dumps(ev)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            bus.unsubscribe(q)

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/summary")
def get_summary(mode: str = "live"):
    return full_summary(store.load_trials(mode))


@app.get("/api/races")
def get_races(mode: str = "live"):
    return store.list_races(mode)


@app.get("/api/races/{race_id}")
def get_race(race_id: str, mode: str = "live"):
    rec = store.load_race(mode, race_id)
    if not rec:
        raise HTTPException(404, "race not found")
    return rec


if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        target = FRONTEND_DIST / path
        if path and target.is_file() and FRONTEND_DIST in target.resolve().parents:
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST / "index.html")
