import { useEffect, useState } from "react";
import { api, type Mode } from "../api";
import { fmtLatency, fmtLimit, fmtTime } from "../race";
import type { Config, ModelSummary, Summary } from "../types";
import { MovesVsShortest, RankedBars, TradeoffPlot } from "./charts";
import DataBadge from "./DataBadge";
import { KIND_SHORT, SET_DESC, SET_LABEL, engineColor, findingSentence, gapFmt, highlights, num, pct, raceOf } from "./stats";

const SETS = ["primary", "warmup", "extension", "all"] as const;

type Col = {
  key: string;
  head: string;
  get: (r: ModelSummary) => number | null;
  fmt: (r: ModelSummary) => string;
  better?: "lower" | "higher";
};

const GROUPS: { name: string; cols: Col[] }[] = [
  {
    name: "Decision latency, per move",
    cols: [
      { key: "lat", head: "Mean", get: (r) => r.mean_latency_s, fmt: (r) => fmtLatency(r.mean_latency_s), better: "lower" },
      { key: "med", head: "Median", get: (r) => r.median_latency_s, fmt: (r) => fmtLatency(r.median_latency_s) },
      { key: "p95", head: "p95", get: (r) => r.p95_latency_s, fmt: (r) => fmtLatency(r.p95_latency_s) },
    ],
  },
  {
    name: "Per game",
    cols: [
      { key: "tot", head: "Avg game time", get: (r) => r.mean_total_time_s, fmt: (r) => fmtTime(r.mean_total_time_s) },
      { key: "mv", head: "Avg moves, all games", get: (r) => r.mean_moves, fmt: (r) => num(r.mean_moves) },
    ],
  },
  {
    name: "Solution quality",
    cols: [
      { key: "sr", head: "Success rate", get: (r) => r.solve_rate, fmt: (r) => `${pct(r.solve_rate)} (${r.solved}/${r.trials})`, better: "higher" },
      { key: "mvs", head: "Moves vs shortest, solved", get: (r) => r.mean_moves_solved, fmt: (r) => r.mean_moves_solved == null ? "–" : `${num(r.mean_moves_solved)} vs ${num(r.mean_optimal_solved)}` },
      { key: "gap", head: "Optimality gap", get: (r) => r.mean_gap, fmt: (r) => gapFmt(r.mean_gap), better: "lower" },
      { key: "z", head: "Optimal solves", get: (r) => r.zero_gap, fmt: (r) => String(r.zero_gap), better: "higher" },
    ],
  },
  {
    name: "Reliability and cost",
    cols: [
      { key: "inv", head: "Invalid outputs", get: (r) => r.invalid_outputs, fmt: (r) => String(r.invalid_outputs) },
      { key: "ret", head: "Retries", get: (r) => r.retries, fmt: (r) => String(r.retries) },
      { key: "cost", head: "Cost", get: (r) => r.cost_usd, fmt: (r) => `$${r.cost_usd.toFixed(3)}` },
    ],
  },
];

function bestKey(rows: ModelSummary[], c: Col): string | null {
  if (!c.better) return null;
  const vals = rows.map((r) => ({ k: r.model_key, v: c.get(r) })).filter((x) => x.v != null) as { k: string; v: number }[];
  if (vals.length < 2) return null;
  const best = c.better === "lower" ? Math.min(...vals.map((x) => x.v)) : Math.max(...vals.map((x) => x.v));
  const winners = vals.filter((x) => x.v === best);
  return winners.length === 1 ? winners[0].k : null;
}

