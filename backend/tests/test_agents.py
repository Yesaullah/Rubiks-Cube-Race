import asyncio

import pytest

from app.agents.base import Agent, CallResult, FatalAPIError, MalformedOutput
from app.agents.openrouter import (
    ChatAgent, DecisionsAgent, parse_chat_response, parse_decision_response,
)
from app.agents.prompt import build_state
from app.benchmark.runner import RaceRunner
from app.config import ModelSpec, load_settings
from app.cube.engine import MOVES, SOLVED, apply_moves

SPEC_D = ModelSpec("jev", "Jev", "typesafe/jev-1.13", "decision")
SPEC_L = ModelSpec("opus", "Opus", "anthropic/claude-opus-5.5", "llm")


def test_decision_request_is_identical_except_model():
    a = DecisionsAgent(SPEC_D, "k", 10, 0)
    b = DecisionsAgent(ModelSpec("clef", "Clef", "cloudflare/clef", "decision"), "k", 10, 0)
    state = build_state(SOLVED, [], 30, 5)
    ra, rb = a.build_request(state), b.build_request(state)
    assert ra.pop("model") != rb.pop("model")
    assert ra == rb
    assert set(ra["questions"]["next_move"]["criteria"]) == set(MOVES)


def test_chat_request_constrains_to_legal_moves():
    req = ChatAgent(SPEC_L, "k", 10, 0, "low", 4000).build_request(build_state(SOLVED, [], 30, 5))
    schema = req["response_format"]["json_schema"]["schema"]
    assert schema["properties"]["move"]["enum"] == list(MOVES)
    assert req["reasoning"] == {"effort": "low"}


@pytest.mark.parametrize("payload", [
    {"answers": {"next_move": {"choice": "R'", "confidence": 0.8, "probabilities": {"R'": 0.8}}}},
    {"results": {"next_move": {"value": {"choice": "R'"}}}},
    {"answers": [{"key": "next_move", "choice": "R'"}]},
])
def test_parse_decision_variants(payload):
    assert parse_decision_response(payload).move == "R'"


def test_parse_decision_missing_answer_is_malformed():
    with pytest.raises(MalformedOutput):
        parse_decision_response({"answers": {}})


def _chat(content):
    return {"choices": [{"message": {"content": content}}], "usage": {"cost": 0.01}}


def test_parse_chat_ok():
    assert parse_chat_response(_chat('{"move": "U2"}')).move == "U2"


@pytest.mark.parametrize("content", [
    "U2", '```json\n{"move": "U2"}\n```', '{"move": "U2", "why": "x"}', '{"mv": "U2"}', "",
])
def test_parse_chat_malformed_not_coerced(content):
    with pytest.raises(MalformedOutput):
        parse_chat_response(_chat(content))


class ScriptedAgent(Agent):
    def __init__(self, outputs, retries=2):
        super().__init__(SPEC_L, 5, retries)
        self.outputs = list(outputs)

    async def call(self, state):
        out = self.outputs.pop(0)
        if isinstance(out, Exception):
            raise out
        return CallResult(move=out)


def test_retry_then_success_counts_invalid():
    res = asyncio.run(ScriptedAgent([MalformedOutput("bad"), "X9", "R"]).decide({}))
    assert res.move == "R" and res.invalid_outputs == 2 and res.retries == 2


def test_exhausted_retries_gives_no_move():
    res = asyncio.run(ScriptedAgent(["bad", "bad", "bad"]).decide({}))
    assert res.move is None and res.invalid_outputs == 3


def test_fatal_error_stops_retrying():
    res = asyncio.run(ScriptedAgent([FatalAPIError("no key"), "R"]).decide({}))
    assert res.move is None and res.attempts == 1


def test_mock_race_end_to_end(tmp_path, monkeypatch):
    from app.benchmark import store
    monkeypatch.setattr(store, "MOCK_RESULTS_DIR", tmp_path)
    puzzle = {"id": "t-01", "set": "warmup", "scramble": ["R", "U"],
              "facelets": apply_moves(SOLVED, ["R", "U"]), "optimal_length": 2, "optimal_exact": True}
    trials = asyncio.run(RaceRunner(load_settings(), "mock").run_race(puzzle))
    assert len(trials) == 4
    assert sorted(t["rank"] for t in trials) == [1, 2, 3, 4]
    for t in trials:
        assert t["moves"] + t["forfeits"] <= 30
        state = apply_moves(puzzle["facelets"], t["move_list"])
        assert (state == SOLVED) == t["solved"]
    assert store.load_trials("mock")
