import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Save, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import DeptGlyph from '@/components/dashboard/DeptGlyph';
import MissionRow from '@/components/dashboard/MissionRow';
import MissionForm from '@/components/missions/MissionForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDepartments, useMissions, useEvidence, useAssessments, usePortfolio } from '@/hooks/useProgramme';
import { setMissionStatus } from '@/lib/missions';
import { levelProgress, metaFor, fmtDate, sortBy } from '@/lib/programme';

function MissingDepartment() {
  useEffect(() => {
    const tag = document.createElement('meta');
    tag.name = 'prerender-status-code';
    tag.content = '404';
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  return (
    <div className="panel p-10 text-center">
      <p className="font-display text-lg text-foreground">This department doesn&apos;t exist</p>
      <Link to="/departments" className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
        back to departments
      </Link>
    </div>
  );
}

export default function DepartmentDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: departments = [], isLoading } = useDepartments();
  const { data: missions = [] } = useMissions();
  const { data: evidence = [] } = useEvidence();
  const { data: assessments = [] } = useAssessments();
  const { data: portfolio = [] } = usePortfolio();

  const dept = departments.find((d) => d.id === id);
  const [milestone, setMilestone] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dept) setMilestone(dept.next_milestone || '');
  }, [dept?.id, dept?.next_milestone]);

  if (isLoading) return <div className="h-64 animate-pulse rounded-3xl border border-border bg-card" />;
  if (!dept) return <MissingDepartment />;

  const meta = metaFor(dept.code);
  const { level, inLevel, target, pct } = levelProgress(dept.xp || 0);

  const deptMissions = sortBy(missions.filter((m) => m.department_code === dept.code), 'date', 'desc');
  const deptEvidence = sortBy(evidence.filter((e) => e.department_code === dept.code), 'captured_date', 'desc');
  const deptAssessments = sortBy(assessments.filter((a) => a.department_code === dept.code), 'date', 'desc');
  const deptPieces = portfolio.filter((p) => p.department_code === dept.code);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['missions'] });
    queryClient.invalidateQueries({ queryKey: ['departments'] });
  };

  const saveMilestone = async () => {
    await base44.entities.Department.update(dept.id, { next_milestone: milestone.trim() });
    setDirty(false);
    queryClient.invalidateQueries({ queryKey: ['departments'] });
  };

  const toggle = async (mission) => {
    await setMissionStatus(mission, mission.status === 'done' ? 'planned' : 'done', departments);
    refresh();
  };

  return (
    <div className="space-y-6">
      <Link
        to="/departments"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> departments
      </Link>

      <header className="panel animate-rise p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-secondary" style={{ color: meta.color }}>
              <DeptGlyph icon={meta.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="mono-label">Department</p>
              <h1 className="mt-2 font-display text-2xl font-medium leading-tight text-foreground">{dept.name}</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl leading-none tabular-nums text-foreground">LV {level}</p>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {inLevel}/{target} XP
            </p>
          </div>
        </div>

        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: meta.color }} />
        </div>

        <div className="mt-5">
          <p className="mono-label">Next milestone</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              value={milestone}
              onChange={(e) => {
                setMilestone(e.target.value);
                setDirty(true);
              }}
              placeholder="What does the next level actually prove?"
              className="max-w-md"
            />
            <Button onClick={saveMilestone} disabled={!dirty} size="sm" className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <p className="mono-label">Missions · {deptMissions.length}</p>
            <Button size="sm" variant="secondary" onClick={() => setFormOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {deptMissions.length ? (
            <ul>
              {deptMissions.slice(0, 8).map((mission) => (
                <MissionRow key={mission.id} mission={mission} deptName={dept.name} onToggle={() => toggle(mission)} />
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-xs text-muted-foreground">No missions logged for this department yet.</p>
          )}
        </section>

        <div className="space-y-5">
          <section className="panel p-5">
            <p className="mono-label">Evidence · {deptEvidence.length}</p>
            {deptEvidence.length ? (
              <ul className="mt-3 space-y-2.5">
                {deptEvidence.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-[13px] text-foreground">{item.title}</p>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {fmtDate(item.captured_date)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No evidence captured yet.</p>
            )}
          </section>

          <section className="panel p-5">
            <p className="mono-label">Assessments · {deptAssessments.length}</p>
            {deptAssessments.length ? (
              <ul className="mt-3 space-y-2.5">
                {deptAssessments.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-[13px] text-foreground">{item.title}</p>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                      {item.score ?? '—'}/{item.max_score || 100}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No assessments logged yet.</p>
            )}
          </section>

          <section className="panel p-5">
            <p className="mono-label">Portfolio · {deptPieces.length}</p>
            {deptPieces.length ? (
              <ul className="mt-3 space-y-2.5">
                {deptPieces.map((piece) => (
                  <li key={piece.id} className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-[13px] text-foreground">{piece.title}</p>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {piece.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No portfolio pieces mapped to this department.</p>
            )}
          </section>
        </div>
      </div>

      <MissionForm open={formOpen} onOpenChange={setFormOpen} departments={departments} defaultDepartment={dept.code} />
    </div>
  );
}