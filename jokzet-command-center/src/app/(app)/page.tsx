import Link from "next/link";
import { Flame, Plus } from "lucide-react";
import { CapstoneStrip } from "@/components/dashboard/capstone-strip";
import { DepartmentCard } from "@/components/dashboard/department-card";
import { LevelBand } from "@/components/dashboard/level-band";
import { ProgressPanel } from "@/components/dashboard/progress-panel";
import { ReminderRail } from "@/components/dashboard/reminder-rail";
import { TodayMissions } from "@/components/dashboard/today-missions";
import { UpcomingPanel } from "@/components/dashboard/upcoming-panel";
import { requireUser } from "@/lib/auth/dal";
import { getDashboardData } from "@/lib/dashboard";
import {
  PROGRAMME_XP_PER_LEVEL, computeStreak, fmtLongToday, fmtWeekOf, sameIsoWeek, todayISO,
} from "@/lib/programme";

const STATUS_RANK = { active: 0, planned: 1, done: 2, skipped: 3 } as const;

export default async function CommandPage() {
  const user = await requireUser();
  const { departments, missions, evidenceCount, assessmentsPassed, reminders, capstone, daily, upcoming } = await getDashboardData(user.id);

  const today = todayISO();
  const todaysMissions = missions
    .filter((m) => m.date === today)
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  const doneMissions = missions.filter((m) => m.status === "done");
  const weekMissions = missions.filter((m) => m.date && sameIsoWeek(m.date, today));
  const weekDone = weekMissions.filter((m) => m.status === "done").length;
  const weekPercent = weekMissions.length ? Math.round((weekDone / weekMissions.length) * 100) : 0;

  const totalXp = departments.reduce((sum, d) => sum + d.xp, 0);
  const level = Math.floor(totalXp / PROGRAMME_XP_PER_LEVEL);
  const xpIntoLevel = totalXp % PROGRAMME_XP_PER_LEVEL;
  const streak = computeStreak(doneMissions.map((m) => m.date));

  return (
    <div className="space-y-7">
      <header className="animate-rise flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mono-label">{fmtLongToday()}</p>
          <h1 className="mt-3 font-display text-[30px] font-medium leading-none tracking-tight text-foreground md:text-[40px]">
            Command Center
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Nine departments, one operating rhythm. Level {level} — build the base, capture the evidence, keep the
            streak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
            <Flame className="h-3 w-3" strokeWidth={2} />
            {streak}-day streak
          </span>
          <Link
            href="/missions"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary-foreground"
          >
            <Plus className="h-3 w-3" strokeWidth={2.4} /> mission
          </Link>
        </div>
      </header>

      <LevelBand
        level={level}
        xp={xpIntoLevel}
        xpTarget={PROGRAMME_XP_PER_LEVEL}
        streak={streak}
        evidenceCount={evidenceCount}
        assessmentsPassed={assessmentsPassed}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodayMissions missions={todaysMissions} departments={departments} daily={daily} />
        </div>
        <div className="space-y-5">
          <ProgressPanel
            eyebrow="Weekly cadence"
            title="Mission load cleared"
            badge={`${weekDone} / ${weekMissions.length} missions`}
            percent={weekPercent}
            footnote={fmtWeekOf(today)}
          />
          <ReminderRail reminders={reminders} />
          <UpcomingPanel items={upcoming} />
        </div>
      </div>

      <section className="animate-rise">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="mono-label">Nine departments</p>
            <h2 className="mt-2 font-display text-lg font-medium text-foreground">Skill progression</h2>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">300 XP per level</p>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {departments.map((dept) => (
            <DepartmentCard key={dept.id} dept={dept} />
          ))}
        </div>
      </section>

      <CapstoneStrip piece={capstone} />
    </div>
  );
}
