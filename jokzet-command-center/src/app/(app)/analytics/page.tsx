import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { DepartmentChart, HoursChart, ScoreChart } from "@/components/analytics/analytics-charts";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { fmtHours } from "@/lib/analytics/format";
import { getAnalytics, type PeriodRow } from "@/lib/analytics/service";
import { requireUser } from "@/lib/auth/dal";
import { ensureLearnerSetup } from "@/lib/missions/service";

export const metadata: Metadata = { title: "Analytics" };

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

function ReportTable({ title, firstColumn, rows }: { title: string; firstColumn: string; rows: PeriodRow[] }) {
  return (
    <section className="panel overflow-hidden">
      <p className="mono-label px-5 pt-5">{title}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              {[firstColumn, "Hours", "Missions", "Skills", "Checkpoints", "Avg score"].map((h, i) => (
                <th key={h} scope="col" className={`px-5 py-2 font-normal ${i ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.key} className="border-b border-border/60 last:border-0">
                <th scope="row" className="px-5 py-2.5 font-normal text-foreground">{r.label}</th>
                <td className="px-5 py-2.5 text-right tabular-nums">{fmtHours(r.minutes)}</td>
                <td className="px-5 py-2.5 text-right tabular-nums">{r.missions}</td>
                <td className="px-5 py-2.5 text-right tabular-nums">{r.skills}</td>
                <td className="px-5 py-2.5 text-right tabular-nums">{r.assessments}</td>
                <td className="px-5 py-2.5 text-right tabular-nums">{pct(r.averageScore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function AnalyticsPage() {
  const user = await requireUser();
  await ensureLearnerSetup(user.id);
  const a = await getAnalytics(user.id);

  const tiles = [
    { label: "Learning hours", value: fmtHours(a.totals.minutes) },
    { label: "Missions completed", value: a.totals.missionsCompleted },
    { label: "Skills gained", value: a.totals.skills },
    { label: "Average score", value: pct(a.totals.averageScore) },
  ];
  const empty = a.totals.missionsCompleted === 0 && a.totals.assessments === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="How the work is adding up"
        description="Hours, completed missions, skills and checkpoint scores, week by week and month by month."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-border bg-card px-4 py-4">
            <p className="font-display text-2xl leading-none tabular-nums text-foreground">{tile.value}</p>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{tile.label}</p>
          </div>
        ))}
      </div>

      {empty ? (
        <EmptyState icon={BarChart3} title="Nothing to chart yet" hint="Finish a mission or score a checkpoint and the numbers appear here." />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <p className="mono-label">Learning hours · last 8 weeks</p>
          <div className="mt-4"><HoursChart rows={a.weekly} /></div>
        </section>
        <section className="panel p-5">
          <p className="mono-label">Mission completion by department</p>
          <div className="mt-4"><DepartmentChart rows={a.departments} /></div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="mono-label">Assessment performance</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {a.totals.assessments} scored · pass rate {pct(a.totals.passRate)}
            </p>
          </div>
          <div className="mt-4">
            {a.performance.length ? <ScoreChart rows={a.performance} /> : <p className="py-10 text-center text-xs text-muted-foreground">No scored checkpoints yet.</p>}
          </div>
        </section>
        <section className="panel p-5">
          <p className="mono-label">Department progress</p>
          <ul className="mt-4 space-y-3">
            {a.departments.map((d) => (
              <li key={d.code} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-foreground">{d.name}</span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground tabular-nums">
                  L{d.level} · {d.xp} XP · {d.completed}/{d.total} · {fmtHours(d.minutes)} · {pct(d.averageScore)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Level · XP · missions done of the curriculum · hours · average checkpoint score.</p>
        </section>
      </div>

      <ReportTable title="Weekly report" firstColumn="Week of" rows={a.weekly} />
      <ReportTable title="Monthly report" firstColumn="Month" rows={a.monthly} />

      <p className="text-[11px] text-muted-foreground">
        Hours count each finished mission once (the time you logged, else its planned duration).
      </p>
    </div>
  );
}
