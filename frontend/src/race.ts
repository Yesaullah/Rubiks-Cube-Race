import { useCallback, useEffect, useRef, useState } from "react";
import type { GameView, Kind, LogEntry, Puzzle, RaceEvent } from "./types";

/** Why a turn produced no move (set by the backend runner). */
const FORFEIT_TEXT: Record<string, string> = {
  refused: "model refused to answer",
  malformed: "malformed output",
  timeout: "timed out",
  api_error: "API error",
};

export interface RaceState {
  raceId: string | null;
  mode: string | null;
  runKind: string | null;
  puzzle: Puzzle | null;
  repeat: number;
  order: string[];
  games: Record<string, GameView>;
  limits: { max_moves: number; time_limit_s: number } | null;
  ended: boolean;
  log: LogEntry[];
}

export const EMPTY_RACE: RaceState = {
  raceId: null, mode: null, runKind: null, puzzle: null, repeat: 1, order: [], games: {},
  limits: null, ended: false, log: [],
};

const LOG_CAP = 80;
const STATUS_WORDS: Record<string, string> = {
  solved: "solved the cube",
  out_of_moves: "reached the 30-move limit",
  out_of_time: "ran out of time",
  budget_stop: "stopped at the budget limit",
  api_error: "stopped on an API error",
};

function pushLog(s: RaceState, entry: Omit<LogEntry, "id">): LogEntry[] {
  const id = (s.log[s.log.length - 1]?.id ?? 0) + 1;
  const log = [...s.log, { ...entry, id }];
  return log.length > LOG_CAP ? log.slice(log.length - LOG_CAP) : log;
}

export function applyEvent(s: RaceState, ev: RaceEvent): RaceState {
  if (ev.type === "race_start") {
    const games: Record<string, GameView> = {};
    for (const m of ev.models as { key: string; label: string; kind: Kind; model_id: string }[]) {
      games[m.key] = {
        key: m.key, label: m.label, kind: m.kind, model_id: m.model_id, status: "waiting",
        facelets: ev.puzzle.facelets, moves: 0, forfeits: 0, history: [], moveSeq: 0,
        lastMove: null, since: ev.t, endT: null, invalid: 0, rank: null, gap: null,
      };
    }
    const base: RaceState = {
      raceId: ev.race_id ?? null, mode: ev.mode, runKind: ev.run_kind ?? null, puzzle: ev.puzzle,
      repeat: ev.repeat, order: ev.models.map((m: any) => m.key), games, limits: ev.limits,
      ended: false, log: [],
    };
    return {
      ...base,
      log: pushLog(base, {
        t: ev.t, model: null, kind: "start",
        text: `Race started on ${ev.puzzle.id}`,
        detail: `${ev.puzzle.scramble.length}-turn scramble, shortest solution ${ev.puzzle.optimal_length}`,
      }),
    };
  }
  if (ev.race_id && s.raceId && ev.race_id !== s.raceId) return s;
  const g = ev.model ? s.games[ev.model] : undefined;
  switch (ev.type) {
    case "thinking":
      if (!g || g.endT !== null) return s;
      return { ...s, games: { ...s.games, [g.key]: { ...g, status: "thinking", since: ev.t } } };
    case "move": {
      if (!g) return s;
      const ng: GameView = {
        ...g,
        history: [...g.history, { move: ev.move, latency: ev.latency_s, confidence: ev.confidence, t: ev.t, reason: ev.forfeit_reason }],
        invalid: g.invalid + (ev.invalid_outputs ?? 0),
        moves: ev.moves,
        forfeits: ev.forfeits,
        since: ev.t,
      };
      if (ev.move) {
        ng.facelets = ev.facelets;
        ng.lastMove = ev.move;
        ng.moveSeq = g.moveSeq + 1;
      }
      const conf = ev.confidence != null ? `, confidence ${Math.round(ev.confidence * 100)}%` : "";
      const retries = ev.attempts > 1 ? `, ${ev.attempts - 1} retr${ev.attempts > 2 ? "ies" : "y"}` : "";
      return {
        ...s,
        games: { ...s.games, [g.key]: ng },
        log: pushLog(s, ev.move
          ? { t: ev.t, model: g.key, kind: "move", text: ev.move, detail: `${fmtLatency(ev.latency_s)}${conf}${retries}` }
          : { t: ev.t, model: g.key, kind: "forfeit", text: `${FORFEIT_TEXT[ev.forfeit_reason] ?? "no valid move"}, turn forfeited`,
              detail: `${ev.attempts ?? 1} attempt${(ev.attempts ?? 1) > 1 ? "s" : ""}, cube unchanged`, tone: "bad" }),
      };
    }
    case "game_end": {
      if (!g) return s;
      const solved = ev.status === "solved";
      return {
        ...s,
        games: { ...s.games, [g.key]: { ...g, status: ev.status, endT: ev.total_time_s, gap: ev.gap } },
        log: pushLog(s, {
          t: ev.t, model: g.key, kind: "end", tone: solved ? "ok" : "bad",
          text: STATUS_WORDS[ev.status] ?? ev.status,
          detail: solved
            ? `${ev.moves} moves${ev.gap === 0 ? ", optimal" : ev.gap != null ? `, ${ev.gap} over shortest` : ""} in ${fmtTime(ev.total_time_s)}`
            : `${ev.moves} moves in ${fmtTime(ev.total_time_s)}`,
        }),
      };
    }
    case "race_end": {
      const games = { ...s.games };
      for (const r of ev.results) if (games[r.model_key]) games[r.model_key] = { ...games[r.model_key], rank: r.rank };
      const winner = ev.results.find((r: any) => r.rank === 1);
      return {
        ...s, games, ended: true,
        log: pushLog(s, {
          t: ev.t, model: null, kind: "finish",
          text: "Race finished",
          detail: winner ? `${winner.label} ranked first` : undefined,
        }),
      };
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

export function fmtLimit(s: number): string {
  return s % 60 === 0 ? `${s / 60} min` : `${s} s`;
}

export function fmtLatency(s: number | null | undefined): string {
  if (s === null || s === undefined) return "–";
  return s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(2)} s`;
}
