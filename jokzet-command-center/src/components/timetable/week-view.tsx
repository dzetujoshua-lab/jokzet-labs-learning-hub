import Link from "next/link";
import { fmtDate } from "@/lib/programme";
import { weekDates } from "@/lib/plan/timetable";
import type { Timetable } from "@/lib/plan/timetable-service";
import { CATCH_UP_COLOR, HATCH, STATE_LABEL, deptColor, stateOfItem, timetableHref } from "./parts";

/** Seven day columns (Monday to Sunday) with a short objective for the week. Stacks into a list on small screens. */
export function WeekView({ t }: { t: Timetable }) {
  const days = weekDates(t.date);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.weekObjective ? `Focus this week: ${t.weekObjective}` : "No teaching sessions this week."}</p>
      <div className="grid gap-2 md:grid-cols-7">
        {days.map((d) => {
          const items = t.items.filter((i) => i.date === d);
          return (
            <section key={d} className={`min-h-24 rounded-2xl border p-2 ${d === t.today ? "border-primary/50" : "border-border"} bg-card`} aria-label={fmtDate(d)}>
              <Link href={timetableHref("day", d)} className={`block font-mono text-[10px] uppercase tracking-[0.12em] ${d === t.today ? "text-primary" : "text-muted-foreground"}`}>{fmtDate(d)}</Link>
              {items.map((i) => {
                const s = stateOfItem(i);
                return (
                  <div key={i.id} className="mt-1.5 rounded-md border-l-[3px] bg-secondary/60 px-2 py-1.5 text-[11px] leading-snug" style={{ borderLeftColor: s === "missed" ? "hsl(var(--destructive))" : s === "catch-up" ? CATCH_UP_COLOR : deptColor(i.departmentCode), ...(s === "missed" ? HATCH : {}) }}>
                    <span className="font-mono tabular-nums text-muted-foreground">{i.time}</span> <span className="text-foreground">{i.title}</span>
                    {s !== "planned" ? <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{STATE_LABEL[s]}</span> : null}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary" />planned or done</span>
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: CATCH_UP_COLOR }} />catch-up</span>
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-destructive" />missed</span>
      </p>
    </div>
  );
}
