"""OpenRouter adapters: Decisions API (System-1 models) and chat completions (frontier LLM)."""
from __future__ import annotations

import json

import httpx

from ..config import ModelSpec
from .base import Agent, CallResult, FatalAPIError, MalformedOutput
from .prompt import INSTRUCTIONS, move_criteria

DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions"
CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
QUESTION_KEY = "next_move"


def _client(api_key: str) -> httpx.AsyncClient:
    if not api_key:
        raise FatalAPIError("OPENROUTER_API_KEY is not set")
    return httpx.AsyncClient(
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/rubiks-cube-race",
            "X-Title": "Rubik's Cube Race",
        },
        timeout=httpx.Timeout(None),  # the agent enforces the uniform per-move timeout
    )


class DecisionsAgent(Agent):
    """Typed choice question; options are the 18 legal moves. Only `model` differs per model."""

    def __init__(self, spec: ModelSpec, api_key: str, move_timeout_s: float, max_retries: int):
        super().__init__(spec, move_timeout_s, max_retries)
        self.http = _client(api_key)

    def build_request(self, state: dict) -> dict:
        return {
            "model": self.spec.model_id,
            "state": state,
            "questions": {
                QUESTION_KEY: {
                    "type": "choice",
                    "instructions": INSTRUCTIONS,
                    "criteria": move_criteria(),
                }
            },
        }

    async def call(self, state: dict) -> CallResult:
        resp = await self.http.post(DECISIONS_URL, json=self.build_request(state))
        resp.raise_for_status()
        return parse_decision_response(resp.json())

    async def aclose(self) -> None:
        await self.http.aclose()


def _find_answer(data):
    """Locate the answer object for our question, tolerating schema variations."""
    for container in ("answers", "results", "decisions", "questions", "output"):
        block = data.get(container) if isinstance(data, dict) else None
        if isinstance(block, dict) and QUESTION_KEY in block:
            return block[QUESTION_KEY]
        if isinstance(block, list):
            for item in block:
                if isinstance(item, dict) and item.get("key", item.get("id", item.get("question"))) == QUESTION_KEY:
                    return item
    if isinstance(data, dict) and QUESTION_KEY in data:
        return data[QUESTION_KEY]
    return None


def parse_decision_response(data: dict) -> CallResult:
    usage = data.get("usage") or {}
    answer = _find_answer(data)
    if isinstance(answer, dict) and isinstance(answer.get("value"), dict):
        answer = {**answer, **answer["value"]}
    if not isinstance(answer, dict):
        raise MalformedOutput("no answer for next_move in response", data, usage)
    choice = answer.get("choice", answer.get("selected", answer.get("answer")))
    if not isinstance(choice, str):
        raise MalformedOutput(f"answer has no string choice: {answer!r}"[:300], data, usage)
    confidence = answer.get("confidence")
    probs = answer.get("probabilities")
    return CallResult(
        move=choice.strip(),
        confidence=float(confidence) if isinstance(confidence, (int, float)) else None,
        probabilities=probs if isinstance(probs, dict) else None,
        usage=usage,
        raw=data,
    )


SYSTEM_PROMPT = (
    # the same instruction and the same 18 move definitions the decision models get as criteria
    f"{INSTRUCTIONS}\n\nLegal moves (choose exactly one):\n"
    + "\n".join(f"- {m}: {d}" for m, d in move_criteria().items())
    + '\n\nReply with only a JSON object of the form {"move": "<move>"}.'
)

MOVE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "cube_move",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {"move": {"type": "string", "enum": list(move_criteria())}},
            "required": ["move"],
            "additionalProperties": False,
        },
    },
}


class ChatAgent(Agent):
    """Frontier LLM via chat completions with a constrained JSON response."""

    def __init__(self, spec: ModelSpec, api_key: str, move_timeout_s: float, max_retries: int,
                 reasoning_effort: str, max_tokens: int):
        super().__init__(spec, move_timeout_s, max_retries)
        self.http = _client(api_key)
        self.reasoning_effort = reasoning_effort
        self.max_tokens = max_tokens

    def build_request(self, state: dict) -> dict:
        return {
            "model": self.spec.model_id,
            "messages": [
                {"role": "system", "content": [
                    {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}},
                ]},
                {"role": "user", "content": json.dumps(state)},
            ],
            "response_format": MOVE_SCHEMA,
            "reasoning": {"effort": self.reasoning_effort},
            "max_tokens": self.max_tokens,
            "usage": {"include": True},
            "provider": {"require_parameters": True},
        }

    async def call(self, state: dict) -> CallResult:
        resp = await self.http.post(CHAT_URL, json=self.build_request(state))
        resp.raise_for_status()
        return parse_chat_response(resp.json())

    async def aclose(self) -> None:
        await self.http.aclose()


def parse_chat_response(data: dict) -> CallResult:
    usage = data.get("usage") or {}
    if "error" in data:
        raise FatalAPIError(str(data["error"])[:300])
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise MalformedOutput("response has no message content", data, usage)
    try:
        obj = json.loads((content or "").strip())
    except json.JSONDecodeError:
        raise MalformedOutput(f"not valid JSON: {content!r}"[:300], data, usage)
    if not isinstance(obj, dict) or set(obj) != {"move"} or not isinstance(obj["move"], str):
        raise MalformedOutput(f"expected exactly {{'move': str}}, got {obj!r}"[:300], data, usage)
    return CallResult(move=obj["move"], usage=usage, raw={"content": content, "id": data.get("id")})
