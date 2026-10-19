import { useEffect, useState } from "react";
import { api, type Mode } from "./api";
import Dashboard from "./components/Dashboard";
import RaceView from "./components/RaceView";
import ResultsSlide from "./components/ResultsSlide";
import { useRaceEngine } from "./race";
import type { Config, Puzzle } from "./types";

type Tab = "race" | "dashboard" | "slide";

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [tab, setTab] = useState<Tab>("race");
  const [mode, setMode] = useState<Mode>("live");
  const [job, setJob] = useState({ running: false, label: null as string | null, note: null as string | null, spent: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const engine = useRaceEngine();
  const { onLiveEvent } = engine;

  useEffect(() => {
    Promise.all([api.config(), api.puzzles()])
      .then(([c, p]) => {
        setConfig(c);
        setPuzzles(p);
        if (!c.live_available) setMode("mock");
      })
      .catch((e) => setLoadError(String(e)));
    api.status().then((s) => setJob((j) => ({ ...j, running: s.running, label: s.label, spent: s.spent_usd }))).catch(() => {});
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (m) => {
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

  if (loadError) return <div className="empty">Backend not reachable: {loadError}</div>;
  if (!config) return <div className="empty">Loading…</div>;

  return (
    <div className={`app ${tab === "slide" ? "app-slide" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <span className="logo">▣</span> RUBIK'S CUBE RACE
        </div>
        <nav className="nav">
          {(["race", "dashboard", "slide"] as Tab[]).map((t) => (
            <button key={t} className={`nav-btn ${tab === t ? "nav-on" : ""}`} onClick={() => setTab(t)}>
              {t === "race" ? "Race" : t === "dashboard" ? "Benchmark Dashboard" : "Results Slide"}
            </button>
          ))}
        </nav>
        <div className="mode">
          <button className={`mode-btn ${mode === "live" ? "mode-on" : ""}`} disabled={!config.live_available}
            onClick={() => setMode("live")} title={config.live_available ? "" : "set OPENROUTER_API_KEY"}>
            Live (OpenRouter)
          </button>
          <button className={`mode-btn ${mode === "mock" ? "mode-on mode-mock" : ""}`} onClick={() => setMode("mock")}>
            Mock (dev)
          </button>
        </div>
        <div className="identity" aria-label="student identity">
          <div className="identity-name">{config.student_name}</div>
          <div className="identity-roll">Roll No: {config.roll_no}</div>
        </div>
      </header>
      {mode === "mock" && <div className="mock-banner">MOCK MODE: simulated models for development only. Not benchmark data.</div>}

      <main className="main">
        {tab === "race" && (
          <RaceView config={config} puzzles={puzzles} mode={mode} race={engine.race} clock={engine.clock}
            speed={engine.speed} replaying={engine.replaying} job={job}
            startReplay={engine.startReplay} stopReplay={engine.stopReplay} />
        )}
        {tab === "dashboard" && <Dashboard mode={mode} refreshKey={`${engine.race.ended}${job.running}`} />}
        {tab === "slide" && <ResultsSlide mode={mode} config={config} />}
      </main>
    </div>
  );
}
