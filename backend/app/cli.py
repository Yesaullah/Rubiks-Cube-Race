"""Headless benchmark CLI.

    python -m app.cli puzzles                       # (re)generate data/puzzles.json
    python -m app.cli run --set warmup --mode live  # run a test set
    python -m app.cli run --puzzle primary-03       # run one puzzle
    python -m app.cli report                        # summary.json, charts, README tables
"""
from __future__ import annotations

import argparse
import asyncio

from .benchmark.runner import RaceRunner
from .config import load_settings
from .cube.scramble import PUZZLES_FILE, load_puzzles, write_suite


def cmd_puzzles(_args) -> None:
    for p in write_suite():
        print(f"{p['id']:14} scramble={' '.join(p['scramble']):<45} optimal={p['optimal_length']} "
              f"({p['optimal_source']})")
    print(f"wrote {PUZZLES_FILE}")


async def _run(args) -> None:
    settings = load_settings()
    if args.mode == "live" and not settings.api_key:
        raise SystemExit("OPENROUTER_API_KEY missing in .env")
    if not PUZZLES_FILE.exists():
        write_suite()
    puzzles = load_puzzles()
    if args.puzzle:
        puzzles = [p for p in puzzles if p["id"] == args.puzzle]
    elif args.set != "all":
        puzzles = [p for p in puzzles if p["set"] == args.set]
    if not puzzles:
        raise SystemExit("no matching puzzles")

    runner = RaceRunner(settings, args.mode)
    for r in range(args.start_repeat, args.start_repeat + args.repeats):
        for p in puzzles:
            trials = await runner.run_race(p, repeat=r)
            print(f"\n{p['id']} (repeat {r}, optimal {p['optimal_length']}):")
            for t in sorted(trials, key=lambda t: t["rank"]):
                print(f"  #{t['rank']} {t['label']:<12} {t['status']:<13} moves={t['moves']:<3} "
                      f"gap={t['gap'] if t['gap'] is not None else '-':<3} time={t['total_time_s']:.1f}s "
                      f"avg/move={t['mean_latency_s'] or 0:.3f}s invalid={t['invalid_outputs']} "
                      f"cost=${t['cost_usd']:.4f}")
            print(f"  session spend so far: ${runner.spent_usd:.4f}")
            if args.mode == "live" and runner.spent_usd >= settings.budget_usd:
                print("budget reached, stopping")
                return


def main() -> None:
    ap = argparse.ArgumentParser(prog="python -m app.cli")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("puzzles")
    run = sub.add_parser("run")
    run.add_argument("--set", default="primary", choices=["warmup", "primary", "extension", "all"])
    run.add_argument("--puzzle")
    run.add_argument("--mode", default="live", choices=["live", "mock"])
    run.add_argument("--repeats", type=int, default=1)
    run.add_argument("--start-repeat", type=int, default=1)
    rep = sub.add_parser("report")
    rep.add_argument("--mode", default="live", choices=["live", "mock"])
    args = ap.parse_args()

    if args.cmd == "puzzles":
        cmd_puzzles(args)
    elif args.cmd == "run":
        asyncio.run(_run(args))
    else:
        from .report import build_report
        build_report(args.mode)


if __name__ == "__main__":
    main()
