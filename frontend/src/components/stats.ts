import { fmtLatency } from "../race";
import type { ModelSummary } from "../types";

export const pct = (x: number | null | undefined) => (x == null ? "–" : `${Math.round(x * 100)}%`);
export const num = (x: number | null | undefined, d = 1) => (x == null ? "–" : x.toFixed(d));
export const gapFmt = (x: number | null | undefined) => (x == null ? "–" : `+${x.toFixed(2)}`);

/** Stable identity mark per engine (swatch only). Unknown keys fall back by position. */
const ENGINE_VARS: Record<string, string> = {
  opus: "var(--engine-opus)",
  jev: "var(--engine-jev)",
  luna: "var(--engine-luna)",
  clef: "var(--engine-clef)",
};
const FALLBACK = Object.values(ENGINE_VARS);
export function engineColor(key: string, index = 0): string {
  return ENGINE_VARS[key] ?? FALLBACK[index % FALLBACK.length];
}

export const KIND_LABEL: Record<string, string> = {
  llm: "Frontier LLM, chat completions",
  decision: "Decision model, Decisions API",
};
export const KIND_SHORT: Record<string, string> = { llm: "Frontier LLM", decision: "Decision model" };

export interface Highlights {
  fastest?: ModelSummary;
  bestSolve?: ModelSummary;
  bestGap?: ModelSummary;
  fastestIsBest?: boolean;
}

export function highlights(rows: ModelSummary[]): Highlights {
  const withLat = rows.filter((r) => r.mean_latency_s != null);
  const fastest = [...withLat].sort((a, b) => a.mean_latency_s! - b.mean_latency_s!)[0];
  const bestSolve = [...rows].sort((a, b) => b.solve_rate - a.solve_rate || (a.mean_gap ?? 99) - (b.mean_gap ?? 99))[0];
  const withGap = rows.filter((r) => r.mean_gap != null);
  const bestGap = [...withGap].sort((a, b) => a.mean_gap! - b.mean_gap! || b.solve_rate - a.solve_rate)[0];
  return {
    fastest,
    bestSolve,
    bestGap,
    fastestIsBest: !!fastest && fastest.model_key === bestSolve?.model_key && fastest.model_key === bestGap?.model_key,
  };
}

/** The key finding in one sentence plus one line of evidence, computed only from the summary. */
export function findingSentence(rows: ModelSummary[]): { head: string; sub: string } | null {
  const h = highlights(rows);
  if (!h.fastest || !h.bestSolve) return null;
  const f = h.fastest;
  const b = h.bestSolve;
  const solvedOf = (r: ModelSummary) => `${r.solved} of ${r.trials}`;
  if (f.model_key === b.model_key) {
    return {
      head: `${f.label} was both the fastest engine and the most reliable solver.`,
      sub: `${fmtLatency(f.mean_latency_s)} per move and ${solvedOf(f)} cubes solved.`,
    };
  }
  const ratio = b.mean_latency_s && f.mean_latency_s ? b.mean_latency_s / f.mean_latency_s : null;
  return {
    head: `${b.label} solved ${solvedOf(b)} cubes. The fastest engine, ${f.label}, solved ${solvedOf(f)}.`,
    sub:
      `${f.label} answered in ${fmtLatency(f.mean_latency_s)} per move, ${b.label} in ${fmtLatency(b.mean_latency_s)}` +
      (ratio ? ` (${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× slower)` : "") +
      (h.bestGap ? `. Closest to the shortest solution: ${h.bestGap.label}, ${gapFmt(h.bestGap.mean_gap)} moves on average.` : "."),
  };
}

/** Identity of one race in summary.per_puzzle rows (older records without race_id fall back to puzzle and repeat). */
export const raceOf = (p: { race_id?: string; puzzle_id: string; repeat: number }) => p.race_id ?? `${p.puzzle_id}#${p.repeat}`;

export const SET_LABEL: Record<string, string> = {
  primary: "Primary",
  warmup: "Warm-up",
  extension: "Extension",
  all: "All sets",
};
export const SET_DESC: Record<string, string> = {
  primary: "4–5 turn scrambles, exact shortest solution by BFS",
  warmup: "3–4 turn scrambles",
  extension: "15–20 turn scrambles, best-known reference length",
  all: "every test set combined",
};
