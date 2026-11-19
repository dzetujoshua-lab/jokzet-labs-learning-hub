"use client";

import { useSyncExternalStore } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Colours come from the Administration Centre's own tokens (see admin-theme.css); nothing here is a literal colour.
const AXIS = { fontSize: 10, fill: "hsl(var(--muted-foreground))" } as const;
const TOOLTIP = {
  contentStyle: { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, color: "hsl(var(--foreground))" },
  cursor: { fill: "hsl(var(--secondary) / 0.5)" },
} as const;
const SERIES = ["hsl(var(--chart-1))", "hsl(var(--chart-3))", "hsl(var(--chart-2))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-6))"];

/** Charts animate on load unless the visitor asked for reduced motion (and they do not animate while rendering on the server). */
const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribe(onChange: () => void) {
  const m = window.matchMedia(REDUCED);
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}
function useAnimate(): boolean {
  return !useSyncExternalStore(subscribe, () => window.matchMedia(REDUCED).matches, () => true);
}

type Slice = { name: string; value: number };

/** A ring with the total in the middle and a legend. A hidden table carries the same numbers for screen readers. */
export function Donut({ slices, label, totalLabel }: { slices: Slice[]; label: string; totalLabel: string }) {
  const animate = useAnimate();
  const total = slices.reduce((n, s) => n + s.value, 0);
  const data = total > 0 ? slices : [{ name: "None yet", value: 1 }];
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative h-[150px] w-[150px] shrink-0" role="img" aria-label={`${label}: ${slices.map((s) => `${s.name} ${s.value}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={total > 0 ? 2 : 0} stroke="none" isAnimationActive={animate}>
              {data.map((s, i) => <Cell key={s.name} fill={total > 0 ? SERIES[i % SERIES.length] : "hsl(var(--secondary))"} />)}
            </Pie>
            {total > 0 ? <Tooltip {...TOOLTIP} /> : null}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><p className="font-display text-2xl tabular-nums text-foreground">{total}</p><p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{totalLabel}</p></div>
        </div>
      </div>
      <ul className="min-w-[8rem] flex-1 space-y-1.5 text-xs">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i % SERIES.length] }} aria-hidden="true" />{s.name}</span>
            <span className="tabular-nums text-foreground">{s.value}{total > 0 ? <span className="ml-1.5 text-muted-foreground">{Math.round((s.value / total) * 100)}%</span> : null}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Learners enrolled per programme. */
export function BarsByProgramme({ rows }: { rows: { name: string; learners: number }[] }) {
  const animate = useAnimate();
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No enrolments yet.</p>;
  return (
    <div>
      <div className="h-[210px] w-full" role="img" aria-label={`Learners per programme: ${rows.map((r) => `${r.name} ${r.learners}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border) / 0.5)" />
            <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} interval={0} tickFormatter={(v: string) => (v.length > 9 ? `${v.slice(0, 8)}…` : v)} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...TOOLTIP} formatter={(v) => [v, "Learners"]} />
            <Bar dataKey="learners" radius={[7, 7, 0, 0]} maxBarSize={38} isAnimationActive={animate}>
              {rows.map((r, i) => <Cell key={r.name} fill={SERIES[i % SERIES.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only"><caption>Learners per programme</caption><thead><tr><th>Programme</th><th>Learners</th></tr></thead><tbody>{rows.map((r) => <tr key={r.name}><td>{r.name}</td><td>{r.learners}</td></tr>)}</tbody></table>
    </div>
  );
}

/** Recorded learning activity per week. */
export function ActivityArea({ rows }: { rows: { label: string; activities: number }[] }) {
  const animate = useAnimate();
  const any = rows.some((r) => r.activities > 0);
  if (!any) return <p className="py-10 text-center text-sm text-muted-foreground">No learning activity has been recorded in the last eight weeks.</p>;
  return (
    <div>
      <div className="h-[190px] w-full" role="img" aria-label={`Learning activities per week: ${rows.map((r) => `${r.label} ${r.activities}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="adminArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--chart-5))" stopOpacity={0.5} /><stop offset="100%" stopColor="hsl(var(--chart-5))" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border) / 0.5)" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...TOOLTIP} formatter={(v) => [v, "Activities"]} labelFormatter={(l) => `Week of ${l}`} />
            <Area type="monotone" dataKey="activities" stroke="hsl(var(--chart-5))" strokeWidth={2.2} fill="url(#adminArea)" isAnimationActive={animate} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only"><caption>Learning activities per week</caption><thead><tr><th>Week of</th><th>Activities</th></tr></thead><tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td><td>{r.activities}</td></tr>)}</tbody></table>
    </div>
  );
}
