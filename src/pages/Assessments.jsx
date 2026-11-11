import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, ClipboardCheck, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import AssessmentForm from '@/components/assessments/AssessmentForm';
import { Button } from '@/components/ui/button';
import { useAssessments, useDepartments } from '@/hooks/useProgramme';
import { fmtDate, metaFor, sortBy } from '@/lib/programme';

const OUTCOME_CLASS = {
  pass: 'border-primary/50 bg-primary/10 text-primary',
  revise: 'border-destructive/50 bg-destructive/10 text-destructive',
  pending: 'border-border text-muted-foreground',
};

export default function Assessments() {
  const queryClient = useQueryClient();
  const { data: assessments = [] } = useAssessments();
  const { data: departments = [] } = useDepartments();
  const [formOpen, setFormOpen] = useState(false);

  const items = sortBy(assessments, 'date', 'desc');
  const scored = items.filter((a) => typeof a.score === 'number' && a.max_score);
  const average = scored.length
    ? Math.round(scored.reduce((sum, a) => sum + (a.score / a.max_score) * 100, 0) / scored.length)
    : 0;

  const tiles = [
    { label: 'Average score', value: `${average}%` },
    { label: 'Passed', value: items.filter((a) => a.outcome === 'pass').length },
    { label: 'To revise', value: items.filter((a) => a.outcome === 'revise').length },
    { label: 'Logged', value: items.length },
  ];

  const remove = async (item) => {
    await base44.entities.Assessment.delete(item.id);
    queryClient.invalidateQueries({ queryKey: ['assessments'] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assessments"
        title="Checkpoints"
        description="Score the practical tests, quizzes and reviews that decide whether a level is actually done."
      >
        <Button onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Log assessment
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-border bg-card px-4 py-4">
            <p className="font-display text-2xl leading-none tabular-nums text-foreground">{tile.value}</p>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{tile.label}</p>
          </div>
        ))}
      </div>

      {items.length ? (
        <section className="panel overflow-hidden">
          <ul>
            {items.map((item) => {
              const meta = metaFor(item.department_code);
              const dept = departments.find((d) => d.code === item.department_code);
              const pct = item.max_score ? Math.round(((item.score || 0) / item.max_score) * 100) : 0;
              return (
                <li key={item.id} className="group flex flex-wrap items-center gap-4 border-b border-border/60 px-5 py-4 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-foreground">{item.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 font-mono text-[10px] uppercase tracking-[0.12em]">
                      <span style={{ color: meta.color }}>{dept?.name || item.department_code}</span>
                      <span className="text-muted-foreground">{item.type}</span>
                      <span className="text-muted-foreground">{fmtDate(item.date)}</span>
                    </div>
                  </div>

                  <div className="flex w-32 items-center gap-2">
                    <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                    </div>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {item.score ?? '—'}/{item.max_score || 100}
                    </span>
                  </div>

                  <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${OUTCOME_CLASS[item.outcome] || OUTCOME_CLASS.pending}`}>
                    {item.outcome || 'pending'}
                  </span>

                  <button
                    type="button"
                    onClick={() => remove(item)}
                    aria-label="Delete assessment"
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <EmptyState icon={ClipboardCheck} title="No checkpoints yet" hint="Log a practical or a review to see where you actually stand.">
          <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Log assessment
          </Button>
        </EmptyState>
      )}

      <AssessmentForm open={formOpen} onOpenChange={setFormOpen} departments={departments} />
    </div>
  );
}