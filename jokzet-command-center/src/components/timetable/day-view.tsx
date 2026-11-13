import { fmtDate } from "@/lib/programme";
import type { Timetable } from "@/lib/plan/timetable-service";
import { Bar, StateChip, Tile, deptColor, deptName, dotColor } from "./parts";

/** One day: its sessions in order, with this week's progress, the next checkpoint and the finish estimate beside them. */
export function DayView({ t }: { t: Timetable }) {
  const left = t.items.filter((i) => i.status === "PLANNED" && !i.done).length;
  const wp = t.weekProgress;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className="panel overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <p className="mono-label">{t.date === t.today ? "Today's sessions" : `Sessions · ${fmtDate(t.date)}`}{t.items.length ? ` · ${left} of ${t.items.length} left` : ""}</p>
        </div>
        {t.items.length ? (
          <ul>
            {t.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 border-b border-border/60 px-5 py-4 last:border-0">
                <span className="w-11 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">{i.time}</span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor(i) }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-foreground">{i.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span style={{ color: deptColor(i.departmentCode) }}>{deptName(i.departmentCode)}</span> · {i.minutes} min
                    {t.catchUpOf[i.id] ? ` · replaces ${fmtDate(t.catchUpOf[i.id])}` : ""}
                  </p>
                </div>
                <StateChip item={i} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-sm text-muted-foreground">Nothing is scheduled for this day. Use Week or Month to see what is coming.</p>
        )}
      </section>

      <div className="space-y-4">
        <Tile label="This week" hint="sessions completed">
          {wp.completed}<span className="text-muted-foreground">/{wp.total}</span>
          <Bar percent={wp.total ? Math.round((wp.completed / wp.total) * 100) : 0} />
        </Tile>
        <Tile label="Next checkpoint" hint={t.nextCheckpoint ? t.nextCheckpoint.title.replace(/^Checkpoint: /, "") : "None scheduled yet"}>
          {t.nextCheckpoint ? fmtDate(t.nextCheckpoint.date) : "—"}
        </Tile>
        <Tile label="Finish estimate" hint={t.finish.onTrack ? "On track" : "Missed sessions still need a catch-up"}>
          {fmtDate(t.finish.date)}
        </Tile>
      </div>
    </div>
  );
}
