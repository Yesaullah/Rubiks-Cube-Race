"""The single game-action contract shared by every model.

Decision models and the LLM receive the same state object, the same instruction text
and the same 18 move definitions; only the transport differs.

The request follows the assignment's own Decisions API example: state = {cube_facelets,
recent_moves}, the instruction sentence from the brief, and one descriptive criterion per move.
Pre-run probes showed why we keep it that minimal: adding extra state fields (a per-face grid,
a facelet legend, move counters) or a longer instruction made openai/gpt-6-luna-decisions refuse
40-100% of mid-game requests (HTTP 502 "refused to answer"); this exact format was answered first
try on 21 of 24 sampled states.
"""
from __future__ import annotations

from ..cube.engine import MOVE_DESCRIPTIONS, MOVES

INSTRUCTIONS = "Choose the single next move most likely to progress toward the solved cube."


def build_state(facelets: str, history: list[str], max_moves: int, window: int) -> dict:
    # max_moves stays in the signature for the runner; the limit itself is enforced by the engine
    return {
        "cube_facelets": facelets,
        "recent_moves": history[-window:] if window > 0 else [],
    }


def move_criteria() -> dict[str, str]:
    return {m: MOVE_DESCRIPTIONS[m] for m in MOVES}
