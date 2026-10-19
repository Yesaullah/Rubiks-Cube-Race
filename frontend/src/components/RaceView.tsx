import { useCallback, useEffect, useState } from "react";
import { api, type Mode } from "../api";
import { fmtLatency, fmtLimit, fmtTime, type RaceState } from "../race";
import type { Config, GameView, Puzzle } from "../types";
import EngineLane from "./ModelCard";
import DataBadge from "./DataBadge";
import { SET_LABEL, engineColor } from "./stats";

interface Props {
  config: Config;
  puzzles: Puzzle[];
  mode: Mode;
  race: RaceState;
  clock: number;
  speed: number;
  replaying: boolean;
  job: { running: boolean; label: string | null; note: string | null; spent: number };
  startReplay: (events: any[], speed: number) => void;
  stopReplay: () => void;
}

/** Stickers that already match their face centre (54 when solved; a fresh scramble leaves ~20 in place). */
const inPlace = (f: string) => [...f].filter((ch, i) => ch === f[Math.floor(i / 9) * 9 + 4]).length;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "primary-03-r1-20261019T193324" -> "primary-03, 19 Oct 19:33" (the id stays the option value). */
function raceLabel(id: string): string {
  const m = id.match(/^(.*)-r(\d+)-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})\d{2}$/);
  if (!m) return id;
  const [, pid, rep, , mo, d, hh, mm] = m;
  return `${pid}${rep !== "1" ? ` run ${rep}` : ""}, ${Number(d)} ${MONTHS[Number(mo) - 1]} ${hh}:${mm}`;
}

/** Live order: finished ranks first, then solved games, then most stickers in place. */
function standings(race: RaceState): GameView[] {
  return race.order.map((k) => race.games[k]).sort((a, b) => {
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
    const sa = a.status === "solved" ? 0 : 1;
    const sb = b.status === "solved" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    if (sa === 0) return a.moves - b.moves;
    return inPlace(b.facelets) - inPlace(a.facelets);
  });
}

