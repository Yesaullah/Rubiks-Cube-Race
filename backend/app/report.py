"""Turn recorded trials into results/summary.json, PNG charts and the README results section."""
from __future__ import annotations

import json
import re

from .benchmark import store
from .benchmark.metrics import full_summary
from .config import REPO_ROOT, RESULTS_DIR

CHART_DIR = REPO_ROOT / "docs" / "charts"
README = REPO_ROOT / "README.md"
START, END = "<!-- RESULTS:START -->", "<!-- RESULTS:END -->"
COLORS = {"opus": "#7c3aed", "jev": "#db2777", "luna": "#0ea5e9", "clef": "#f59e0b"}
SET_TITLES = {"primary": "Primary benchmark (4–5 turn scrambles, exact BFS optimum)",
              "warmup": "Warm-up (3–4 turn scrambles)",
              "extension": "Extension (15–20 turn scrambles, best-known reference)"}


def _lat(s):
    if s is None:
        return "–"
    return f"{s * 1000:.0f} ms" if s < 1 else f"{s:.2f} s"


def _time(s):
    if s is None:
        return "–"
    m, sec = divmod(s, 60)
    return f"{int(m)}:{sec:05.2f}"


def _n(x, d=1):
    return "–" if x is None else f"{x:.{d}f}"


def _gap(x):
    return "–" if x is None else f"+{x:.2f}"


def model_table(rows: list[dict]) -> str:
    head = ("| Model | Type | Trials | Success rate | Avg latency / move | Median | p95 | Avg total time "
            "| Avg moves | Avg moves (solved) vs shortest | Mean optimality gap | Gap = 0 | Invalid outputs | Retries | Cost |\n"
            "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n")
    lines = []
    for r in rows:
        lines.append(
            f"| **{r['label']}** (`{r['model_id']}`) | {'Frontier LLM' if r['kind'] == 'llm' else 'Decision'} "
            f"| {r['trials']} | **{r['solve_rate'] * 100:.0f}%** ({r['solved']}/{r['trials']}) "
            f"| **{_lat(r['mean_latency_s'])}** | {_lat(r['median_latency_s'])} | {_lat(r['p95_latency_s'])} "
            f"| {_time(r['mean_total_time_s'])} | {_n(r['mean_moves'])} "
            f"| {_n(r['mean_moves_solved'])} vs {_n(r['mean_optimal_solved'])} | **{_gap(r['mean_gap'])}** "
            f"| {r['zero_gap']} | {r['invalid_outputs']} | {r['retries']} | ${r['cost_usd']:.3f} |")
    return head + "\n".join(lines) + "\n"


def puzzle_table(per_puzzle: list[dict], set_name: str) -> str:
    rows = [p for p in per_puzzle if p["set"] == set_name]
    labels = list(dict.fromkeys(p["label"] for p in rows))
    # one row per race: the same puzzle can be raced more than once, and every trial must be shown
    def race_of(p: dict) -> str:
        return p.get("race_id") or f"{p['puzzle_id']}#{p['repeat']}"

    races = list(dict.fromkeys(race_of(p) for p in rows))
    seen: dict[str, int] = {}
    out = "| Puzzle | Shortest | " + " | ".join(labels) + " |\n|---|---|" + "---|" * len(labels) + "\n"
    for rid in races:
        cells = {p["label"]: p for p in rows if race_of(p) == rid}
        first = next(iter(cells.values()))
        pid = first["puzzle_id"]
        seen[pid] = seen.get(pid, 0) + 1
        line = f"| `{pid}`{'' if seen[pid] == 1 else f' run {seen[pid]}'} | {first['optimal_length']}{'' if first['optimal_exact'] else '*'} |"
        for lab in labels:
            c = cells.get(lab)
            if not c:
                line += " – |"
            elif c["status"] == "solved":
                line += f" ✅ {c['moves']} (+{c['gap']}) · {_time(c['total_time_s'])} |"
            else:
                why = {"out_of_moves": "move limit", "out_of_time": "time limit"}.get(c["status"], c["status"])
                line += f" ❌ {why} · {_time(c['total_time_s'])} |"
        out += line + "\n"
    return out


