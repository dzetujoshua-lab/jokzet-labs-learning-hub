import Link from "next/link";
import { fmtDate } from "@/lib/programme";
import type { MissionSchedule } from "@/lib/plan/timetable-service";
import { STATE_CHIP, STATE_LABEL, timetableHref } from "./parts";
import { stateOf } from "@/lib/plan/timetable";

/** When this mission's sessions are planned, on the mission page. Read-only; moving a session is done from the timetable's day view. */
export function MissionSchedulePanel({ schedule }: { schedule: MissionSchedule }) {
  return (
    <section className="panel p-5">
      <p className="mono-label">Your schedule for this mission</p>
      {schedule.planStatus === "PAUSED" ? <p className="mt-2 text-xs text-muted-foreground">Your plan is paused, so these dates will move when you resume.</p> : null}
      <ul className="mt-3 space-y-2.5">
        {schedule.sessions.map((s) => {
          const state = stateOf({ status: s.status, kind: s.kind, done: s.done, practised: false });
          return (
            <li key={s.id} className="flex items-center justify-between gap-3">
              <Link href={timetableHref("day", s.date)} className="min-w-0 text-[13px] text-foreground hover:text-primary">
                {fmtDate(s.date)} · {s.time} <span className="text-muted-foreground">· {s.minutes} min</span>
              </Link>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${STATE_CHIP[state]}`}>{STATE_LABEL[state]}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
