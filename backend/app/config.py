"""Runtime configuration, read from the repo-root .env file."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"
RESULTS_DIR = REPO_ROOT / "results"
MOCK_RESULTS_DIR = RESULTS_DIR / "mock"
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"

load_dotenv(REPO_ROOT / ".env")


def _int(name: str, default: int) -> int:
    return int(os.getenv(name, default))


def _float(name: str, default: float) -> float:
    return float(os.getenv(name, default))


@dataclass(frozen=True)
class ModelSpec:
    key: str          # short stable key used in logs and UI
    label: str        # display name
    model_id: str     # OpenRouter model identifier
    kind: str         # "decision" (Decisions API) or "llm" (chat completions)


@dataclass(frozen=True)
class Settings:
    api_key: str
    student_name: str
    roll_no: str
    models: tuple[ModelSpec, ...]
    max_moves: int
    game_time_limit_s: float
    move_timeout_s: float
    max_retries: int
    recent_moves_window: int
    opus_reasoning_effort: str
    opus_max_tokens: int
    budget_usd: float


def load_settings() -> Settings:
    return Settings(
        api_key=os.getenv("OPENROUTER_API_KEY", ""),
        student_name=os.getenv("STUDENT_NAME", "Yesaullah Sheikh"),
        roll_no=os.getenv("ROLL_NO", "ROLL-NO-NOT-SET"),
        models=(
            ModelSpec("opus", "Opus 5.5", os.getenv("MODEL_OPUS", "anthropic/claude-opus-5.5"), "llm"),
            ModelSpec("jev", "Jev 1.13", os.getenv("MODEL_JEV", "typesafe/jev-1.13"), "decision"),
            ModelSpec("luna", "GPT-6 Luna", os.getenv("MODEL_LUNA", "openai/gpt-6-luna-decisions"), "decision"),
            ModelSpec("clef", "Clef", os.getenv("MODEL_CLEF", "cloudflare/clef"), "decision"),
        ),
        max_moves=_int("MAX_MOVES", 30),
        game_time_limit_s=_float("GAME_TIME_LIMIT_S", 300),
        move_timeout_s=_float("MOVE_TIMEOUT_S", 120),
        max_retries=_int("MAX_RETRIES", 2),
        recent_moves_window=_int("RECENT_MOVES_WINDOW", 5),
        opus_reasoning_effort=os.getenv("OPUS_REASONING_EFFORT", "medium"),
        opus_max_tokens=_int("OPUS_MAX_TOKENS", 8000),
        budget_usd=_float("BUDGET_USD", 8),
    )
