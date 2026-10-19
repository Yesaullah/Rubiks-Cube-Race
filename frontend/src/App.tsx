import { useEffect, useState } from "react";
import { api, type Mode } from "./api";
import Dashboard from "./components/Dashboard";
import RaceView from "./components/RaceView";
import ResultsSlide from "./components/ResultsSlide";
import { useRaceEngine } from "./race";
import type { Config, Puzzle } from "./types";

type Tab = "race" | "dashboard" | "slide";
export type StreamState = "connecting" | "open" | "lost";

const TABS: { id: Tab; label: string }[] = [
  { id: "race", label: "Race" },
  { id: "dashboard", label: "Benchmark results" },
  { id: "slide", label: "Results slide" },
];

/** Product mark: one cube face, the centre sticker in the data hue. */
function Mark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}${c}`} x={c * 7} y={r * 7} width="6" height="6" rx="1"
            fill={r === 1 && c === 1 ? "var(--data)" : "var(--ink)"} />
        )),
      )}
    </svg>
  );
}

const STREAM_TEXT: Record<StreamState, string> = {
  connecting: "Connecting to live stream",
  open: "Live stream connected",
  lost: "Stream lost, reconnecting",
};

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [tab, setTab] = useState<Tab>("race");
  const [mode, setMode] = useState<Mode>("live");
  const [stream, setStream] = useState<StreamState>("connecting");
  const [job, setJob] = useState({ running: false, label: null as string | null, note: null as string | null, spent: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const engine = useRaceEngine();
  const { onLiveEvent } = engine;

  useEffect(() => {
    setLoadError(null);
    Promise.all([api.config(), api.puzzles()])
      .then(([c, p]) => {
        setConfig(c);
        setPuzzles(p);
        if (!c.live_available) setMode("mock");
      })
      .catch((e) => setLoadError(String(e.message ?? e)));
    api.status().then((s) => setJob((j) => ({ ...j, running: s.running, label: s.label, spent: s.spent_usd }))).catch(() => {});
  }, [attempt]);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onopen = () => setStream("open");
    es.onerror = () => setStream(es.readyState === EventSource.CLOSED ? "lost" : "lost");
    es.onmessage = (m) => {
      setStream("open");
      const ev = JSON.parse(m.data);
      if (ev.type === "job_start") setJob((j) => ({ ...j, running: true, label: ev.label, note: null }));
      else if (ev.type === "job_end") setJob((j) => ({ ...j, running: false, spent: ev.spent_usd }));
      else if (ev.type === "job_note") setJob((j) => ({ ...j, note: ev.message }));
      else {
        if (ev.type === "move" && ev.cost_usd) setJob((j) => ({ ...j, spent: j.spent + ev.cost_usd }));
        onLiveEvent(ev);
      }
    };
    return () => es.close();
  }, [onLiveEvent]);

  const identity = config && (
    <div className="identity" aria-label="Student">
      <div className="identity-name">{config.student_name}</div>
      <div className="identity-roll">Roll no. <span className="num">{config.roll_no}</span></div>
    </div>
  );

  const modeSwitch = config && (
    <div className="segmented" role="group" aria-label="Model source">
      <button aria-pressed={mode === "live"} disabled={!config.live_available} onClick={() => setMode("live")}
        title={config.live_available ? "Real models through OpenRouter" : "Set OPENROUTER_API_KEY on the server to enable"}>
        Live
      </button>
      <button aria-pressed={mode === "mock"} onClick={() => setMode("mock")}>Mock</button>
    </div>
  );
  const streamStatus = (
    <div className={`stream ${stream === "open" ? "stream-ok" : stream === "lost" ? "stream-bad" : ""}`} role="status">
      <span className="stream-dot" aria-hidden="true" />
      {STREAM_TEXT[stream]}
    </div>
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><Mark /> Rubik's Cube Race</div>
        <nav className="nav" aria-label="Views">
          {TABS.map((t) => (
            <button key={t.id} className="nav-btn" aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          {streamStatus}
          {modeSwitch}
          {identity}
        </div>
        <div className="mobile-tools">{streamStatus}{modeSwitch}</div>
      </header>
      {config && mode === "mock" && (
        <p className="notice">
          <b>Mock mode.</b> Simulated engines for development: these runs are stored separately and never appear in the reported benchmark.
        </p>
      )}

      <main className="main">
        {loadError ? (
          <div className="empty-state" role="alert">
            <h2>Can't reach the benchmark server</h2>
            <p>The request to /api failed ({loadError}). Start the backend with <span className="mono">python -m uvicorn app.main:app --port 8000</span> in the backend folder, then retry.</p>
            <button className="btn" style={{ marginTop: 16 }} onClick={() => setAttempt((a) => a + 1)}>Retry</button>
          </div>
        ) : !config ? (
          <div className="empty-state" aria-busy="true"><h2>Loading puzzles and engines</h2><p>Reading the configuration from the server.</p></div>
        ) : (
          <>
            {tab === "race" && (
              <RaceView config={config} puzzles={puzzles} mode={mode} race={engine.race} clock={engine.clock}
                speed={engine.speed} replaying={engine.replaying} job={job}
                startReplay={engine.startReplay} stopReplay={engine.stopReplay} />
            )}
            {tab === "dashboard" && <Dashboard mode={mode} config={config} refreshKey={`${engine.race.ended}${job.running}`} />}
            {tab === "slide" && <ResultsSlide mode={mode} config={config} />}
          </>
        )}
      </main>
    </div>
  );
}
