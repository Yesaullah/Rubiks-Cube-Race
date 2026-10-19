"""Seeded scramble generation and the fixed puzzle suite."""
from __future__ import annotations

import json
import random

from ..config import DATA_DIR
from .engine import FACES, OPPOSITE, SOLVED, apply_moves
from .optimal import optimal_solution, reference_solution

PUZZLES_FILE = DATA_DIR / "puzzles.json"
SUITE_SEED = 20261020

# (set name, scramble lengths) - one puzzle per entry
SUITE_LAYOUT = {
    "warmup": [3, 4],
    "primary": [4, 5, 4, 5, 4, 5, 4, 5, 4, 5],
    "extension": [15, 20],
}


def random_scramble(rng: random.Random, length: int) -> list[str]:
    """Random HTM scramble with no same-face repeats and no X Y X on opposite faces."""
    moves: list[str] = []
    while len(moves) < length:
        face = rng.choice(FACES)
        if moves and face == moves[-1][0]:
            continue
        if len(moves) >= 2 and face == moves[-2][0] and OPPOSITE[face] == moves[-1][0]:
            continue
        moves.append(face + rng.choice(["", "'", "2"]))
    return moves


def build_suite(seed: int = SUITE_SEED) -> list[dict]:
    rng = random.Random(seed)
    puzzles = []
    for set_name, lengths in SUITE_LAYOUT.items():
        for i, length in enumerate(lengths, start=1):
            scramble = random_scramble(rng, length)
            facelets = apply_moves(SOLVED, scramble)
            if set_name == "extension":
                sol, source = reference_solution(facelets, scramble)
                exact = False
            else:
                sol = optimal_solution(facelets, max_depth=10)
                source, exact = "bidirectional BFS", True
            puzzles.append({
                "id": f"{set_name}-{i:02d}",
                "set": set_name,
                "scramble": scramble,
                "facelets": facelets,
                "optimal_length": len(sol),
                "optimal_solution": sol,
                "optimal_exact": exact,
                "optimal_source": source,
            })
    return puzzles


def load_puzzles() -> list[dict]:
    return json.loads(PUZZLES_FILE.read_text(encoding="utf-8"))


def write_suite() -> list[dict]:
    puzzles = build_suite()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PUZZLES_FILE.write_text(json.dumps(puzzles, indent=2), encoding="utf-8")
    return puzzles
