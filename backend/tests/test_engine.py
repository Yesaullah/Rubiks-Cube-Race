import random

import pytest

from app.cube.engine import (
    MOVES, SOLVED, apply_move, apply_moves, correct_facelets, inverse_sequence,
    is_solved, is_valid_state_string, simplify,
)
from app.cube.optimal import optimal_solution
from app.cube.scramble import build_suite, random_scramble


def test_solved_state():
    assert is_solved(SOLVED)
    assert correct_facelets(SOLVED) == 54
    assert len(MOVES) == 18


@pytest.mark.parametrize("move", MOVES)
def test_every_move_changes_state_and_is_valid(move):
    s = apply_move(SOLVED, move)
    assert s != SOLVED
    assert is_valid_state_string(s)
    assert not is_solved(s)


@pytest.mark.parametrize("face", "URFDLB")
def test_quarter_turn_order_four(face):
    assert apply_moves(SOLVED, [face] * 4) == SOLVED
    assert apply_moves(SOLVED, [face, face]) == apply_move(SOLVED, face + "2")
    assert apply_moves(SOLVED, [face] * 3) == apply_move(SOLVED, face + "'")


def test_inverse_restores_random_scrambles():
    rng = random.Random(7)
    for _ in range(200):
        seq = [rng.choice(MOVES) for _ in range(25)]
        assert apply_moves(apply_moves(SOLVED, seq), inverse_sequence(seq)) == SOLVED


def test_sexy_move_has_order_six():
    seq = ["R", "U", "R'", "U'"]
    s = SOLVED
    for i in range(6):
        s = apply_moves(s, seq)
        assert (s == SOLVED) == (i == 5)


# Orientation checks against the standard (Kociemba / WCA) convention.
def test_U_cycles_top_rows_front_to_left():
    s = apply_move(SOLVED, "U")
    U, R, F, D, L, B = (s[i * 9:(i + 1) * 9] for i in range(6))
    assert L[:3] == "FFF" and F[:3] == "RRR" and R[:3] == "BBB" and B[:3] == "LLL"


def test_R_moves_front_column_up():
    s = apply_move(SOLVED, "R")
    U, R, F, D, L, B = (s[i * 9:(i + 1) * 9] for i in range(6))
    assert U[2] + U[5] + U[8] == "FFF"
    assert B[0] + B[3] + B[6] == "UUU"
    assert D[2] + D[5] + D[8] == "BBB"
    assert F[2] + F[5] + F[8] == "DDD"


def test_F_moves_up_row_to_right():
    s = apply_move(SOLVED, "F")
    U, R, F, D, L, B = (s[i * 9:(i + 1) * 9] for i in range(6))
    assert R[0] + R[3] + R[6] == "UUU"
    assert U[6:9] == "LLL"
    assert D[:3] == "RRR"
    assert L[2] + L[5] + L[8] == "DDD"


def test_kociemba_cross_check():
    kociemba = pytest.importorskip("kociemba")
    rng = random.Random(3)
    for _ in range(5):
        s = apply_moves(SOLVED, [rng.choice(MOVES) for _ in range(20)])
        assert is_solved(apply_moves(s, kociemba.solve(s).split()))


def test_simplify():
    assert simplify(["R", "R"]) == ["R2"]
    assert simplify(["R", "R'"]) == []
    assert simplify(["U", "R", "R", "R"]) == ["U", "R'"]


@pytest.mark.parametrize("seq,dist", [
    ([], 0), (["R"], 1), (["U2"], 1), (["R", "U"], 2),
    (["R", "U", "F'"], 3), (["R", "U", "R'", "U'"], 4),
])
def test_bfs_known_distances(seq, dist):
    s = apply_moves(SOLVED, seq)
    sol = optimal_solution(s)
    assert len(sol) == dist
    assert is_solved(apply_moves(s, sol))


def test_bfs_never_longer_than_scramble():
    rng = random.Random(11)
    for _ in range(15):
        seq = random_scramble(rng, rng.choice([4, 5]))
        s = apply_moves(SOLVED, seq)
        sol = optimal_solution(s)
        assert len(sol) <= len(seq)
        assert is_solved(apply_moves(s, sol))


def test_suite_is_deterministic_and_consistent():
    a, b = build_suite(), build_suite()
    assert a == b
    for p in a:
        assert apply_moves(SOLVED, p["scramble"]) == p["facelets"]
        assert is_solved(apply_moves(p["facelets"], p["optimal_solution"]))
        assert p["optimal_length"] == len(p["optimal_solution"])
