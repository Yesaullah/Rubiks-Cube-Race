import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import type { ModelSummary } from "../types";
import { engineColor } from "./stats";

// chart colours come from the design tokens in styles.css, so charts, legends and tables agree
const GRID = "var(--rule)";
const INK = "var(--series)";
const DATA = "var(--data)";
const PALE = "var(--series-pale)";

/** Round axis ticks (steps of 1, 2, 2.5 or 5 × 10^k) from zero up to just past the largest value. */
function niceTicks(max: number, target = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

function Tip({ active, payload, fmt }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="chart-tip">
      <b>{p.name}</b>
      {payload.map((x: any) => (
        <div key={x.dataKey} className="num">{x.name}: {fmt(x.value)}</div>
      ))}
    </div>
  );
}

/** Value printed just past the bar's end, on one line (Recharts' default label wraps on spaces). */
function ValueLabel({ x, y, width, height, value, fmt }: any) {
  if (value == null) return null;
  return (
    <text x={x + width + 6} y={y + height / 2} dominantBaseline="central" className="chart-value">
      {fmt(value)}
    </text>
  );
}

function EngineTick({ x, y, payload, rows }: any) {
  const row = rows.find((r: ModelSummary) => r.label === payload.value);
  const i = rows.indexOf(row);
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-112} y={-5} width={10} height={10} rx={2} fill={row ? engineColor(row.model_key, i) : PALE} />
      <text x={-96} y={4.5} className="chart-engine">{payload.value}</text>
    </g>
  );
}

/**
 * One metric per chart, engines ranked top to bottom. Bars are ink; the best value carries
 * the one data hue. Linear scale from zero so lengths compare honestly; exact values are printed.
 */
