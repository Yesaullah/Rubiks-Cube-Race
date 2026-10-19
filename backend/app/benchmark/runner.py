"""Race orchestration: all four models play the same puzzle concurrently under identical rules."""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone

from ..agents.base import Agent
from ..agents.factory import make_agent
from ..agents.prompt import build_state
from ..config import Settings
from ..cube.engine import apply_move, correct_facelets, is_solved
from . import store

STATUS_SOLVED = "solved"
STATUS_OUT_OF_MOVES = "out_of_moves"
STATUS_OUT_OF_TIME = "out_of_time"
STATUS_BUDGET = "budget_stop"
STATUS_ERROR = "api_error"


class Broadcaster:
    """Fan-out of race events to any number of SSE subscribers."""

    def __init__(self):
        self._subs: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=2000)
        self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subs.discard(q)

    def publish(self, event: dict) -> None:
        for q in list(self._subs):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass


class BudgetExceeded(Exception):
    pass


class RaceRunner:
    def __init__(self, settings: Settings, mode: str, broadcaster: Broadcaster | None = None):
        self.settings = settings
        self.mode = mode
        self.bus = broadcaster or Broadcaster()
        self.spent_usd = 0.0
        self.consecutive_api_errors = 0

    # ------------------------------------------------------------------ race
    async def run_race(self, puzzle: dict, repeat: int = 1, run_kind: str = "benchmark") -> list[dict]:
        """run_kind="demo" marks ad-hoc races (e.g. during the recording); they are excluded from stats."""
        started = datetime.now(timezone.utc)
        race_id = f"{puzzle['id']}-r{repeat}-{started.strftime('%Y%m%dT%H%M%S')}"
        events: list[dict] = []
        t0 = time.perf_counter()

        def emit(kind: str, publish: bool = True, **payload):
            ev = {"type": kind, "race_id": race_id, "t": round(time.perf_counter() - t0, 3), **payload}
            events.append(ev)
            if publish:
                self.bus.publish(ev)
            return ev

        specs = self.settings.models
        emit("race_start", mode=self.mode, puzzle=puzzle, repeat=repeat, run_kind=run_kind,
             models=[{"key": s.key, "label": s.label, "model_id": s.model_id, "kind": s.kind} for s in specs],
             limits={"max_moves": self.settings.max_moves, "time_limit_s": self.settings.game_time_limit_s})

        agents = [make_agent(s, self.settings, self.mode, seed_key=f"{puzzle['id']}:{repeat}") for s in specs]
        try:
            trials = await asyncio.gather(*(self._play(a, puzzle, emit) for a in agents))
        finally:
            for a in agents:
                await a.aclose()

        _assign_ranks(trials)
        common = {"race_id": race_id, "mode": self.mode, "run_kind": run_kind, "started_at": started.isoformat(),
                  "puzzle_id": puzzle["id"], "set": puzzle["set"], "repeat": repeat,
                  "optimal_length": puzzle["optimal_length"], "optimal_exact": puzzle["optimal_exact"],
                  "rules": {"max_moves": self.settings.max_moves,
                            "time_limit_s": self.settings.game_time_limit_s,
                            "move_timeout_s": self.settings.move_timeout_s,
                            "max_retries": self.settings.max_retries,
                            "recent_moves_window": self.settings.recent_moves_window,
                            "opus_reasoning_effort": self.settings.opus_reasoning_effort}}
        trials = [{**common, **t} for t in trials]
        end = emit("race_end", publish=False, results=[_public(t) for t in trials])

        store.append_trials(self.mode, trials)
        store.save_race(self.mode, race_id, {"race_id": race_id, "started_at": started.isoformat(),
                                             "puzzle": puzzle, "events": events})
        self.bus.publish(end)  # only after the race is on disk, so clients can list / replay it
        return trials

    # ------------------------------------------------------------------ game
    async def _play(self, agent: Agent, puzzle: dict, emit) -> dict:
        s = self.settings
        spec = agent.spec
        state = puzzle["facelets"]
        history: list[str] = []
        moves_log: list[dict] = []
        forfeits = invalid = retries = refusals = 0
        tokens = {"prompt": 0, "completion": 0, "reasoning": 0}
        cost = 0.0
        errors: list[str] = []
        status = None
        start = time.perf_counter()

        while status is None:
            if is_solved(state):
                status = STATUS_SOLVED
                break
            if len(history) + forfeits >= s.max_moves:
                status = STATUS_OUT_OF_MOVES
                break
            remaining = s.game_time_limit_s - (time.perf_counter() - start)
            if remaining <= 0:
                status = STATUS_OUT_OF_TIME
                break
            if self.mode == "live" and self.spent_usd >= s.budget_usd:
                status = STATUS_BUDGET
                break

            emit("thinking", model=spec.key, turn=len(history) + forfeits + 1)
            payload = build_state(state, history, s.max_moves, s.recent_moves_window)
            try:
                res = await asyncio.wait_for(agent.decide(payload), timeout=remaining)
            except asyncio.TimeoutError:
                status = STATUS_OUT_OF_TIME
                break

            cost += res.cost_usd
            self.spent_usd += res.cost_usd
            invalid += res.invalid_outputs
            retries += res.retries
            tokens["prompt"] += res.prompt_tokens
            tokens["completion"] += res.completion_tokens
            tokens["reasoning"] += res.reasoning_tokens
            errors.extend(res.errors)

            entry = {"turn": len(history) + forfeits + 1, "move": res.move,
                     "latency_s": round(res.latency_s, 4), "attempts": res.attempts,
                     "invalid_outputs": res.invalid_outputs, "confidence": res.confidence,
                     "probabilities": res.probabilities, "cost_usd": res.cost_usd,
                     "errors": res.errors,
                     "elapsed_s": round(time.perf_counter() - start, 3)}
            if res.move is None:
                forfeits += 1
                entry["forfeit_reason"] = forfeit_reason(res)
                refusals += entry["forfeit_reason"] == "refused"
                if any(e.startswith(("fatal", "http 4")) for e in res.errors) and not res.invalid_outputs:
                    status = STATUS_ERROR  # e.g. bad model id / auth: no point continuing
            else:
                state = apply_move(state, res.move)
                history.append(res.move)
            entry["facelets"] = state
            moves_log.append(entry)
            emit("move", model=spec.key, **{k: v for k, v in entry.items() if k != "probabilities"},
                 moves=len(history), forfeits=forfeits)

        total = time.perf_counter() - start
        latencies = [m["latency_s"] for m in moves_log]
        solved = status == STATUS_SOLVED
        trial = {
            "model_key": spec.key, "label": spec.label, "model_id": spec.model_id, "kind": spec.kind,
            "status": status, "solved": solved,
            "moves": len(history), "forfeits": forfeits, "move_list": history,
            "gap": (len(history) - puzzle["optimal_length"]) if solved else None,
            "total_time_s": round(total, 4),
            "latencies_s": latencies,
            "mean_latency_s": round(sum(latencies) / len(latencies), 4) if latencies else None,
            "invalid_outputs": invalid, "retries": retries, "refusals": refusals, "errors": errors[:20],
            "confidences": [m["confidence"] for m in moves_log if m["confidence"] is not None],
            "tokens": tokens, "cost_usd": round(cost, 6),
            "final_facelets": state, "correct_facelets": correct_facelets(state),
            "moves_log": moves_log,
        }
        emit("game_end", model=spec.key, **_public(trial))
        return trial


def forfeit_reason(res) -> str:
    """Why a turn produced no move, from the last attempt's error: the provider refusing to answer
    (HTTP 502 "refused to answer"), malformed output, timeout, or another API/transport error."""
    last = res.errors[-1] if res.errors else ""
    if "refused to answer" in last:
        return "refused"
    if last.startswith("malformed"):
        return "malformed"
    if last.startswith("timeout"):
        return "timeout"
    return "api_error"


def _assign_ranks(trials: list[dict]) -> None:
    """Solved first (fewest moves, then fastest); unsolved by stickers in place, then fastest."""
    def key(t):
        if t["solved"]:
            return (0, t["moves"], t["total_time_s"])
        return (1, -t["correct_facelets"], t["total_time_s"])
    for i, t in enumerate(sorted(trials, key=key), start=1):
        t["rank"] = i


def _public(t: dict) -> dict:
    keys = ("model_key", "label", "status", "solved", "moves", "forfeits", "gap", "total_time_s",
            "mean_latency_s", "invalid_outputs", "retries", "refusals", "cost_usd", "correct_facelets", "rank")
    return {k: t.get(k) for k in keys}
