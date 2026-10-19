"""The single game-action contract shared by every model.

Decision models and the LLM receive the same state object, the same instruction text
and the same 18 move definitions; only the transport differs.
"""
from __future__ import annotations

from ..cube.engine import MOVES, faces_grid

# Wording note: gpt-6-luna-decisions refused ~75% of requests (HTTP 502 "refused to answer") when
# asked "You are solving a Rubik's Cube ... choose the move most likely to ..." with long per-move
# descriptions. This neutral game wording with bare move names gets ~90% first-try answers.
# Every model receives exactly this text; move notation is explained in FACELET_LEGEND.
INSTRUCTIONS = (
    "This is a 3x3 twisty-puzzle game. Select which face turn to make next to bring the puzzle "
    "closer to its solved state, using as few total turns as possible."
)

FACELET_LEGEND = (
    "cube_facelets is 54 characters: faces in the order U, R, F, D, L, B, 9 stickers each, "
    "read row by row. Each letter names the face whose centre colour that sticker has, so a "
    "face is solved when all 9 of its letters equal its own face letter. Viewing orientation: "
    "U is seen from above with B at the top; R, F, L and B are seen from outside with U at the top; "
    "D is seen from below with F at the top. 'faces' shows the same data as three rows per face. "
    "Move notation: X = clockwise quarter turn of face X (looking at that face), X' = counterclockwise, X2 = half turn."
)


def build_state(facelets: str, history: list[str], max_moves: int, window: int) -> dict:
    return {
        "cube_facelets": facelets,
        "faces": faces_grid(facelets),
        "legend": FACELET_LEGEND,
        "recent_moves": history[-window:] if window > 0 else [],
        "moves_used": len(history),
        "moves_remaining": max_moves - len(history),
    }


def move_criteria() -> dict[str, str]:
    """The 18 options, as bare move names (descriptions raised the Luna refusal rate)."""
    return {m: m for m in MOVES}
