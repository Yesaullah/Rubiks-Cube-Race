"""Offline stand-ins for development and UI testing. Never used for reported results."""
from __future__ import annotations

import asyncio
import random

from ..config import ModelSpec
from ..cube.engine import MOVES
from ..cube.optimal import optimal_solution
from .base import Agent, CallResult, MalformedOutput

# key -> (skill = probability of playing an optimal move, latency range in seconds)
PROFILES = {
    "opus": (0.92, (2.0, 4.5)),
    "jev": (0.35, (0.15, 0.4)),
    "luna": (0.5, (0.3, 0.7)),
    "clef": (0.25, (0.1, 0.3)),
}


class MockAgent(Agent):
    def __init__(self, spec: ModelSpec, move_timeout_s: float, max_retries: int, seed: int):
        super().__init__(spec, move_timeout_s, max_retries)
        self.skill, self.latency = PROFILES.get(spec.key, (0.5, (0.2, 0.5)))
        self.rng = random.Random(seed)

    async def call(self, state: dict) -> CallResult:
        await asyncio.sleep(self.rng.uniform(*self.latency))
        if self.rng.random() < 0.03:
            raise MalformedOutput("mock malformed output", {"move": "Z"})
        move = None
        if self.rng.random() < self.skill:
            sol = await asyncio.to_thread(optimal_solution, state["cube_facelets"], 7)
            if sol:
                move = sol[0]
        if move is None:
            move = self.rng.choice(MOVES)
        conf = round(self.rng.uniform(0.3, 0.95), 3) if self.spec.kind == "decision" else None
        return CallResult(move=move, confidence=conf, usage={})
