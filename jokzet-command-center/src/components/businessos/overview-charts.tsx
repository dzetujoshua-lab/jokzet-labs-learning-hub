"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtGhs } from "@/lib/businessos/money";
import type { Overview } from "@/lib/businessos/service";

// Base44 chart tokens only.
const AXIS = { fontSize: 10, fill: "hsl(var(--muted-foreground))" } as const;
const TOOLTIP = {
  contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, color: "hsl(var(--foreground))" },
  cursor: { fill: "hsl(var(--secondary) / 0.5)" },
} as const;
const cedis = (v: unknown) => fmtGhs(Math.round(Number(v) * 100));

export function MonthlyChart({ months }: { months: Overview["months"] }) {
  const data = months.map((m) => ({ label: m.label, Revenue: m.revenue / 100, Costs: m.expenses / 100, Profit: m.profit / 100 }));
  return (
    <div>
      <div className="h-64 w-full" role="img" aria-label="Revenue, running costs and profit by month">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...TOOLTIP} formatter={cedis} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            <Bar dataKey="Costs" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            <Bar dataKey="Profit" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Revenue, running costs and profit by month</caption>
        <thead><tr><th>Month</th><th>Revenue</th><th>Costs</th><th>Profit</th></tr></thead>
        <tbody>{months.map((m) => <tr key={m.key}><td>{m.label}</td><td>{fmtGhs(m.revenue)}</td><td>{fmtGhs(m.expenses)}</td><td>{fmtGhs(m.profit)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function BarList({ rows, label }: { rows: { name: string; value: number }[]; label: string }) {
  const data = rows.map((r) => ({ name: r.name, value: r.value / 100 }));
  return (
    <div>
      <div className="w-full" style={{ height: Math.max(120, data.length * 40) }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" width={110} interval={0} tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...TOOLTIP} formatter={cedis} />
            <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[0, 6, 6, 0]} barSize={14} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th>Name</th><th>Amount</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.name}><td>{r.name}</td><td>{fmtGhs(r.value)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
