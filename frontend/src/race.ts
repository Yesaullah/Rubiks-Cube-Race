import { useCallback, useEffect, useRef, useState } from "react";
import type { GameView, Kind, Puzzle, RaceEvent } from "./types";

export interface RaceState {
  raceId: string | null;
  mode: string | null;
  puzzle: Puzzle | null;
  repeat: number;
  order: string[];
  games: Record<string, GameView>;
  limits: { max_moves: number; time_limit_s: number } | null;
  ended: boolean;
}

export const EMPTY_RACE: RaceState = {
  raceId: null, mode: null, puzzle: null, repeat: 1, order: [], games: {}, limits: null, ended: false,
};

export function applyEvent(s: RaceState, ev: RaceEvent): RaceState {
  if (ev.type === "race_start") {
    const games: Record<string, GameView> = {};
    for (const m of ev.models as { key: string; label: string; kind: Kind; model_id: string }[]) {
      games[m.key] = {
        key: m.key, label: m.label, kind: m.kind, model_id: m.model_id, status: "waiting",
        facelets: ev.puzzle.facelets, moves: 0, forfeits: 0, history: [], moveSeq: 0,
        lastMove: null, endT: null, invalid: 0, rank: null, gap: null,
      };
    }
    return {
      raceId: ev.race_id ?? null, mode: ev.mode, puzzle: ev.puzzle, repeat: ev.repeat,
      order: ev.models.map((m: any) => m.key), games, limits: ev.limits, ended: false,
    };
  }
  if (ev.race_id && s.raceId && ev.race_id !== s.raceId) return s;
  const g = ev.model ? s.games[ev.model] : undefined;
  switch (ev.type) {
    case "thinking":
      if (!g || g.endT !== null) return s;
      return { ...s, games: { ...s.games, [g.key]: { ...g, status: "thinking" } } };
    case "move": {
      if (!g) return s;
      const ng: GameView = {
        ...g,
        history: [...g.history, { move: ev.move, latency: ev.latency_s, confidence: ev.confidence }],
        invalid: g.invalid + (ev.invalid_outputs ?? 0),
        moves: ev.moves,
        forfeits: ev.forfeits,
      };
      if (ev.move) {
        ng.facelets = ev.facelets;
        ng.lastMove = ev.move;
        ng.moveSeq = g.moveSeq + 1;
      }
      return { ...s, games: { ...s.games, [g.key]: ng } };
    }
    case "game_end":
      if (!g) return s;
      return {
        ...s,
        games: { ...s.games, [g.key]: { ...g, status: ev.status, endT: ev.total_time_s, gap: ev.gap } },
      };
    case "race_end": {
      const games = { ...s.games };
      for (const r of ev.results) if (games[r.model_key]) games[r.model_key] = { ...games[r.model_key], rank: r.rank };
      return { ...s, games, ended: true };
    }
  }
  return s;
}

/** Race clock + event application for both live (SSE) and replay sources. */
export function useRaceEngine() {
  const [race, setRace] = useState<RaceState>(EMPTY_RACE);
  const [clock, setClock] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const base = useRef<number | null>(null);           // performance.now() at race t = 0
  const replay = useRef<{ events: RaceEvent[]; i: number; start: number; speed: number } | null>(null);
  const raf = useRef<number>(0);

  const tick = useCallback(() => {
    const now = performance.now();
    const r = replay.current;
    if (r) {
      const t = ((now - r.start) * r.speed) / 1000;
      const due: RaceEvent[] = [];
      while (r.i < r.events.length && r.events[r.i].t <= t) due.push(r.events[r.i++]);
      if (due.length) setRace((s) => due.reduce(applyEvent, s));
      setClock(t);
      if (r.i >= r.events.length) {
        replay.current = null;
        setReplaying(false);
      }
    } else if (base.current !== null) {
      setClock((now - base.current) / 1000);
    }
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [tick]);

  const onLiveEvent = useCallback((ev: RaceEvent) => {
    if (replay.current) return;
    if (ev.type === "race_start") {
      base.current = performance.now() - ev.t * 1000;
      setSpeed(1);
    }
    setRace((s) => applyEvent(s, ev));
  }, []);

  const startReplay = useCallback((events: RaceEvent[], sp: number) => {
    replay.current = { events, i: 0, start: performance.now(), speed: sp };
    base.current = null;
    setSpeed(sp);
    setReplaying(true);
    setRace(EMPTY_RACE);
  }, []);

  const stopReplay = useCallback(() => {
    const r = replay.current;
    if (r) setRace((s) => r.events.slice(r.i).reduce(applyEvent, s));
    replay.current = null;
    setReplaying(false);
  }, []);

  return { race, clock, speed, replaying, onLiveEvent, startReplay, stopReplay };
}

export function fmtTime(s: number | null | undefined): string {
  if (s === null || s === undefined || !isFinite(s)) return "–";
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(2).padStart(5, "0")}`;
}

export function fmtLatency(s: number | null | undefined): string {
  if (s === null || s === undefined) return "–";
  return s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(2)} s`;
}
