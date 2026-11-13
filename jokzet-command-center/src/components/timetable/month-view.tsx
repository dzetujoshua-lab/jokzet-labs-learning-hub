import Link from "next/link";
import { fmtDate } from "@/lib/programme";
import { monthGrid } from "@/lib/plan/timetable";
import type { Timetable } from "@/lib/plan/timetable-service";
import { Bar, dotColor, timetableHref } from "./parts";

const HEAD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** A month at a glance: a dot per session, the month's milestones and the whole programme's progress. */
export function MonthView({ t }: { t: Timetable }) {
  const weeks = monthGrid(t.date);
  const dots = new Map<string, typeof t.items>();
  for (const i of t.items) dots.set(i.date, [...(dots.get(i.date) ?? []), i]);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className="panel p-4">
        <div className="grid grid-cols-7 gap-1.5">
          {HEAD.map((h) => <p key={h} className="px-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{h}</p>)}
          {weeks.flat().map((c) => {
            const here = dots.get(c.date) ?? [];
            return (
              <Link key={c.date} href={timetableHref("day", c.date)} aria-label={`${fmtDate(c.date)}: ${here.length} sessions`}
                className={`block h-14 rounded-lg border px-1.5 py-1 text-[11px] transition-colors hover:border-primary/40 ${c.date === t.today ? "border-primary/60 text-primary" : "border-border"} ${c.inMonth ? "text-foreground" : "text-muted-foreground/40"}`}>
                {Number(c.date.slice(8))}
                <span className="mt-1.5 flex flex-wrap gap-[3px]">
                  {here.slice(0, 6).map((i) => <span key={i.id} className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor(i) }} />)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
      <div className="space-y-4">
        <section className="panel p-4">
          <p className="mono-label">Milestones</p>
          {t.milestones.length ? (
            <ul className="mt-3 space-y-2.5">
              {t.milestones.map((m) => (
                <li key={m.title + m.startDate}>
                  <p className="text-[13px] text-foreground">{m.title} phase</p>
                  <p className="text-xs text-muted-foreground">{m.objective}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-xs text-muted-foreground">No phase runs this month.</p>}
          {t.nextCheckpoint ? <p className="mt-3 text-xs text-muted-foreground">Next checkpoint: {fmtDate(t.nextCheckpoint.date)}</p> : null}
        </section>
        <section className="panel p-4">
          <p className="mono-label">Programme</p>
          <Bar percent={t.progress.percent} />
          <p className="mt-2 text-xs text-muted-foreground">{t.progress.completed} of {t.progress.total} sessions done · finish estimate {fmtDate(t.finish.date)}</p>
        </section>
      </div>
    </div>
  );
}