export default function RaceView({ config, puzzles, mode, race, clock, speed, replaying, job, startReplay, stopReplay }: Props) {
  const [puzzleId, setPuzzleId] = useState(puzzles.find((p) => p.set === "primary")?.id ?? puzzles[0]?.id);
  const [suiteSet, setSuiteSet] = useState("primary");
  const [races, setRaces] = useState<any[]>([]);
  const [replayId, setReplayId] = useState("");
  const [replaySpeed, setReplaySpeed] = useState(2.5);
  const [showNet, setShowNet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshRaces = useCallback(() => {
    api.races(mode).then((r) => {
      setRaces(r);
      setReplayId((cur) => (r.some((x) => x.race_id === cur) ? cur : r[r.length - 1]?.race_id ?? ""));
    }).catch(() => setRaces([]));
  }, [mode]);
  useEffect(refreshRaces, [refreshRaces, race.raceId, race.ended, job.running]);

  const act = (p: Promise<unknown>) => {
    setError(null);
    p.catch((e) => setError(String(e.message ?? e)));
  };
  const doReplay = () => {
    if (!replayId) return;
    act(api.race(mode, replayId).then((rec) => startReplay(rec.events, replaySpeed)));
  };

  const selected = puzzles.find((p) => p.id === puzzleId) ?? null;
  // Before any race: show the four engines ready on the selected puzzle's scramble.
  const shown: RaceState = race.order.length > 0 || !selected ? race : {
    ...race,
    puzzle: selected,
    order: config.models.map((m) => m.key),
    games: Object.fromEntries(config.models.map((m) => [m.key, {
      key: m.key, label: m.label, kind: m.kind, model_id: m.model_id, status: "waiting" as const,
      facelets: selected.facelets, moves: 0, forfeits: 0, history: [], moveSeq: 0, lastMove: null,
      since: 0, endT: null, invalid: 0, rank: null, gap: null,
    }])),
  };
  const puzzle = shown.puzzle;
  const maxMoves = race.limits?.max_moves ?? config.rules.max_moves;
  const timeLimit = race.limits?.time_limit_s ?? config.rules.time_limit_s;
  const liveBlocked = mode === "live" && !config.live_available;
  const busy = job.running || replaying;
  const running = race.raceId !== null && !race.ended;

  const phase = replaying
    ? { tone: "replay", label: `Replaying at ${speed}× the recorded speed`, value: fmtTime(clock) }
    : running
      ? { tone: "live", label: race.runKind === "demo" ? "Race in progress (demo run)" : "Race in progress", value: fmtTime(clock) }
      : race.ended
        ? { tone: "done", label: "Race finished", value: fmtTime(Math.max(0, ...race.order.map((k) => race.games[k].endT ?? 0))) }
        : { tone: "ready", label: "Ready to race", value: fmtTime(0) };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="title-row">
            <h1>{puzzle ? `Race on ${puzzle.id}` : "Race"}</h1>
            <DataBadge mode={mode} />
          </div>
          {puzzle && (
            <p className="page-sub">
              {SET_LABEL[puzzle.set]} set. Scramble <span className="mono">{puzzle.scramble.join(" ")}</span>,
              shortest solution <b>{puzzle.optimal_length} moves</b> ({puzzle.optimal_exact ? "exact, BFS" : "best known"}).
              Each engine gets {maxMoves} moves and {fmtLimit(timeLimit)}.
            </p>
          )}
        </div>
        <div className={`phase phase-${phase.tone}`} role="status">
          <div className="phase-label"><span className="phase-dot" aria-hidden="true" />{phase.label}</div>
          <div className="phase-value">{phase.value}</div>
        </div>
      </div>

      <div className="toolbar" role="toolbar" aria-label="Race controls">
        <div className="toolbar-group" aria-label="Single race">
          <label className="field">
            <span className="field-label">Puzzle</span>
            <select className="select" value={puzzleId} onChange={(e) => setPuzzleId(e.target.value)}>
              {puzzles.map((p) => (
                <option key={p.id} value={p.id}>{p.id} ({p.scramble.length} turns)</option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" disabled={busy || liveBlocked} onClick={() => act(api.runRace(puzzleId, mode))}>
            Run race
          </button>
        </div>
        <div className="toolbar-group" aria-label="Benchmark run">
          <label className="field">
            <select className="select" aria-label="Benchmark set" value={suiteSet} onChange={(e) => setSuiteSet(e.target.value)}>
              <option value="warmup">Warm-up set</option>
              <option value="primary">Primary set</option>
              <option value="extension">Extension set</option>
              <option value="all">All sets</option>
            </select>
          </label>
          <button className="btn" disabled={busy || liveBlocked} onClick={() => act(api.runSuite(suiteSet, mode))}>
            Run benchmark
          </button>
          {job.running && <button className="btn btn-danger" onClick={() => act(api.stop())}>Stop</button>}
        </div>
        <div className="toolbar-group" aria-label="Replay a saved race">
          <label className="field">
            <span className="field-label">Replay</span>
            <select className="select select-replay" value={replayId} title={replayId} onFocus={refreshRaces} onChange={(e) => setReplayId(e.target.value)}
              disabled={races.length === 0}>
              {races.length === 0 && <option value="">No saved races yet</option>}
              {races.map((r) => <option key={r.race_id} value={r.race_id}>{raceLabel(r.race_id)}</option>)}
            </select>
          </label>
          <select className="select select-narrow" aria-label="Replay speed" value={replaySpeed} onChange={(e) => setReplaySpeed(Number(e.target.value))}>
            {[1, 2.5, 5, 10].map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
          {replaying
            ? <button className="btn" onClick={stopReplay}>Skip to end</button>
            : <button className="btn" disabled={!replayId || job.running} onClick={doReplay}>Replay</button>}
        </div>
        <label className="toolbar-check">
          <input type="checkbox" checked={showNet} onChange={(e) => setShowNet(e.target.checked)} /> Unfolded nets
        </label>
      </div>

      {(error || liveBlocked) && (
        <div className="alert" role="alert">
          <b>{error ? "The server refused the request." : "Live mode is unavailable."}</b>
          <span>{error ?? "Add OPENROUTER_API_KEY to the backend .env file and restart the server."}</span>
        </div>
      )}
      {job.note && <div className="alert" role="status"><b>Benchmark stopped.</b><span>{job.note}</span></div>}

      {shown.order.length === 0 ? (
        <div className="empty-state">
          <h2>No puzzles loaded</h2>
          <p>The server returned no puzzles. Run <span className="mono">python -m app.cli puzzles</span> in the backend folder, then reload.</p>
        </div>
      ) : (
        <div className="race-grid">
          <div className="lanes">
            {shown.order.map((k, i) => (
              <EngineLane key={k} g={shown.games[k]} index={i} clock={clock} maxMoves={maxMoves}
                optimal={shown.puzzle?.optimal_length ?? 0} showNet={showNet} />
            ))}
          </div>
          <aside className="rail" aria-label="Race details">
            <Standings race={shown} />
            <EventLog race={shown} />
          </aside>
        </div>
      )}
      {mode === "live" && job.spent > 0 && (
        <p className="spend">OpenRouter spend this session: <span className="num">${job.spent.toFixed(3)}</span></p>
      )}
    </div>
  );
}

function Standings({ race }: { race: RaceState }) {
  const rows = standings(race);
  const started = race.raceId !== null;
  const note = race.ended ? "Final" : started ? "Live order, not final" : "Not started";
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Standings</h2>
        <span className={`panel-note ${race.ended ? "note-strong" : ""}`}>{note}</span>
      </div>
      <table className="table standings">
        <thead>
          <tr>
            <th className="r"><span className="sr-only">Position</span>#</th>
            <th>Engine</th>
            <th className="r">Moves</th>
            <th className="r" title="Stickers that match their face centre, out of 54. A solved cube has all 54.">Stickers</th>
            <th className="r" title="Mean decision latency per move so far">Latency</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g, i) => {
            const lat = g.history.length ? g.history.reduce((a, h) => a + h.latency, 0) / g.history.length : null;
            const done = g.endT !== null;
            // a position appears only once there is something to rank; final ranks come from the server
            const pos = g.rank ?? (started && g.history.length > 0 ? i + 1 : null);
            return (
              <tr key={g.key}>
                <td className={`r num ${g.rank === null ? "muted" : ""}`}>{pos ?? "–"}</td>
                <td>
                  <span className="engine-cell">
                    <span className="swatch" style={{ background: engineColor(g.key, race.order.indexOf(g.key)) }} aria-hidden="true" />
                    {g.label}
                  </span>
                </td>
                <td className={`r num ${done ? (g.status === "solved" ? "cell-ok" : "cell-bad") : ""}`}>{g.moves}</td>
                <td className="r num">{inPlace(g.facelets)}<span className="of">/54</span></td>
                <td className="r num">{fmtLatency(lat)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="panel-foot">Latency: mean time per decision. Stickers: faces already in place, 54 = solved.</p>
    </section>
  );
}

function EventLog({ race }: { race: RaceState }) {
  const entries = [...race.log].reverse();
  const label = (k: string | null) => (k ? race.games[k]?.label ?? k : "");
  return (
    <section className="panel rail-log">
      <div className="panel-head">
        <h2 className="panel-title">Event log</h2>
        <span className="panel-note">{race.log.length} events, newest first</span>
      </div>
      {entries.length === 0 ? (
        <p className="log-empty">Press Run race. Every move, invalid output and finish appears here with its race time.</p>
      ) : (
        <ol className="log" aria-live="off">
          {entries.map((e) => (
            <li key={e.id} className={e.tone === "ok" ? "log-ok" : e.tone === "bad" ? "log-bad" : e.model ? "" : "log-sys"}>
              <span className="log-t">{fmtTime(e.t)}</span>
              {e.model
                ? <span className="swatch" style={{ background: engineColor(e.model, race.order.indexOf(e.model)), marginTop: 6 }} title={label(e.model)} />
                : <span />}
              <span className="log-text">
                {e.model && <span>{label(e.model)}{e.kind === "move" ? " played " : e.kind === "forfeit" ? ": " : " "}</span>}
                <span className={e.kind === "move" ? "log-move" : ""}>{e.text}</span>
                {e.detail && <span className="log-detail">{e.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
