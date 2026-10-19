from __future__ import annotations

import zlib

from ..config import ModelSpec, Settings
from .base import Agent
from .mock import MockAgent
from .openrouter import ChatAgent, DecisionsAgent


def make_agent(spec: ModelSpec, settings: Settings, mode: str, seed_key: str = "") -> Agent:
    if mode == "mock":
        seed = zlib.crc32(f"{spec.key}:{seed_key}".encode())
        return MockAgent(spec, settings.move_timeout_s, settings.max_retries, seed)
    if spec.kind == "decision":
        return DecisionsAgent(spec, settings.api_key, settings.move_timeout_s, settings.max_retries)
    return ChatAgent(spec, settings.api_key, settings.move_timeout_s, settings.max_retries,
                     settings.opus_reasoning_effort, settings.opus_max_tokens)
