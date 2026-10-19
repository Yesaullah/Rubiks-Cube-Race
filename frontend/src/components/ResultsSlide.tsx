import { useEffect, useState } from "react";
import { api, type Mode } from "../api";
import { fmtLatency, fmtLimit, fmtTime } from "../race";
import type { Config, ModelSummary, Summary } from "../types";
import { TradeoffPlot } from "./charts";
import { KIND_SHORT, SET_DESC, SET_LABEL, engineColor, findingSentence, gapFmt, highlights, num, pct, raceOf } from "./stats";

const SETS = ["primary", "warmup", "extension", "all"] as const;

/** Final scene of the recording: the finding first, then the five section-3 metrics, then the trade-off. */
export default function ResultsSlide({ mode, config }: { mode: Mode; config: Config }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const [set, setSet] = useState("primary");
  useEffect(() => {
    api.summary(mode).then(setSummary).catch(() => setFailed(true));
  }, [mode]);

  const rows: ModelSummary[] = summary ? (set === "all" ? summary.overall : summary.by_set[set] ?? []) : [];
  const h = highlights(rows);
  const finding = findingSentence(rows);
  const setRows = summary?.per_puzzle.filter((p) => set === "all" || p.set === set) ?? [];
  const puzzles = new Set(setRows.map((p) => p.puzzle_id)).size;
  const races = new Set(setRows.map(raceOf)).size;
  const colorOf = (key: string) => engineColor(key, config.models.findIndex((m) => m.key === key));
  const best = (r: ModelSummary, w?: ModelSummary) => (w && w.model_key === r.model_key ? "best" : "");

  return (
    <div>
      <div className="slide-controls">
        <div className="tabs" role="tablist" aria-label="Test set" style={{ marginBottom: 0, borderBottom: 0 }}>
          {SETS.map((s) => (
            <button key={s} role="tab" className="tab" aria-selected={set === s} onClick={() => setSet(s)}>{SET_LABEL[s]}</button>
          ))}
        </div>
        <span className="slide-hint">Use this view as the last scene of the recording.</span>
      </div>

      <article className="slide" aria-label="Benchmark results slide">
        <header className="slide-head">
          <div className="slide-title">
            <div className="slide-kicker">
              Rubik's Cube Race · AI Engineering, Assignment 02
              {mode === "mock" && <span className="slide-mock">Mock data, not benchmark results</span>}
            </div>
            <div>
              {SET_LABEL[set]} set: <span className="num">{races}</span> races{races !== puzzles ? <> on <span className="num">{puzzles}</span> puzzles</> : null}, {SET_DESC[set]}
            </div>
          </div>
          <div className="slide-id">
            <div className="slide-id-name">{config.student_name}</div>
            <div className="slide-id-roll">Roll no. <span className="num">{config.roll_no}</span></div>
          </div>
        </header>

        {failed || rows.length === 0 ? (
          <p className="slide-finding" style={{ gridColumn: "1 / -1" }}>
            {failed ? "Couldn't load results from the server." : `No ${mode} results for this set yet.`}
            <span className="slide-finding-sub">Run the benchmark from the Race view; this slide fills in from the recorded trials.</span>
          </p>
        ) : (
          <>
            {finding && (
              <p className="slide-finding">
                {finding.head}
                <span className="slide-finding-sub">{finding.sub}</span>
              </p>
            )}

            <div className="slide-table-wrap">
            <table className="slide-table">
              <caption className="sr-only">Section 3 metrics per engine</caption>
              <thead>
                <tr>
                  <th>Engine</th>
                  <th>Latency<br />per move</th>
                  <th>Avg total<br />time</th>
                  <th>Avg total<br />moves</th>
                  <th>Success<br />rate</th>
                  <th>Optimality<br />gap</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.model_key}>
                    <td>
                      <span className="swatch" style={{ background: colorOf(r.model_key) }} aria-hidden="true" />
                      {r.label}
                      <span className="slide-kind">{KIND_SHORT[r.kind]}</span>
                    </td>
                    <td className={best(r, h.fastest)}>{fmtLatency(r.mean_latency_s)}</td>
                    <td>{fmtTime(r.mean_total_time_s)}</td>
                    <td>{num(r.mean_moves)}</td>
                    <td className={best(r, h.bestSolve)}>
                      {pct(r.solve_rate)}
                      <span className="slide-sub-cell">{r.solved} of {r.trials}</span>
                    </td>
                    <td className={best(r, h.bestGap)}>
                      {gapFmt(r.mean_gap)}
                      <span className="slide-sub-cell">{r.mean_gap == null ? "none solved" : `${r.zero_gap} optimal`}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="slide-chart">
              <div className="slide-chart-title">Speed against success, one point per engine</div>
              <div style={{ flex: 1, minHeight: 0 }}><TradeoffPlot rows={rows} height="100%" /></div>
            </div>

            <footer className="slide-foot">
              <span>Blue marks the best value where better is unambiguous (not total time: failed games end early).</span>
              <span>Optimality gap = moves used − shortest moves ({set === "extension" ? "best-known reference" : set === "all" ? "exact by BFS; best-known reference for extension" : "exact, bidirectional BFS"}), averaged over solved games. Unsolved = {config.rules.max_moves}-move or {fmtLimit(config.rules.time_limit_s)} limit reached. Same scrambles, rules and retry policy for every engine.</span>
            </footer>
          </>
        )}
      </article>
    </div>
  );
}
