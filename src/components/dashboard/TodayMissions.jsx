import { Link } from 'react-router-dom';
import { ArrowUpRight, ListChecks } from 'lucide-react';
import MissionRow from './MissionRow';
import EmptyState from '@/components/EmptyState';

export default function TodayMissions({ missions, departments, onToggle }) {
  const done = missions.filter((m) => m.status === 'done').length;

  const deptName = (code) => departments.find((d) => d.code === code)?.name || code;

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
            <span className="text-muted-foreground">/{missions.length}</span>
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">cleared</p>
        </div>
      </header>

      {missions.length ? (
        <ul>
          {missions.map((mission) => (
            <MissionRow
              key={mission.id}
              mission={mission}
              deptName={deptName(mission.department_code)}
              onToggle={() => onToggle(mission)}
            />
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
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {missions.reduce((sum, m) => sum + (m.minutes || 0), 0)} min planned
        </p>
        <Link
          to="/missions"
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          open board <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}