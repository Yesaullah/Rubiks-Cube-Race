"""Exact shortest solutions (HTM) via bidirectional breadth-first search.

Complete for any state whose distance is <= max_depth; practical up to about 10 moves,
which comfortably covers the warm-up and primary sets (3-5 move scrambles).
"""
from __future__ import annotations

from .engine import MOVES, SOLVED, apply_move, inverse_move, is_solved


def optimal_solution(start: str, max_depth: int = 10) -> list[str] | None:
    """Return one shortest move sequence that solves `start`, or None if longer than max_depth."""
    if is_solved(start):
        return []
    fwd: dict[str, tuple[str, str] | None] = {start: None}
    bwd: dict[str, tuple[str, str] | None] = {SOLVED: None}
    fwd_depth = {start: 0}
    bwd_depth = {SOLVED: 0}
    f_front, b_front = [start], [SOLVED]
    df = db = 0

    while df + db < max_depth and f_front and b_front:
        meet: str | None = None
        if len(f_front) <= len(b_front):
            nxt = []
            for s in f_front:
                last = fwd[s][1][0] if fwd[s] else None
                for m in MOVES:
                    if m[0] == last:
                        continue
                    t = apply_move(s, m)
                    if t in fwd:
                        continue
                    fwd[t] = (s, m)
                    fwd_depth[t] = df + 1
                    nxt.append(t)
                    if t in bwd and (meet is None or bwd_depth[t] < bwd_depth[meet]):
                        meet = t
            f_front, df = nxt, df + 1
        else:
            nxt = []
            for s in b_front:
                for m in MOVES:
                    p = apply_move(s, m)  # p --inverse(m)--> s
                    if p in bwd:
                        continue
                    bwd[p] = (s, inverse_move(m))
                    bwd_depth[p] = db + 1
                    nxt.append(p)
                    if p in fwd and (meet is None or fwd_depth[p] < fwd_depth[meet]):
                        meet = p
            b_front, db = nxt, db + 1
        if meet is not None:
            return _join(meet, fwd, bwd)
    return None


def _join(meet, fwd, bwd) -> list[str]:
    head: list[str] = []
    s = meet
    while fwd[s] is not None:
        prev, m = fwd[s]
        head.append(m)
        s = prev
    head.reverse()
    tail: list[str] = []
    s = meet
    while bwd[s] is not None:
        nxt, m = bwd[s]
        tail.append(m)
        s = nxt
    return head + tail


def optimal_distance(start: str, max_depth: int = 10) -> int | None:
    sol = optimal_solution(start, max_depth)
    return None if sol is None else len(sol)


def reference_solution(start: str, scramble: list[str]) -> tuple[list[str], str]:
    """Best known solution for states too deep for BFS (extension set).

    Uses the inverse scramble as an upper bound and Kociemba's two-phase solver
    if the optional `kociemba` package is installed. Not proven optimal.
    """
    from .engine import inverse_sequence, simplify

    best = simplify(inverse_sequence(scramble))
    source = "inverse scramble"
    try:
        import kociemba  # optional dependency

        sol = kociemba.solve(start).split()
        if len(sol) < len(best):
            best, source = sol, "kociemba two-phase"
    except Exception:
        pass
    return best, source
