import { memo, useEffect, useRef } from "react";
import Cube3D from "../cube/Cube3D";
import CubeNet from "../cube/CubeNet";
import { fmtLatency, fmtTime } from "../race";
import type { GameView } from "../types";

const MemoCube = memo(Cube3D);

const STATUS_TEXT: Record<string, string> = {
  waiting: "ready",
  solved: "SOLVED ✓",
  out_of_moves: "RAN OUT OF MOVES",
  out_of_time: "OUT OF TIME",
  budget_stop: "BUDGET STOP",
  api_error: "API ERROR",
};

const RANK = ["", "1ST", "2ND", "3RD", "4TH"];

export default function ModelCard({ g, clock, maxMoves, showNet }: {
  g: GameView; clock: number; maxMoves: number; showNet: boolean;
}) {
  const finished = g.endT !== null;
  const time = finished ? g.endT : g.status === "waiting" ? 0 : clock;
  const thinking = g.status === "thinking";
  const solved = g.status === "solved";
  const last = g.history[g.history.length - 1];
  const histRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    histRef.current?.scrollTo({ left: histRef.current.scrollWidth, behavior: "smooth" });
  }, [g.history.length]);

  return (
    <div className={`card ${solved ? "card-solved" : ""} ${finished && !solved ? "card-failed" : ""} ${g.rank === 1 ? "card-winner" : ""}`}>
      <div className="card-head">
        <span className="model-name">{g.label}</span>
        <span className={`badge ${g.kind === "llm" ? "badge-llm" : "badge-decision"}`}>
          {g.kind === "llm" ? "LLM" : "DECISION MODEL"}
        </span>
        <span className="model-id">{g.model_id}</span>
      </div>
      <div className="card-body">
        <div className="cube-area">
          <MemoCube facelets={g.facelets} move={g.lastMove} seq={g.moveSeq} />
          {g.rank !== null && <div className={`medal medal-${g.rank}`}>{RANK[g.rank]}</div>}
          {finished && <div className={`ribbon ${solved ? "ribbon-ok" : "ribbon-bad"}`}>{STATUS_TEXT[g.status]}</div>}
          {showNet && <div className="net"><CubeNet facelets={g.facelets} /></div>}
        </div>
        <div className={`stats ${solved ? "stats-ok" : finished ? "stats-bad" : ""}`}>
          <div className="stat-label">TIME</div>
          <div className="stat-big mono">{fmtTime(time)}</div>
          <div className="stat-label">MOVES</div>
          <div className="stat-big mono">
            {g.moves}
            <span className="stat-small">/{maxMoves}</span>
          </div>
          {g.forfeits > 0 && <div className="stat-note">{g.forfeits} forfeited</div>}
          <div className="stat-label">LAST MOVE</div>
          <div className="stat-move mono">{last?.move ?? (last ? "✗" : "–")}</div>
          <div className="stat-note">
            {last ? fmtLatency(last.latency) : ""}
            {last?.confidence != null ? ` · conf ${(last.confidence * 100).toFixed(0)}%` : ""}
          </div>
          <div className={`stat-status ${thinking ? "pulse" : ""}`}>
            {thinking ? (g.kind === "llm" ? "thinking…" : "deciding…") : STATUS_TEXT[g.status] ?? g.status}
          </div>
        </div>
      </div>
      <div className="history" ref={histRef}>
        {g.history.length === 0 && <span className="history-empty">move history</span>}
        {g.history.map((h, i) => (
          <span key={i} className={`chip ${h.move ? "" : "chip-bad"}`} title={fmtLatency(h.latency)}>
            {h.move ?? "✗"}
          </span>
        ))}
      </div>
    </div>
  );
}
