export type Kind = "decision" | "llm";

export interface ModelInfo {
  key: string;
  label: string;
  model_id: string;
  kind: Kind;
}

export interface Config {
  student_name: string;
  roll_no: string;
  live_available: boolean;
  models: ModelInfo[];
  rules: {
    max_moves: number;
    time_limit_s: number;
    move_timeout_s: number;
    max_retries: number;
    recent_moves_window: number;
    opus_reasoning_effort: string;
  };
}

export interface Puzzle {
  id: string;
  set: "warmup" | "primary" | "extension";
  scramble: string[];
  facelets: string;
  optimal_length: number;
  optimal_solution: string[];
  optimal_exact: boolean;
  optimal_source: string;
}

export type Status =
  | "waiting"
  | "thinking"
  | "solved"
  | "out_of_moves"
  | "out_of_time"
  | "budget_stop"
  | "api_error";

export interface RaceEvent {
  type: string;
  race_id?: string;
  t: number;
  [k: string]: any;
}

export interface GameView {
  key: string;
  label: string;
  kind: Kind;
  model_id: string;
  status: Status;
  facelets: string;
  moves: number;
  forfeits: number;
  history: { move: string | null; latency: number; confidence: number | null }[];
  moveSeq: number;
  lastMove: string | null;
  endT: number | null;
  invalid: number;
  rank: number | null;
  gap: number | null;
}

export interface ModelSummary {
  model_key: string;
  label: string;
  model_id: string;
  kind: Kind;
  trials: number;
  solved: number;
  solve_rate: number;
  decisions: number;
  mean_latency_s: number | null;
  median_latency_s: number | null;
  p95_latency_s: number | null;
  mean_total_time_s: number | null;
  mean_total_time_solved_s: number | null;
  mean_moves: number | null;
  mean_moves_solved: number | null;
  mean_optimal_solved: number | null;
  mean_gap: number | null;
  zero_gap: number;
  invalid_outputs: number;
  retries: number;
  forfeits: number;
  out_of_moves: number;
  out_of_time: number;
  mean_confidence: number | null;
  cost_usd: number;
  mean_rank: number | null;
}

export interface Summary {
  trial_count: number;
  by_set: Record<string, ModelSummary[]>;
  overall: ModelSummary[];
  per_puzzle: any[];
}
