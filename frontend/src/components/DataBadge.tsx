import type { Mode } from "../api";

/** Marks which data source a view is showing. Mock data must never be mistaken for benchmark results. */
export default function DataBadge({ mode }: { mode: Mode }) {
  return mode === "mock"
    ? <span className="badge badge-mock" title="Simulated engines, not real OpenRouter results">Mock data</span>
    : <span className="badge badge-live" title="Real models through OpenRouter">Live data</span>;
}
