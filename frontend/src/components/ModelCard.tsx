import { memo } from "react";
import Cube3D from "../cube/Cube3D";
import CubeNet from "../cube/CubeNet";
import { fmtLatency, fmtTime } from "../race";
import type { GameView } from "../types";
import { KIND_LABEL, engineColor } from "./stats";

const MemoCube = memo(Cube3D);
const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th"];
const TAPE_SLOTS = 30;
/** Short label for a forfeited turn, by reason (from the backend runner). */
const NO_MOVE: Record<string, string> = { refused: "refused", malformed: "malformed", timeout: "timed out", api_error: "API error" };

function stateLine(g: GameView, clock: number, optimal: number) {
  switch (g.status) {
    case "waiting":
      return { tone: "", text: "Ready: same scramble, same rules as the other engines" };
    case "thinking":
      return {
        tone: "",
        busy: true,
        text: g.kind === "llm" ? "Reasoning about the next move" : "Choosing the next move",
        figure: `${Math.max(0, clock - g.since).toFixed(1)} s`,
      };
    case "solved": {
      const over = g.gap ?? g.moves - optimal;
      return {
        tone: "ok",
        text: over === 0 ? `Solved in ${g.moves} moves, the shortest possible` : `Solved in ${g.moves} moves, ${over} over the shortest`,
      };
    }
    case "out_of_moves":
      return { tone: "bad", text: `Not solved: used all ${g.moves + g.forfeits} moves` };
    case "out_of_time":
      return { tone: "bad", text: "Not solved: game time limit reached" };
    case "budget_stop":
      return { tone: "bad", text: "Stopped: benchmark budget reached" };
    case "api_error":
      return { tone: "bad", text: "Stopped: the API rejected the request" };
  }
}

export default function EngineLane({ g, index, clock, maxMoves, optimal, showNet }: {
  g: GameView; index: number; clock: number; maxMoves: number; optimal: number; showNet: boolean;
}) {
  const finished = g.endT !== null;
  const time = finished ? g.endT : g.status === "waiting" ? 0 : clock;
  const last = g.history[g.history.length - 1];
  const state = stateLine(g, clock, optimal);
  const slots = Math.max(TAPE_SLOTS, maxMoves);

  return (
    <section className="panel lane" aria-label={`${g.label} lane`}>
      <header className="lane-head">
        <span className="swatch" style={{ background: engineColor(g.key, index) }} aria-hidden="true" />
        <h2 className="lane-name">{g.label}</h2>
        <span className="lane-kind">{KIND_LABEL[g.kind]}</span>
        {g.rank !== null && (
          <span className={`lane-rank ${g.rank === 1 ? "lane-rank-1" : ""}`} aria-label={`Ranked ${ORDINAL[g.rank]}`}>
            {ORDINAL[g.rank]}
          </span>
        )}
      </header>

      <div className="lane-body">
        <div className="cube-well">
          <MemoCube facelets={g.facelets} move={g.lastMove} seq={g.moveSeq} />
          {showNet && <div className="cube-net"><CubeNet facelets={g.facelets} size={6} /></div>}
        </div>
        <dl className="readout">
          <div>
            <dt className="readout-label">Time</dt>
            <dd className="readout-value" style={{ margin: 0 }}>{fmtTime(time)}</dd>
          </div>
          <div>
            <dt className="readout-label">Moves</dt>
            <dd className="readout-value" style={{ margin: 0 }}>
              {g.moves}<span className="readout-of"> / {maxMoves}</span>
            </dd>
          </div>
          <div>
            <dt className="readout-label" title="Latency of the decision, and the model's confidence when it reports one">Last move</dt>
            <dd className="readout-value small" style={{ margin: 0 }}>{last ? last.move ?? NO_MOVE[last.reason ?? ""] ?? "no move" : "–"}</dd>
            <dd className="readout-sub" style={{ margin: 0 }}>
              {last ? fmtLatency(last.latency) : ""}
              {last?.confidence != null && <span className="readout-conf">{Math.round(last.confidence * 100)}% confidence</span>}
            </dd>
          </div>
        </dl>
      </div>

      <div className={`lane-state ${state.tone === "ok" ? "lane-state-ok" : state.tone === "bad" ? "lane-state-bad" : ""}`}
        role="status" aria-live="polite">
        {state.busy && <span className="busy" aria-hidden="true" />}
        <span>{state.text}</span>
        {state.figure && <span className="num">{state.figure}</span>}
      </div>

      <div className="tape-head">
        <span>Moves played <span className="num">{g.history.length}</span> of <span className="num">{slots}</span></span>
        <span className="tape-key"><span className="tape-key-par" aria-hidden="true" />Shortest solution: <span className="num">{optimal}</span></span>
      </div>
      <ol className="tape" aria-label={`Moves played, ${g.history.length} of ${slots}. Shaded slots mark the shortest solution, ${optimal} moves.`}>
        {Array.from({ length: slots }, (_, i) => {
          const h = g.history[i];
          const cls = ["slot", i < optimal ? "slot-par" : "", h ? (h.move ? "slot-played" : "slot-forfeit") : "",
            h && i === g.history.length - 1 ? "slot-new" : ""].join(" ");
          return (
            <li key={i} className={cls} title={h ? `Move ${i + 1}: ${h.move ?? `no move (${NO_MOVE[h.reason ?? ""] ?? "invalid"})`}, ${fmtLatency(h.latency)}` : undefined}>
              {h ? h.move ?? "×" : ""}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
