"""Append-only result storage. Live results and mock (dev) results never mix."""
from __future__ import annotations

import json
from pathlib import Path

from ..config import MOCK_RESULTS_DIR, RESULTS_DIR


def base_dir(mode: str) -> Path:
    return MOCK_RESULTS_DIR if mode == "mock" else RESULTS_DIR


def trials_file(mode: str) -> Path:
    return base_dir(mode) / "trials.jsonl"


def races_dir(mode: str) -> Path:
    return base_dir(mode) / "races"


def append_trials(mode: str, trials: list[dict]) -> None:
    path = trials_file(mode)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        for t in trials:
            f.write(json.dumps(t) + "\n")


def load_trials(mode: str) -> list[dict]:
    path = trials_file(mode)
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def save_race(mode: str, race_id: str, record: dict) -> None:
    d = races_dir(mode)
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{race_id}.json").write_text(json.dumps(record), encoding="utf-8")


def list_races(mode: str) -> list[dict]:
    d = races_dir(mode)
    if not d.exists():
        return []
    out = []
    for p in sorted(d.glob("*.json")):
        rec = json.loads(p.read_text(encoding="utf-8"))
        out.append({"race_id": rec["race_id"], "puzzle_id": rec["puzzle"]["id"],
                    "set": rec["puzzle"]["set"], "started_at": rec["started_at"],
                    "duration_s": rec["events"][-1]["t"] if rec["events"] else 0})
    return out


def load_race(mode: str, race_id: str) -> dict | None:
    p = races_dir(mode) / f"{race_id}.json"
    if not p.exists() or p.parent != races_dir(mode):
        return None
    return json.loads(p.read_text(encoding="utf-8"))