def charts(rows: list[dict], tag: str) -> list[str]:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    CHART_DIR.mkdir(parents=True, exist_ok=True)
    labels = [r["label"] for r in rows]
    colors = [COLORS.get(r["model_key"], "#64748b") for r in rows]
    files = []

    def save(fig, name):
        path = CHART_DIR / f"{tag}_{name}.png"
        fig.tight_layout()
        fig.savefig(path, dpi=150)
        plt.close(fig)
        files.append(path.relative_to(REPO_ROOT).as_posix())

    fig, ax = plt.subplots(figsize=(6, 3.4))
    vals = [r["mean_latency_s"] or 0 for r in rows]
    ax.bar(labels, vals, color=colors)
    ax.set_yscale("log")
    from matplotlib.ticker import FuncFormatter
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: _lat(v)))
    ax.yaxis.set_minor_formatter(FuncFormatter(lambda v, _: ""))
    ax.set_title("Average latency per move (log scale)")
    for i, v in enumerate(vals):
        ax.text(i, v, _lat(v), ha="center", va="bottom", fontsize=8)
    save(fig, "latency")

    fig, ax = plt.subplots(figsize=(6, 3.4))
    vals = [r["solve_rate"] * 100 for r in rows]
    ax.bar(labels, vals, color=colors)
    ax.set_ylim(0, 105)
    ax.set_title("Success rate (%)")
    for i, v in enumerate(vals):
        ax.text(i, v, f"{v:.0f}%", ha="center", va="bottom", fontsize=8)
    save(fig, "success")

    fig, ax = plt.subplots(figsize=(6, 3.4))
    x = range(len(rows))
    ax.bar([i - 0.2 for i in x], [r["mean_moves_solved"] or 0 for r in rows], 0.4, label="model moves (solved)", color=colors)
    ax.bar([i + 0.2 for i in x], [r["mean_optimal_solved"] or 0 for r in rows], 0.4, label="shortest", color="#cbd5e1")
    ax.set_xticks(list(x), labels)
    ax.set_title("Moves used vs shortest solution (solved games)")
    ax.legend(fontsize=8)
    save(fig, "moves")

    fig, ax = plt.subplots(figsize=(6, 3.4))
    vals = [r["mean_total_time_s"] or 0 for r in rows]
    ax.bar(labels, vals, color=colors)
    ax.set_title("Average total game time (s)")
    for i, v in enumerate(vals):
        ax.text(i, v, _time(v), ha="center", va="bottom", fontsize=8)
    save(fig, "total_time")
    return files


def build_report(mode: str = "live") -> None:
    trials = store.load_trials(mode)
    if not trials:
        raise SystemExit(f"no {mode} trials recorded yet")
    summary = full_summary(trials)
    out_dir = store.base_dir(mode)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    md = [f"_Generated from `{(store.trials_file(mode)).relative_to(REPO_ROOT).as_posix()}` "
          f"({summary['trial_count']} model-puzzle trials)._\n"]
    for set_name in ("primary", "warmup", "extension"):
        rows = summary["by_set"].get(set_name)
        if not rows:
            continue
        md.append(f"### {SET_TITLES[set_name]}\n")
        md.append(model_table(rows))
        if set_name == "primary" and mode == "live":
            files = charts(rows, set_name)
            md.append("\n" + " ".join(f'<img src="{f}" width="49%">' for f in files) + "\n")
        md.append(f"\n<details><summary>Per-puzzle results ({set_name})</summary>\n\n"
                  f"{puzzle_table(summary['per_puzzle'], set_name)}\n</details>\n")
    block = "\n".join(md)
    (out_dir / "report.md").write_text(block, encoding="utf-8")

    if mode == "live" and README.exists():
        text = README.read_text(encoding="utf-8")
        if START in text and END in text:
            text = re.sub(re.escape(START) + ".*?" + re.escape(END),
                          lambda _: f"{START}\n{block}\n{END}", text, flags=re.S)
            README.write_text(text, encoding="utf-8")
            print("README results section updated")
    print(f"wrote {out_dir / 'summary.json'} and {out_dir / 'report.md'}")
