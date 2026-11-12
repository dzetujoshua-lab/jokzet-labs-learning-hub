import { Check, Clock } from "lucide-react";
import { deptCodeFromName, metaFor } from "@/lib/programme";
import type { DailyMissionView } from "@/lib/schedule/daily";
import { DailyStatusControls } from "./daily-status-controls";
import { DeptGlyph } from "./dept-glyph";

const STATUS_TEXT: Record<DailyMissionView["status"], string> = {
  SCHEDULED: "scheduled",
  STARTED: "started",
  AWAITING_ASSESSMENT: "awaiting assessment",
  COMPLETED: "completed",
  MISSED: "missed",
  SKIPPED: "skipped",
};

/** Same row markup and classes as the Base44 MissionRow, for missions generated from the imported weekly schedule. */
export function DailyMissionRow({ mission, showDate = false }: { mission: DailyMissionView; showDate?: boolean }) {
  const done = mission.status === "COMPLETED";
  const meta = metaFor(deptCodeFromName(mission.department));

  return (
    <li className="group flex items-start gap-3.5 border-b border-border/60 px-5 py-4 last:border-0">
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
          done ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent"
        }`}
      >
        <Check className="h-3 w-3" strokeWidth={2.6} />
      </span>

      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>{mission.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5" style={{ color: meta.color }}>
            <DeptGlyph icon={meta.icon} className="h-3 w-3" />
            {mission.department}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" strokeWidth={1.8} />
            {showDate ? `${mission.date} · ` : ""}
            {mission.time} · {mission.durationMinutes}m
          </span>
          <span>{STATUS_TEXT[mission.status]}</span>
        </div>
        <DailyStatusControls id={mission.id} status={mission.status} />
      </div>

      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Daily
      </span>
    </li>
  );
}