export default function Dashboard({ mode, config, refreshKey }: { mode: Mode; config: Config; refreshKey: unknown }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [set, setSet] = useState<string>("primary");

  useEffect(() => {
    api.summary(mode).then((s) => { setSummary(s); setState("ok"); }).catch(() => setState("error"));
  }, [mode, refreshKey]);

  const rows = summary ? (set === "all" ? summary.overall : summary.by_set[set] ?? []) : [];
  const puzzleRows = summary ? summary.per_puzzle.filter((p) => set === "all" || p.set === set) : [];
  const puzzleCount = new Set(puzzleRows.map((p) => p.puzzle_id)).size;
  const raceCount = new Set(puzzleRows.map(raceOf)).size;
  const h = highlights(rows);
  const finding = findingSentence(rows);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="title-row">
            <h1>Benchmark results</h1>
            <DataBadge mode={mode} />
          </div>
          <p className="page-sub">
            {rows.length > 0
              ? <>{SET_LABEL[set]} set, {SET_DESC[set]}. {rows.reduce((a, r) => a + r.trials, 0)} trials: {rows.length} engines × {raceCount} races
                {raceCount !== puzzleCount ? ` on ${puzzleCount} puzzles` : ""}. </>
              : null}
            Limit {config.rules.max_moves} moves or {fmtLimit(config.rules.time_limit_s)} per game; ad-hoc demo races are excluded.
          </p>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Test set">
        {SETS.map((k) => (
          <button key={k} role="tab" className="tab" aria-selected={set === k} onClick={() => setSet(k)}>{SET_LABEL[k]}</button>
        ))}
      </div>

      {state === "loading" && <div className="empty-state" aria-busy="true"><h2>Loading results</h2><p>Reading the recorded trials.</p></div>}
      {state === "error" && (
        <div className="empty-state" role="alert"><h2>Couldn't load results</h2><p>The server did not return /api/summary. Check that the backend is running, then switch tabs to retry.</p></div>
      )}
      {state === "ok" && rows.length === 0 && (
        <div className="empty-state">
          <h2>No {mode} trials in this set yet</h2>
          <p>Run this set from the Race view with Run benchmark. Results appear here as soon as each race finishes.</p>
        </div>
      )}

      {state === "ok" && rows.length > 0 && (
        <>
          <section className="panel findings" aria-label="Answers">
            <div className="finding">
              <div className="finding-q">Fastest decisions</div>
              <div className="finding-a">{h.fastest?.label ?? "–"}</div>
              <div className="finding-e num">{fmtLatency(h.fastest?.mean_latency_s)} per move</div>
            </div>
            <div className="finding">
              <div className="finding-q">Highest solve rate</div>
              <div className="finding-a">{h.bestSolve?.label ?? "–"}</div>
              <div className="finding-e num">{pct(h.bestSolve?.solve_rate)}, {h.bestSolve?.solved} of {h.bestSolve?.trials}</div>
            </div>
            <div className="finding">
              <div className="finding-q">Closest to the shortest solution</div>
              <div className="finding-a">{h.bestGap?.label ?? "No engine solved a cube"}</div>
              <div className="finding-e num">{h.bestGap ? `${gapFmt(h.bestGap.mean_gap)} moves on average, ${h.bestGap.zero_gap} optimal` : ""}</div>
            </div>
            <div className="finding">
              <div className="finding-q">Was the fastest also the best?</div>
              <div className="finding-a">{h.fastestIsBest ? "Yes" : "No"}</div>
              <div className="finding-e">
                {h.fastest && `${h.fastest.label} solved ${h.fastest.solved} of ${h.fastest.trials}`}
              </div>
            </div>
          </section>

          <div className="dash-grid">
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Speed against success</h2>
                <span className="panel-note">one point per engine</span>
              </div>
              {finding && <p className="page-sub" style={{ padding: "0 16px", margin: "0 0 4px" }}>{finding.head}</p>}
              <div className="chart-body"><TradeoffPlot rows={rows} height={372} /></div>
            </section>
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Latency per move</h2>
                <span className="panel-note">mean over every decision, lower is faster</span>
              </div>
              <div className="chart-body">
                <RankedBars rows={rows} value={(r) => r.mean_latency_s} fmt={(v) => fmtLatency(v)} tickFmt={(v) => (v === 0 ? "0" : v < 1 ? `${Math.round(v * 1000)} ms` : `${+v.toFixed(2)} s`)} better="lower" name="Avg latency" />
              </div>
              <div className="panel-head" style={{ paddingTop: 4 }}>
                <h2 className="panel-title">Success rate</h2>
                <span className="panel-note">cubes solved within the limits</span>
              </div>
              <div className="chart-body">
                <RankedBars rows={rows} value={(r) => r.solve_rate * 100} fmt={(v) => `${Math.round(v)}%`} better="higher" name="Success" max={100} />
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">All metrics</h2>
              <span className="panel-note">best value per column in blue</span>
            </div>
            <div className="table-wrap">
              <table className="table metrics">
                <thead>
                  <tr>
                    <th rowSpan={2} className="sticky-col" style={{ verticalAlign: "bottom" }}>Engine</th>
                    {GROUPS.map((g) => <th key={g.name} colSpan={g.cols.length} className="group group-start">{g.name}</th>)}
                  </tr>
                  <tr>{GROUPS.flatMap((g) => g.cols.map((c, j) => (
                    <th key={c.key} className={`r wrap ${j === 0 ? "group-start" : ""}`}>{c.head}</th>
                  )))}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.model_key}>
                      <td className="sticky-col">
                        <span className="engine-cell">
                          <span className="swatch" style={{ background: engineColor(r.model_key, config.models.findIndex((m) => m.key === r.model_key)) }} aria-hidden="true" />
                          <span>
                            {r.label}
                            <span className="cell-sub">{KIND_SHORT[r.kind]}</span>
                          </span>
                        </span>
                      </td>
                      {GROUPS.flatMap((g) => g.cols.map((c, j) => (
                        <td key={c.key} className={`r num ${j === 0 ? "group-start" : ""} ${bestKey(rows, c) === r.model_key ? "best" : ""}`}>{c.fmt(r)}</td>
                      )))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="foot-note">
              Optimality gap = moves used − exact shortest moves, averaged over solved games only. Unsolved games hit the
              move or time limit and have no gap. Latency includes retries.
            </p>
          </section>

          <div className="dash-grid section-gap">
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Moves used against the shortest solution</h2>
                <span className="legend">
                  <span><span className="swatch" style={{ background: "var(--series)" }} />Moves used</span>
                  <span><span className="swatch" style={{ background: "var(--series-pale)" }} />Shortest</span>
                </span>
              </div>
              <div className="chart-body"><MovesVsShortest rows={rows} /></div>
              <p className="foot-note">Solved games only, averaged per engine over the puzzles it solved.</p>
            </section>
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Average game time</h2>
                <span className="panel-note">from first request to solved or limit</span>
              </div>
              <div className="chart-body">
                <RankedBars rows={rows} value={(r) => r.mean_total_time_s} fmt={(v) => fmtTime(v)} tickFmt={(v) => `${Math.round(v)} s`} better="lower" highlight={false} name="Avg game time" />
              </div>
              <p className="foot-note">A fast game is not a good game: engines that hit the move limit also finish quickly.</p>
            </section>
          </div>

          <section className="panel section-gap">
            <div className="panel-head">
              <h2 className="panel-title">Every trial</h2>
              <span className="panel-note">moves used, gap to shortest, game time</span>
            </div>
            <PuzzleMatrix rows={rows} puzzleRows={puzzleRows} config={config} />
          </section>
        </>
      )}
    </div>
  );
}

