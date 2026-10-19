import type { Config, Puzzle, Summary } from "./types";

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = await r.text();
    try {
      msg = JSON.parse(msg).detail ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return r.json();
}

export type Mode = "live" | "mock";

export const api = {
  config: () => get<Config>("/api/config"),
  puzzles: () => get<Puzzle[]>("/api/puzzles"),
  summary: (mode: Mode) => get<Summary>(`/api/summary?mode=${mode}`),
  races: (mode: Mode) => get<any[]>(`/api/races?mode=${mode}`),
  race: (mode: Mode, id: string) => get<any>(`/api/races/${encodeURIComponent(id)}?mode=${mode}`),
  status: () => get<{ running: boolean; label: string | null; spent_usd: number; budget_usd: number }>("/api/status"),
  runRace: (puzzle_id: string, mode: Mode) => post("/api/race", { puzzle_id, mode }),
  runSuite: (set: string, mode: Mode, repeats = 1) => post("/api/suite", { set, mode, repeats }),
  stop: () => post("/api/stop", {}),
};
