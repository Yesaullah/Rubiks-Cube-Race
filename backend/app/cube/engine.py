"""Deterministic 3x3 Rubik's Cube engine.

State is a 54-character facelet string in Kociemba order (U, R, F, D, L, B faces,
9 facelets each, read row by row as the face is conventionally viewed). Each
character names the face whose centre colour the sticker matches, so the solved
cube is "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB".

Move permutations are derived geometrically: every sticker gets a 3D position and
outward normal, and a face turn rotates the stickers of that layer by -90 degrees
about the face normal (clockwise when looking at the face). Metric: HTM, 18 moves.
"""
from __future__ import annotations

FACES = "URFDLB"
SOLVED = "".join(f * 9 for f in FACES)
MOVES: tuple[str, ...] = tuple(f + s for f in FACES for s in ("", "'", "2"))

MOVE_DESCRIPTIONS: dict[str, str] = {}
_FACE_NAMES = {"U": "upper", "R": "right", "F": "front", "D": "down", "L": "left", "B": "back"}
for _f in FACES:
    _n = _FACE_NAMES[_f]
    MOVE_DESCRIPTIONS[_f] = f"Turn the {_n} face clockwise by 90 degrees"
    MOVE_DESCRIPTIONS[_f + "'"] = f"Turn the {_n} face counterclockwise by 90 degrees"
    MOVE_DESCRIPTIONS[_f + "2"] = f"Turn the {_n} face by 180 degrees"

NORMALS = {
    "U": (0, 1, 0), "R": (1, 0, 0), "F": (0, 0, 1),
    "D": (0, -1, 0), "L": (-1, 0, 0), "B": (0, 0, -1),
}
OPPOSITE = {"U": "D", "D": "U", "R": "L", "L": "R", "F": "B", "B": "F"}


def _sticker_position(face: str, r: int, c: int) -> tuple[int, int, int]:
    """Cubie position (x right, y up, z front) of facelet (row r, col c) on a face."""
    if face == "U":
        return (c - 1, 1, r - 1)
    if face == "R":
        return (1, 1 - r, 1 - c)
    if face == "F":
        return (c - 1, 1 - r, 1)
    if face == "D":
        return (c - 1, -1, 1 - r)
    if face == "L":
        return (-1, 1 - r, c - 1)
    if face == "B":
        return (1 - c, 1 - r, -1)
    raise ValueError(face)


STICKERS: list[tuple[tuple[int, int, int], tuple[int, int, int]]] = [
    (_sticker_position(f, i // 3, i % 3), NORMALS[f]) for f in FACES for i in range(9)
]
_INDEX = {s: i for i, s in enumerate(STICKERS)}


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _rotate_cw(v, axis):
    """Rotate v by -90 degrees about unit axis: R(v) = -(axis x v) + axis (axis . v)."""
    cx = _cross(axis, v)
    dot = sum(a * b for a, b in zip(axis, v))
    return tuple(-cx[i] + axis[i] * dot for i in range(3))


def _quarter_turn_source(face: str) -> tuple[int, ...]:
    """src such that new_state[j] = state[src[j]] for one clockwise quarter turn."""
    axis = NORMALS[face]
    src = list(range(54))
    for i, (pos, normal) in enumerate(STICKERS):
        if sum(a * b for a, b in zip(axis, pos)) == 1:
            j = _INDEX[(_rotate_cw(pos, axis), _rotate_cw(normal, axis))]
            src[j] = i
    return tuple(src)


def _compose(first: tuple[int, ...], second: tuple[int, ...]) -> tuple[int, ...]:
    """Source table for applying `first` then `second`."""
    return tuple(first[second[j]] for j in range(54))


PERMS: dict[str, tuple[int, ...]] = {}
for _f in FACES:
    q = _quarter_turn_source(_f)
    PERMS[_f] = q
    PERMS[_f + "2"] = _compose(q, q)
    PERMS[_f + "'"] = _compose(PERMS[_f + "2"], q)


def apply_move(state: str, move: str) -> str:
    src = PERMS[move]
    return "".join(state[k] for k in src)


def apply_moves(state: str, moves) -> str:
    for m in moves:
        state = apply_move(state, m)
    return state


def inverse_move(move: str) -> str:
    if move.endswith("2"):
        return move
    if move.endswith("'"):
        return move[0]
    return move + "'"


def inverse_sequence(moves) -> list[str]:
    return [inverse_move(m) for m in reversed(list(moves))]


def is_solved(state: str) -> bool:
    return all(len(set(state[i * 9:(i + 1) * 9])) == 1 for i in range(6))


def is_valid_state_string(state: str) -> bool:
    return len(state) == 54 and all(state.count(f) == 9 for f in FACES) and \
        all(state[i * 9 + 4] == FACES[i] for i in range(6))


def correct_facelets(state: str) -> int:
    """How many stickers match their face centre (54 = solved). Used for ranking unsolved games."""
    return sum(1 for i, ch in enumerate(state) if ch == state[(i // 9) * 9 + 4])


def faces_grid(state: str) -> dict[str, list[str]]:
    """Human-readable view: each face as three row strings."""
    return {
        f: [state[i * 9 + r * 3:i * 9 + r * 3 + 3] for r in range(3)]
        for i, f in enumerate(FACES)
    }


def simplify(moves) -> list[str]:
    """Cancel/merge consecutive same-face turns (e.g. R R -> R2, R R' -> nothing)."""
    amount = {"": 1, "2": 2, "'": 3}
    out: list[tuple[str, int]] = []
    for m in moves:
        face, q = m[0], amount[m[1:]]
        if out and out[-1][0] == face:
            q = (out[-1][1] + q) % 4
            out.pop()
            if q:
                out.append((face, q))
        else:
            out.append((face, q))
    suffix = {1: "", 2: "2", 3: "'"}
    return [f + suffix[q] for f, q in out]
