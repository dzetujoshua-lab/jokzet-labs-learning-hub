import Link from "next/link";
import { ArrowUpRight, ListChecks } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import type { DepartmentView, MissionView } from "@/lib/missions/service";
import type { DailyMissionView } from "@/lib/schedule/daily";
import { DailyMissionRow } from "./daily-mission-row";
import { MissionRow } from "./mission-row";

export function TodayMissions({
  missions,
  departments,
  daily = [],
}: {
  missions: MissionView[];
  departments: DepartmentView[];
  daily?: DailyMissionView[];
}) {
  const total = missions.length + daily.length;
  const done = missions.filter((m) => m.status === "done").length + daily.filter((d) => d.status === "COMPLETED").length;
  const minutes = missions.reduce((sum, m) => sum + (m.minutes || 0), 0) + daily.reduce((sum, d) => sum + d.durationMinutes, 0);
  const deptName = (code: string) => departments.find((d) => d.code === code)?.name || code;

  return (
    <section className="panel overflow-hidden">
      <header className="flex items-end justify-between gap-4 border-b border-border px-5 py-5">
        <div>
          <p className="mono-label">Daily missions</p>
          <h2 className="mt-2 font-display text-lg font-medium text-foreground">Today&apos;s line-up</h2>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl tabular-nums leading-none text-foreground">
            {done}
            <span className="text-muted-foreground">/{total}</span>
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">cleared</p>
        </div>
      </header>

      {total ? (
        <ul>
          {daily.map((mission) => (
            <DailyMissionRow key={mission.id} mission={mission} />
          ))}
          {missions.map((mission) => (
            <MissionRow key={mission.id} mission={mission} deptName={deptName(mission.departmentCode)} canToggle />
          ))}
        </ul>
      ) : (
        <div className="p-5">
          <EmptyState
            icon={ListChecks}
            title="No missions planned for today"
            hint="Plan two or three practical missions and the board fills up automatically."
          />
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{minutes} min planned</p>
        <Link
          href="/missions"
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          open board <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