export function RankedBars({ rows, value, fmt, tickFmt, better, name, max, highlight = true }: {
  rows: ModelSummary[];
  value: (r: ModelSummary) => number | null;
  fmt: (v: number) => string;
  tickFmt?: (v: number) => string;
  better: "lower" | "higher";
  name: string;
  max?: number;
  /** colour the best bar; off where "best" would mislead (e.g. game time, where failures end early) */
  highlight?: boolean;
}) {
  const data = rows
    .map((r) => ({ name: r.label, key: r.model_key, v: value(r) }))
    .sort((a, b) => {
      if (a.v == null) return 1;
      if (b.v == null) return -1;
      return better === "lower" ? a.v - b.v : b.v - a.v;
    });
  const best = highlight ? data.find((d) => d.v != null)?.key : undefined;
  const plotted = data.map((d) => ({ ...d, v: d.v ?? 0, missing: d.v == null }));
  const ticks = max === 100 ? [0, 25, 50, 75, 100] : niceTicks(Math.max(0, ...plotted.map((d) => d.v)));
  return (
    <ResponsiveContainer width="100%" height={36 * data.length + 34}>
      <BarChart data={plotted} layout="vertical" margin={{ top: 4, right: 72, bottom: 0, left: 8 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" domain={[0, max ?? ticks[ticks.length - 1]]} ticks={ticks} tickFormatter={tickFmt ?? fmt}
          axisLine={false} tickLine={false} interval={0} />
        <YAxis type="category" dataKey="name" width={116} axisLine={false} tickLine={false}
          tick={<EngineTick rows={rows} />} />
        <Tooltip cursor={{ fill: "var(--sunken)" }} content={<Tip fmt={fmt} />} />
        <Bar dataKey="v" name={name} isAnimationActive={false} radius={[0, 2, 2, 0]}>
          {plotted.map((d) => <Cell key={d.key} fill={d.key === best ? DATA : INK} />)}
          <LabelList dataKey="v" content={<ValueLabel fmt={fmt} />} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Moves used in solved games against the shortest solution for those same puzzles. */
export function MovesVsShortest({ rows }: { rows: ModelSummary[] }) {
  const data = rows
    .filter((r) => r.mean_moves_solved != null)
    .map((r) => ({ name: r.label, key: r.model_key, moves: r.mean_moves_solved!, shortest: r.mean_optimal_solved! }))
    .sort((a, b) => a.moves - a.shortest - (b.moves - b.shortest));
  if (data.length === 0) return <p className="foot-note" style={{ borderTop: 0 }}>No engine solved a cube in this set, so there is nothing to compare.</p>;
  const fmt = (v: number) => v.toFixed(1);
  const ticks = niceTicks(Math.max(...data.map((d) => Math.max(d.moves, d.shortest))));
  return (
    <ResponsiveContainer width="100%" height={52 * data.length + 34}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 0, left: 8 }} barGap={2} barCategoryGap={12}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" domain={[0, ticks[ticks.length - 1]]} ticks={ticks} interval={0} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={116} axisLine={false} tickLine={false}
          tick={<EngineTick rows={rows} />} />
        <Tooltip cursor={{ fill: "var(--sunken)" }} content={<Tip fmt={fmt} />} />
        <Bar dataKey="moves" name="Moves used" fill={INK} isAnimationActive={false} radius={[0, 2, 2, 0]}>
          <LabelList dataKey="moves" content={<ValueLabel fmt={fmt} />} />
        </Bar>
        <Bar dataKey="shortest" name="Shortest" fill={PALE} isAnimationActive={false} radius={[0, 2, 2, 0]}>
          <LabelList dataKey="shortest" content={<ValueLabel fmt={fmt} />} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * The trade-off the assignment asks about: decision speed (x, log scale because engines differ by
 * orders of magnitude) against success rate (y). Each engine is one labelled point.
 */
export function TradeoffPlot({ rows, height = 260 }: { rows: ModelSummary[]; height?: number | `${number}%` }) {
  const data = rows
    .filter((r) => r.mean_latency_s != null)
    .map((r, i) => ({ name: r.label, key: r.model_key, i, x: r.mean_latency_s!, y: Math.round(r.solve_rate * 100) }));
  if (data.length === 0) return null;
  const lo = Math.min(...data.map((d) => d.x));
  const hi = Math.max(...data.map((d) => d.x));
  const decades: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) decades.push(10 ** e);
  const fmtS = (v: number) => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v >= 10 ? v.toFixed(0) : v.toFixed(1)} s`);
  // Label placement: points near the right edge label to their left; points that nearly coincide
  // (same success rate, latency within ~40%) stack their labels instead of overprinting.
  const lo10 = Math.log10(decades[0]);
  const span = Math.log10(decades[decades.length - 1]) - lo10 || 1;
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    a.y === b.y && Math.abs(Math.log10(a.x) - Math.log10(b.x)) < 0.15;
  // chain neighbours into clusters (A near B near C is one cluster even if A and C are apart)
  const sorted = [...data].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: (typeof data)[] = [];
  for (const d of sorted) {
    const g = groups[groups.length - 1];
    if (g && near(g[g.length - 1], d)) g.push(d);
    else groups.push([d]);
  }
  // A lone point labels itself (to the left near the right edge). In a cluster, the leftmost point
  // prints every member's name as a stack to its left, each in that engine's colour; the others print none.
  const placed = data.map((d) => {
    const g = groups.find((x) => x.includes(d))!;
    if (g.length === 1) return { ...d, left: (Math.log10(d.x) - lo10) / span > 0.72, stack: [d] };
    return { ...d, left: true, stack: g.indexOf(d) === 0 ? g : [] };
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 16, right: 24, bottom: 18, left: 0 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis type="number" dataKey="x" scale="log" domain={[decades[0], decades[decades.length - 1]]}
          ticks={decades} tickFormatter={fmtS} axisLine={false} tickLine={false} name="Latency per move"
          label={{ value: "Latency per move (log scale), faster to the left", position: "insideBottom", offset: -12 }} />
        <YAxis type="number" dataKey="y" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" width={48}
          axisLine={false} tickLine={false} name="Success rate" padding={{ top: 8, bottom: 14 }} />
        <ZAxis range={[90, 90]} />
        <Tooltip cursor={false} content={({ active, payload }: any) =>
          active && payload?.length ? (
            <div className="chart-tip">
              <b>{payload[0].payload.name}</b>
              <div className="num">{fmtS(payload[0].payload.x)} per move, {payload[0].payload.y}% solved</div>
            </div>
          ) : null} />
        <Scatter data={placed} isAnimationActive={false}
          shape={(p: any) => (
            <g>
              <circle cx={p.cx} cy={p.cy} r={7} fill={engineColor(p.payload.key, p.payload.i)} stroke="#fff" strokeWidth={2} />
              {p.payload.stack.map((m: any, k: number) => (
                <text key={m.key} x={p.payload.left ? p.cx - 11 : p.cx + 11} y={p.cy + 4.5 - 16 * k}
                  textAnchor={p.payload.left ? "end" : "start"} className="chart-point"
                  style={p.payload.stack.length > 1 ? { fill: engineColor(m.key, m.i) } : undefined}>
                  {m.name}
                </text>
              ))}
            </g>
          )} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
