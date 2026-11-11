import { useMemo, useState } from 'react';
import moment from 'moment';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, ListChecks } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import MissionRow from '@/components/dashboard/MissionRow';
import MissionForm from '@/components/missions/MissionForm';
import { Button } from '@/components/ui/button';
import { useDepartments, useMissions } from '@/hooks/useProgramme';
import { setMissionStatus } from '@/lib/missions';
import { sortBy, todayISO } from '@/lib/programme';

const SCOPES = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'all', label: 'All' },
];

export default function Missions() {
  const queryClient = useQueryClient();
  const { data: departments = [] } = useDepartments();
  const { data: missions = [] } = useMissions();
  const [scope, setScope] = useState('today');
  const [dept, setDept] = useState('all');
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = missions;
    if (scope === 'today') list = list.filter((m) => m.date === todayISO());
    if (scope === 'week') list = list.filter((m) => m.date && moment(m.date).isSame(moment(), 'isoWeek'));
    if (dept !== 'all') list = list.filter((m) => m.department_code === dept);
    return sortBy(list, 'date', 'asc');
  }, [missions, scope, dept]);

  const done = filtered.filter((m) => m.status === 'done').length;
  const minutes = filtered.reduce((sum, m) => sum + (m.minutes || 0), 0);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['missions'] });
    queryClient.invalidateQueries({ queryKey: ['departments'] });
  };

  const toggle = async (mission) => {
    await setMissionStatus(mission, mission.status === 'done' ? 'planned' : 'done', departments);
    refresh();
  };

  const remove = async (mission) => {
    await base44.entities.Mission.delete(mission.id);
    refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily missions"
        title="Mission board"
        description="Small, finishable actions across the nine departments. Every mission names the evidence it should leave behind."
      >
        <Button onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New mission
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-border bg-card p-1">
          {SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setScope(item.id)}
              className={`rounded-full px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                scope === item.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="h-9 rounded-full border border-border bg-card px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground outline-none focus:border-primary"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>

        <p className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {done}/{filtered.length} cleared · {minutes} min
        </p>
      </div>

      <section className="panel overflow-hidden">
        {filtered.length ? (
          <ul>
            {filtered.map((mission) => (
              <MissionRow
                key={mission.id}
                mission={mission}
                deptName={departments.find((d) => d.code === mission.department_code)?.name || mission.department_code}
                onToggle={() => toggle(mission)}
                onDelete={() => remove(mission)}
              />
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={ListChecks}
              title="Nothing on the board here"
              hint="Add a mission with a clear finish line and the evidence to capture."
            >
              <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New mission
              </Button>
            </EmptyState>
          </div>
        )}
      </section>

      <MissionForm open={formOpen} onOpenChange={setFormOpen} departments={departments} />
    </div>
  );
}