"""Common agent interface plus the uniform timeout / retry policy."""
from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field

import httpx

from ..config import ModelSpec
from ..cube.engine import MOVES


class MalformedOutput(Exception):
    """The model answered, but not with exactly one valid move. Never coerced into an action."""

    def __init__(self, message: str, raw=None, usage: dict | None = None):
        super().__init__(message)
        self.raw = raw
        self.usage = usage or {}


class FatalAPIError(Exception):
    """Non-retryable API failure (bad request, auth, unknown model...)."""


@dataclass
class CallResult:
    move: str
    confidence: float | None = None
    probabilities: dict | None = None
    usage: dict = field(default_factory=dict)
    raw: object = None


@dataclass
class MoveResult:
    move: str | None
    latency_s: float                     # wall time for the whole decision, retries included
    attempts: int = 1
    retries: int = 0
    invalid_outputs: int = 0
    errors: list[str] = field(default_factory=list)
    confidence: float | None = None
    probabilities: dict | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    reasoning_tokens: int = 0
    cost_usd: float = 0.0
    raw: object = None

    def to_dict(self) -> dict:
        return asdict(self)


RETRYABLE_STATUS = {408, 409, 425, 429, 500, 502, 503, 504, 529}


class Agent(ABC):
    def __init__(self, spec: ModelSpec, move_timeout_s: float, max_retries: int):
        self.spec = spec
        self.move_timeout_s = move_timeout_s
        self.max_retries = max_retries

    @abstractmethod
    async def call(self, state: dict) -> CallResult:
        """One request to the model. Raise MalformedOutput / httpx errors / FatalAPIError."""

    async def decide(self, state: dict) -> MoveResult:
        t0 = time.perf_counter()
        result = MoveResult(move=None, latency_s=0.0, attempts=0)
        for attempt in range(self.max_retries + 1):
            result.attempts = attempt + 1
            try:
                call = await asyncio.wait_for(self.call(state), timeout=self.move_timeout_s)
                _add_usage(result, call.usage)
                if call.move not in MOVES:
                    raise MalformedOutput(f"move {call.move!r} is not one of the 18 legal moves", call.raw)
                result.move = call.move
                result.confidence = call.confidence
                result.probabilities = call.probabilities
                result.raw = call.raw
                break
            except MalformedOutput as e:
                _add_usage(result, e.usage)
                result.invalid_outputs += 1
                result.errors.append(f"malformed: {e}")
                result.raw = e.raw
            except (asyncio.TimeoutError, httpx.TimeoutException):
                result.errors.append(f"timeout after {self.move_timeout_s}s")
            except httpx.HTTPStatusError as e:
                code = e.response.status_code
                result.errors.append(f"http {code}: {e.response.text[:300]}")
                if code not in RETRYABLE_STATUS:
                    break
            except httpx.TransportError as e:
                result.errors.append(f"transport: {e!r}")
            except FatalAPIError as e:
                result.errors.append(f"fatal: {e}")
                break
        result.retries = result.attempts - 1
        result.latency_s = time.perf_counter() - t0
        return result

    async def aclose(self) -> None:
        pass


def _add_usage(result: MoveResult, usage: dict) -> None:
    if not usage:
        return
    result.prompt_tokens += int(usage.get("prompt_tokens") or 0)
    result.completion_tokens += int(usage.get("completion_tokens") or 0)
    details = usage.get("completion_tokens_details") or {}
    result.reasoning_tokens += int(details.get("reasoning_tokens") or 0)
    result.cost_usd += float(usage.get("cost") or 0.0)
