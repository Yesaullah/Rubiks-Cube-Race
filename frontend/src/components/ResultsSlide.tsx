import { useEffect, useState } from "react";
import { api, type Mode } from "../api";
import { fmtLatency, fmtTime } from "../race";
import type { Config, Summary } from "../types";
import { MODEL_COLOR, gapFmt, highlights, num, pct } from "./stats";

export default function ResultsSlide({ mode, config }: { mode: Mode; config: Config }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [set, setSet] = useState("primary");
  useEffect(() => {
    api.summary(mode).then(setSummary).catch(() => setSummary(null));
  }, [mode]);

  const rows = summary ? (set === "all" ? summary.overall : summary.by_set[set] ?? []) : [];
  const h = highlights(rows);
  const puzzles = new Set(summary?.per_puzzle.filter((p) => set === "all" || p.set === set).map((p) => `${p.puzzle_id}#${p.repeat}`));

  return (
    <div className="slide-wrap">
      <div className="slide-controls">
        {["primary", "warmup", "extension", "all"].map((s) => (
          <button key={s} className={`tab ${set === s ? "tab-on" : ""}`} onClick={() => setSet(s)}>{s}</button>
        ))}
      </div>
      <div className="slide">
        <div className="slide-head">
          <div>
            <div className="slide-kicker">AI ENGINEERING · ASSIGNMENT 02</div>
            <h1>Rubik's Cube Race: Benchmark Results</h1>
            <div className="slide-sub">
              {set === "all" ? "All test sets" : `${set[0].toUpperCase()}${set.slice(1)} set`} · {puzzles.size} puzzles × 4 models ·
              limit {config.rules.max_moves} moves / {fmtTime(config.rules.time_limit_s)} · HTM metric
              {mode === "mock" && <b className="mock-flag"> · MOCK DATA</b>}
            </div>
          </div>
          <div className="slide-id">
            <div className="slide-id-name">{config.student_name}</div>
            <div className="slide-id-roll">Roll No: {config.roll_no}</div>
          </div>
        </div>

        <table className="slide-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Avg latency / move</th>
              <th>Avg total time</th>
              <th>Avg total moves</th>
              <th>Success rate</th>
              <th>Optimality gap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.model_key}>
                <td>
                  <span className="dot" style={{ background: MODEL_COLOR[r.model_key] }} />
                  <b>{r.label}</b>
                  <span className={`badge ${r.kind === "llm" ? "badge-llm" : "badge-decision"}`}>
                    {r.kind === "llm" ? "LLM" : "DECISION"}
                  </span>
                </td>
                <td className={h.fastest?.model_key === r.model_key ? "best" : ""}>{fmtLatency(r.mean_latency_s)}</td>
                <td>{fmtTime(r.mean_total_time_s)}</td>
                <td>{num(r.mean_moves)}</td>
                <td className={h.bestSolve?.model_key === r.model_key ? "best" : ""}>
                  {pct(r.solve_rate)} <span className="muted">({r.solved}/{r.trials})</span>
                </td>
                <td className={h.bestGap?.model_key === r.model_key ? "best" : ""}>
                  {gapFmt(r.mean_gap)}
                  {r.mean_gap != null && <span className="muted"> ({r.zero_gap} optimal)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="slide-tiles">
          <div className="slide-tile"><span>Fastest decisions</span><b>{h.fastest?.label ?? "–"}</b></div>
          <div className="slide-tile"><span>Highest solve rate</span><b>{h.bestSolve?.label ?? "–"}</b></div>
          <div className="slide-tile"><span>Closest to optimal</span><b>{h.bestGap?.label ?? "–"}</b></div>
          <div className="slide-tile"><span>Fastest = best quality?</span><b>{h.fastestIsBest ? "Yes" : "No"}</b></div>
        </div>
        <div className="slide-foot">
          Optimality gap = model moves − exact shortest moves (BFS), averaged over solved games. Unsolved = hit the move or time limit.
        </div>
      </div>
    </div>
  );
}