const STATUS_TEXT: Record<string, string> = {
  out_of_time: "Time limit",
  out_of_moves: "Move limit",
  budget_stop: "Budget stop",
  api_error: "API error",
};

function PuzzleMatrix({ rows, puzzleRows, config }: { rows: ModelSummary[]; puzzleRows: any[]; config: Config }) {
  // one row per race, so a puzzle raced twice shows both runs instead of hiding one
  const races = [...new Set(puzzleRows.map(raceOf))];
  const seen: Record<string, number> = {};
  return (
    <div className="table-wrap">
      <table className="table matrix">
        <thead>
          <tr>
            <th className="sticky-col">Puzzle</th>
            <th className="r">Shortest</th>
            {rows.map((r) => (
              <th key={r.model_key} className="r">
                <span className="engine-cell" style={{ justifyContent: "flex-end", fontWeight: 500 }}>
                  <span className="swatch" style={{ background: engineColor(r.model_key, config.models.findIndex((m) => m.key === r.model_key)) }} aria-hidden="true" />{r.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {races.map((k) => {
            const cells = puzzleRows.filter((p) => raceOf(p) === k);
            const first = cells[0];
            seen[first.puzzle_id] = (seen[first.puzzle_id] ?? 0) + 1;
            return (
              <tr key={k}>
                <td className="mono sticky-col">{first.puzzle_id}{seen[first.puzzle_id] > 1 ? <span className="muted"> run {seen[first.puzzle_id]}</span> : null}</td>
                <td className="r num">{first.optimal_length}{first.optimal_exact ? "" : "*"}</td>
                {rows.map((r) => {
                  const c = cells.find((x) => x.label === r.label);
                  if (!c) return <td key={r.model_key} className="r muted">–</td>;
                  const solved = c.status === "solved";
                  return (
                    <td key={r.model_key} className="r num">
                      <span className={solved ? "cell-ok" : "cell-bad"}>
                        {solved ? <>{c.moves} <span className="gap">{c.gap >= 0 ? "+" : ""}{c.gap}</span></> : STATUS_TEXT[c.status] ?? c.status}
                      </span>
                      <span className="cell-time">{fmtTime(c.total_time_s)}</span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="foot-note">Each cell: moves used and gap to the shortest solution (solved), or the limit that ended the game, then the game time.</p>
      {puzzleRows.some((p) => !p.optimal_exact) && <p className="foot-note">* Extension puzzles use a best-known length, not a proven optimum.</p>}
    </div>
  );
}
