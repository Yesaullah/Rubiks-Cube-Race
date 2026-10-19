"""Aggregate trial records into the dashboard / README statistics."""
from __future__ import annotations

import statistics


def _pct(values: list[float], q: float) -> float | None:
    if not values:
        return None
    v = sorted(values)
    k = (len(v) - 1) * q
    lo, hi = int(k), min(int(k) + 1, len(v) - 1)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)


def _mean(values):
    values = [x for x in values if x is not None]
    return statistics.fmean(values) if values else None


def summarize(trials: list[dict], set_name: str | None = None) -> list[dict]:
    rows = [t for t in trials if set_name in (None, "all") or t["set"] == set_name]
    order: list[str] = []
    by_model: dict[str, list[dict]] = {}
    for t in rows:
        if t["model_key"] not in by_model:
            order.append(t["model_key"])
        by_model.setdefault(t["model_key"], []).append(t)

    out = []
    for key in order:
        ts = by_model[key]
        lat = [x for t in ts for x in t["latencies_s"]]
        solved = [t for t in ts if t["solved"]]
        gaps = [t["gap"] for t in solved if t["optimal_exact"]]
        out.append({
            "model_key": key,
            "label": ts[0]["label"],
            "model_id": ts[0]["model_id"],
            "kind": ts[0]["kind"],
            "trials": len(ts),
            "solved": len(solved),
            "solve_rate": len(solved) / len(ts),
            "decisions": len(lat),
            "mean_latency_s": _mean(lat),
            "median_latency_s": statistics.median(lat) if lat else None,
            "p95_latency_s": _pct(lat, 0.95),
            "mean_total_time_s": _mean([t["total_time_s"] for t in ts]),
            "mean_total_time_solved_s": _mean([t["total_time_s"] for t in solved]),
            "mean_moves": _mean([t["moves"] for t in ts]),
            "mean_moves_solved": _mean([t["moves"] for t in solved]),
            "mean_optimal_solved": _mean([t["optimal_length"] for t in solved]),
            "mean_gap": _mean(gaps),
            "zero_gap": sum(1 for g in gaps if g == 0),
            "invalid_outputs": sum(t["invalid_outputs"] for t in ts),
            "retries": sum(t["retries"] for t in ts),
            "forfeits": sum(t["forfeits"] for t in ts),
            "refusals": sum(t.get("refusals", 0) for t in ts),
            "out_of_moves": sum(1 for t in ts if t["status"] == "out_of_moves"),
            "out_of_time": sum(1 for t in ts if t["status"] == "out_of_time"),
            "mean_confidence": _mean([c for t in ts for c in t["confidences"]]),
            "cost_usd": sum(t["cost_usd"] for t in ts),
            "reasoning_tokens": sum(t["tokens"]["reasoning"] for t in ts),
            "mean_rank": _mean([t.get("rank") for t in ts]),
        })
    return out


def per_puzzle(trials: list[dict]) -> list[dict]:
    rows = []
    for t in trials:
        rows.append({k: t.get(k) for k in (
            "race_id", "puzzle_id", "set", "repeat", "optimal_length", "optimal_exact", "label", "status",
            "moves", "gap", "total_time_s", "mean_latency_s", "invalid_outputs", "rank")})
    return rows


def full_summary(trials: list[dict]) -> dict:
    # ad-hoc demo races (single "Run Race" clicks) are logged but not part of the benchmark
    trials = [t for t in trials if t.get("run_kind", "benchmark") == "benchmark"]
    sets = sorted({t["set"] for t in trials}, key=["warmup", "primary", "extension"].index)
    return {
        "trial_count": len(trials),
        "by_set": {s: summarize(trials, s) for s in sets},
        "overall": summarize(trials, None),
        "per_puzzle": per_puzzle(trials),
    }
