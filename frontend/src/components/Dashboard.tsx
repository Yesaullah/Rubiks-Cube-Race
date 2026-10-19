import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, type Mode } from "../api";
import { fmtLatency, fmtTime } from "../race";
import type { Summary } from "../types";
import { MODEL_COLOR, gapFmt, highlights, num, pct } from "./stats";

const SETS = [
  ["primary", "Primary (4–5 turns)"],
  ["warmup", "Warm-up (3–4)"],
  ["extension", "Extension (15–20)"],
  ["all", "All sets"],
] as const;

export default function Dashboard({ mode, refreshKey }: { mode: Mode; refreshKey: unknown }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [set, setSet] = useState<string>("primary");

  useEffect(() => {
    api.summary(mode).then(setSummary).catch(() => setSummary(null));
  }, [mode, refreshKey]);

  if (!summary || summary.trial_count === 0) {
    return <div className="empty">No {mode} results yet. Run a benchmark from the Race tab.</div>;
  }
  const rows = set === "all" ? summary.overall : summary.by_set[set] ?? [];
  const h = highlights(rows);
  const chart = rows.map((r) => ({
    name: r.label,
    key: r.model_key,
    latency: r.mean_latency_s ?? 0,
    solve: Math.round(r.solve_rate * 100),
    moves: r.mean_moves_solved ?? 0,
    optimal: r.mean_optimal_solved ?? 0,
    total: r.mean_total_time_s ?? 0,
  }));
  const puzzleRows = summary.per_puzzle.filter((p) => set === "all" || p.set === set);
  const puzzleIds = [...new Set(puzzleRows.map((p) => `${p.puzzle_id}#${p.repeat}`))];
  const labels = rows.map((r) => r.label);

  return (
    <div className="dash">
      <div className="tabs">
        {SETS.map(([k, l]) => (
          <button key={k} className={`tab ${set === k ? "tab-on" : ""}`} onClick={() => setSet(k)}>{l}</button>
        ))}
        <span className="muted small">{summary.trial_count} trials recorded ({mode})</span>
      </div>

      {rows.length === 0 ? <div className="empty">No trials in this set yet.</div> : (
        <>
          <div className="tiles">
            <Tile title="Fastest decisions" value={h.fastest?.label} sub={fmtLatency(h.fastest?.mean_latency_s)} />
            <Tile title="Highest solve rate" value={h.bestSolve?.label} sub={pct(h.bestSolve?.solve_rate)} />
            <Tile title="Closest to optimal" value={h.bestGap?.label ?? "nobody solved"} sub={h.bestGap ? `gap ${gapFmt(h.bestGap.mean_gap)}` : ""} />
            <Tile title="Fastest = best quality?" value={h.fastestIsBest ? "Yes" : "No"} sub="speed vs. solution quality" />
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Model</th><th>Type</th><th>Trials</th><th>Success rate</th>
                <th>Avg latency / move</th><th>Median</th><th>p95</th>
                <th>Avg total time</th><th>Avg moves</th><th>Avg moves (solved) vs optimal</th>
                <th>Optimality gap</th><th>Gap = 0</th><th>Invalid outputs</th><th>Retries</th><th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.model_key}>
                  <td><span className="dot" style={{ background: MODEL_COLOR[r.model_key] }} />{r.label}</td>
                  <td>{r.kind === "llm" ? "Frontier LLM" : "Decision"}</td>
                  <td>{r.trials}</td>
                  <td><b>{pct(r.solve_rate)}</b> <span className="muted">({r.solved}/{r.trials})</span></td>
                  <td><b>{fmtLatency(r.mean_latency_s)}</b></td>
                  <td>{fmtLatency(r.median_latency_s)}</td>
                  <td>{fmtLatency(r.p95_latency_s)}</td>
                  <td>{fmtTime(r.mean_total_time_s)}</td>
                  <td>{num(r.mean_moves)}</td>
                  <td>{num(r.mean_moves_solved)} vs {num(r.mean_optimal_solved)}</td>
                  <td><b>{gapFmt(r.mean_gap)}</b></td>
                  <td>{r.zero_gap}</td>
                  <td>{r.invalid_outputs}</td>
                  <td>{r.retries}</td>
                  <td>${r.cost_usd.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="charts">
            <ChartBox title="Avg latency per move (s, log scale)">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" /><YAxis scale="log" domain={["auto", "auto"]} allowDataOverflow />
                <Tooltip formatter={(v: number) => fmtLatency(v)} />
                <Bar dataKey="latency">{chart.map((c) => <Cell key={c.key} fill={MODEL_COLOR[c.key]} />)}</Bar>
              </BarChart>
            </ChartBox>
            <ChartBox title="Success rate (%)">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" /><YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="solve">{chart.map((c) => <Cell key={c.key} fill={MODEL_COLOR[c.key]} />)}</Bar>
              </BarChart>
            </ChartBox>
            <ChartBox title="Moves used vs shortest solution (solved games)">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" /><YAxis />
                <Tooltip /><Legend />
                <Bar dataKey="moves" name="model moves" fill="#6366f1" />
                <Bar dataKey="optimal" name="shortest" fill="#cbd5e1" />
              </BarChart>
            </ChartBox>
            <ChartBox title="Avg total game time (s)">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" /><YAxis />
                <Tooltip formatter={(v: number) => fmtTime(v)} />
                <Bar dataKey="total">{chart.map((c) => <Cell key={c.key} fill={MODEL_COLOR[c.key]} />)}</Bar>
              </BarChart>
            </ChartBox>
          </div>

          <h3>Per-puzzle results</h3>
          <table className="table small">
            <thead>
              <tr><th>Puzzle</th><th>Shortest</th>{labels.map((l) => <th key={l}>{l}</th>)}</tr>
            </thead>
            <tbody>
              {puzzleIds.map((pid) => {
                const cells = puzzleRows.filter((p) => `${p.puzzle_id}#${p.repeat}` === pid);
                return (
                  <tr key={pid}>
                    <td className="mono">{pid.replace("#1", "").replace("#", " r")}</td>
                    <td>{cells[0]?.optimal_length}{cells[0]?.optimal_exact ? "" : "*"}</td>
                    {labels.map((l) => {
                      const c = cells.find((x) => x.label === l);
                      if (!c) return <td key={l}>–</td>;
                      return (
                        <td key={l} className={c.status === "solved" ? "ok" : "bad"}>
                          {c.status === "solved" ? `✓ ${c.moves} (gap ${c.gap >= 0 ? "+" : ""}${c.gap})` :
                            `✗ ${c.status === "out_of_time" ? "time" : c.status === "out_of_moves" ? "moves" : c.status}`}
                          <span className="muted"> · {fmtTime(c.total_time_s)}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">* extension-set reference is a best-known upper bound, not a proven optimum.</p>
        </>
      )}
    </div>
  );
}

function Tile({ title, value, sub }: { title: string; value?: string; sub?: string }) {
  return (
    <div className="tile">
      <div className="tile-title">{title}</div>
      <div className="tile-value">{value ?? "–"}</div>
      <div className="tile-sub">{sub}</div>
    </div>
  );
}

function ChartBox({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="chart">
      <div className="chart-title">{title}</div>
      <ResponsiveContainer width="100%" height={220}>{children}</ResponsiveContainer>
    </div>
  );
}
