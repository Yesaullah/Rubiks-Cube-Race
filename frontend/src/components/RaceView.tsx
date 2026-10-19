import { useCallback, useEffect, useState } from "react";
import { api, type Mode } from "../api";
import CubeNet from "../cube/CubeNet";
import type { RaceState } from "../race";
import type { Config, Puzzle } from "../types";
import ModelCard from "./ModelCard";

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

const SET_LABEL: Record<string, string> = { warmup: "Warm-up", primary: "Primary", extension: "Extension" };

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

  const doReplay = async () => {
    if (!replayId) return;
    const rec = await api.race(mode, replayId);
    startReplay(rec.events, replaySpeed);
  };

  const puzzle = race.puzzle ?? puzzles.find((p) => p.id === puzzleId) ?? null;
  const maxMoves = race.limits?.max_moves ?? config.rules.max_moves;
  const liveBlocked = mode === "live" && !config.live_available;

  return (
    <div className="race">
      <div className="toolbar">
        <div className="tool-group">
          <label>Puzzle</label>
          <select value={puzzleId} onChange={(e) => setPuzzleId(e.target.value)}>
            {puzzles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {SET_LABEL[p.set]} · {p.scramble.length} turns
              </option>
            ))}
          </select>
          <button className="btn primary" disabled={job.running || replaying || liveBlocked}
            onClick={() => act(api.runRace(puzzleId, mode))}>
            ▶ Run Race
          </button>
        </div>
        <div className="tool-group">
          <label>Benchmark set</label>
          <select value={suiteSet} onChange={(e) => setSuiteSet(e.target.value)}>
            <option value="warmup">Warm-up</option>
            <option value="primary">Primary</option>
            <option value="extension">Extension</option>
            <option value="all">All sets</option>
          </select>
          <button className="btn" disabled={job.running || replaying || liveBlocked}
            onClick={() => act(api.runSuite(suiteSet, mode))}>
            Run Benchmark
          </button>
          {job.running && <button className="btn danger" onClick={() => act(api.stop())}>■ Stop</button>}
        </div>
        <div className="tool-group">
          <label>Replay</label>
          <select value={replayId} onFocus={refreshRaces} onChange={(e) => setReplayId(e.target.value)}>
            {races.length === 0 && <option value="">no saved races</option>}
            {races.map((r) => <option key={r.race_id} value={r.race_id}>{r.race_id}</option>)}
          </select>
          <select value={replaySpeed} onChange={(e) => setReplaySpeed(Number(e.target.value))}>
            {[1, 2.5, 5, 10].map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
          {replaying
            ? <button className="btn" onClick={stopReplay}>Skip to end</button>
            : <button className="btn" disabled={!replayId || job.running} onClick={doReplay}>⟲ Replay</button>}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={showNet} onChange={(e) => setShowNet(e.target.checked)} /> cube nets
        </label>
      </div>
      {(error || liveBlocked) && (
        <div className="alert">{error ?? "Live mode needs OPENROUTER_API_KEY in the backend .env file."}</div>
      )}

      <div className="race-info">
        {puzzle && (
          <>
            <div className="race-title">
              <span className="pill">{SET_LABEL[puzzle.set]}</span>
              <b>{puzzle.id}</b>
              {race.raceId && race.repeat > 1 && <span className="muted">repeat {race.repeat}</span>}
            </div>
            <div className="muted mono small">scramble: {puzzle.scramble.join(" ")}</div>
            <div className="muted small">
              {puzzle.optimal_exact ? "shortest solution" : "best-known solution"}:{" "}
              <b>{puzzle.optimal_length} moves</b> ({puzzle.optimal_source})
            </div>
            <div className="race-net"><CubeNet facelets={puzzle.facelets} size={5} /></div>
          </>
        )}
        <div className="race-meta">
          <span className="speed mono">▶▶ {replaying ? `${speed}× replay` : race.mode === "mock" ? "mock" : "live 1×"}</span>
          {job.running && <span className="muted small">running: {job.label}</span>}
          {job.note && <span className="muted small">{job.note}</span>}
          {mode === "live" && <span className="muted small">spend ${job.spent.toFixed(3)}</span>}
        </div>
      </div>

      {race.order.length === 0 ? (
        <div className="empty">Pick a puzzle and press <b>Run Race</b>, or replay a saved race.</div>
      ) : (
        <div className="grid">
          {race.order.map((k) => (
            <ModelCard key={k} g={race.games[k]} clock={clock} maxMoves={maxMoves} showNet={showNet} />
          ))}
        </div>
      )}
    </div>
  );
}
