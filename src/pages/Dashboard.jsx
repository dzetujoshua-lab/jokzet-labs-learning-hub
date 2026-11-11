import moment from 'moment';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Flame, Plus } from 'lucide-react';
import LevelBand from '@/components/dashboard/LevelBand';
import TodayMissions from '@/components/dashboard/TodayMissions';
import ProgressPanel from '@/components/dashboard/ProgressPanel';
import ReminderRail from '@/components/dashboard/ReminderRail';
import DepartmentCard from '@/components/dashboard/DepartmentCard';
import CapstoneStrip from '@/components/dashboard/CapstoneStrip';
import { useDepartments, useMissions, useEvidence, useAssessments, usePortfolio, useReminders } from '@/hooks/useProgramme';
import { setMissionStatus } from '@/lib/missions';
import { computeStreak, PROGRAMME_XP_PER_LEVEL, sortBy, todayISO } from '@/lib/programme';

const STATUS_RANK = { active: 0, planned: 1, done: 2, skipped: 3 };

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: departments = [], isLoading: loadingDepartments } = useDepartments();
  const { data: missions = [] } = useMissions();
  const { data: evidence = [] } = useEvidence();
  const { data: assessments = [] } = useAssessments();
  const { data: portfolio = [] } = usePortfolio();
  const { data: reminders = [] } = useReminders();

  const today = todayISO();
  const todaysMissions = sortBy(
    missions.filter((m) => m.date === today),
    'created_date',
    'asc'
  ).sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9));

  const doneMissions = missions.filter((m) => m.status === 'done');
  const weekMissions = missions.filter((m) => m.date && moment(m.date).isSame(moment(), 'isoWeek'));
  const weekDone = weekMissions.filter((m) => m.status === 'done').length;
  const weekPercent = weekMissions.length ? Math.round((weekDone / weekMissions.length) * 100) : 0;

  const totalXp = departments.reduce((sum, d) => sum + (d.xp || 0), 0);
  const level = Math.floor(totalXp / PROGRAMME_XP_PER_LEVEL);
  const xpIntoLevel = totalXp % PROGRAMME_XP_PER_LEVEL;

  const capstone = portfolio.find((p) => p.is_capstone);

  const toggleMission = async (mission) => {
    await setMissionStatus(mission, mission.status === 'done' ? 'planned' : 'done', departments);
    queryClient.invalidateQueries({ queryKey: ['missions'] });
    queryClient.invalidateQueries({ queryKey: ['departments'] });
  };

  if (loadingDepartments) {
    return <div className="h-64 animate-pulse rounded-3xl border border-border bg-card" />;
  }

  return (
    <div className="space-y-7">
      <header className="animate-rise flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mono-label">{moment().format('dddd · D MMM YYYY')}</p>
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
            {computeStreak(doneMissions.map((m) => m.date))}-day streak
          </span>
          <Link
            to="/missions"
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
        streak={computeStreak(doneMissions.map((m) => m.date))}
        evidenceCount={evidence.length}
        assessmentsPassed={assessments.filter((a) => a.outcome === 'pass').length}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodayMissions missions={todaysMissions} departments={departments} onToggle={toggleMission} />
        </div>
        <div className="space-y-5">
          <ProgressPanel
            eyebrow="Weekly cadence"
            title="Mission load cleared"
            badge={`${weekDone} / ${weekMissions.length} missions`}
            percent={weekPercent}
            footnote={moment().startOf('isoWeek').format('[Week of] D MMM')}
          />
          <ReminderRail reminders={reminders} />
        </div>
      </div>

      <section className="animate-rise">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="mono-label">Nine departments</p>
            <h2 className="mt-2 font-display text-lg font-medium text-foreground">Skill progression</h2>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            300 XP per level
          </p>
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