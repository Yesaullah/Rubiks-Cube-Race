import type { ModelSummary } from "../types";

export const pct = (x: number | null | undefined) => (x == null ? "–" : `${(x * 100).toFixed(0)}%`);
export const num = (x: number | null | undefined, d = 1) => (x == null ? "–" : x.toFixed(d));
export const gapFmt = (x: number | null | undefined) => (x == null ? "–" : `+${x.toFixed(2)}`);

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

export const KIND_COLOR: Record<string, string> = { llm: "#7c3aed", decision: "#059669" };
export const MODEL_COLOR: Record<string, string> = {
  opus: "#7c3aed", jev: "#db2777", luna: "#0ea5e9", clef: "#f59e0b",
};
