"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsData, PeriodRow } from "@/lib/analytics/service";
import { metaFor } from "@/lib/programme";

// Colours are the Base44 chart tokens (hsl(var(--chart-n))); no new palette.
const AXIS = { fontSize: 10, fill: "hsl(var(--muted-foreground))" } as const;
const TOOLTIP = {
  contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, color: "hsl(var(--foreground))" },
  cursor: { fill: "hsl(var(--secondary) / 0.5)" },
} as const;


/** Chart plus a visually hidden table so the numbers are available without sight or a pointer. */
export function HoursChart({ rows }: { rows: PeriodRow[] }) {
  const data = rows.map((r) => ({ label: r.label, hours: Math.round((r.minutes / 60) * 10) / 10 }));
  return (
    <div>
      <div className="h-56 w-full" role="img" aria-label="Learning hours per week">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...TOOLTIP} formatter={(v) => [`${v}h`, "Learning"]} />
            <Bar dataKey="hours" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Learning hours per week</caption>
        <thead><tr><th>Week of</th><th>Hours</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.label}><td>{d.label}</td><td>{d.hours}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function DepartmentChart({ rows }: { rows: AnalyticsData["departments"] }) {
  const data = rows.map((r) => ({ code: r.code, name: r.name, pct: r.total ? Math.round((r.completed / r.total) * 100) : 0 }));
  return (
    <div>
      <div className="h-80 w-full" role="img" aria-label="Mission completion by department">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
            <YAxis type="category" dataKey="name" width={150} interval={0} tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...TOOLTIP} formatter={(v) => [`${v}%`, "Completed"]} />
            <Bar dataKey="pct" radius={[0, 6, 6, 0]} barSize={14} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.code} fill={metaFor(d.code).color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Mission completion by department</caption>
        <thead><tr><th>Department</th><th>Completed</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.code}><td>{d.name}</td><td>{d.pct}%</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function ScoreChart({ rows }: { rows: AnalyticsData["performance"] }) {
  const data = rows.map((r, i) => ({ n: i + 1, label: r.label, score: r.percentage }));
  return (
    <div>
      <div className="h-56 w-full" role="img" aria-label="Assessment scores over time">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="n" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
            <Tooltip {...TOOLTIP} labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""} formatter={(v) => [`${v}%`, "Score"]} />
            <Line type="monotone" dataKey="score" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--chart-1))" }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Assessment scores, oldest to newest</caption>
        <thead><tr><th>Mission</th><th>Score</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.n}><td>{d.label}</td><td>{d.score}%</td></tr>)}</tbody>
      </table>
    </div>
  );
}
