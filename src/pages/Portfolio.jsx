import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Layers, ExternalLink, Pencil, ArrowRight, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import PortfolioForm from '@/components/portfolio/PortfolioForm';
import { Button } from '@/components/ui/button';
import { Image } from '@/components/ui/image';
import { useDepartments, usePortfolio } from '@/hooks/useProgramme';
import { metaFor, sortBy } from '@/lib/programme';

const STATUS_CLASS = {
  shipped: 'border-primary/50 bg-primary/10 text-primary',
  building: 'border-chart-7/50 bg-chart-7/10 text-chart-7',
  concept: 'border-border text-muted-foreground',
};

export default function Portfolio() {
  const queryClient = useQueryClient();
  const { data: portfolio = [] } = usePortfolio();
  const { data: departments = [] } = useDepartments();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const capstone = portfolio.find((p) => p.is_capstone);
  const pieces = sortBy(portfolio.filter((p) => !p.is_capstone), 'created_date', 'desc');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['portfolio'] });

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (piece) => {
    setEditing(piece);
    setFormOpen(true);
  };

  const moveStage = async (piece, delta) => {
    const stages = piece.stages || 8;
    const stage = Math.min(stages, Math.max(0, (piece.stage || 0) + delta));
    const status = stage >= stages ? 'shipped' : piece.status === 'concept' ? 'building' : piece.status;
    await base44.entities.PortfolioPiece.update(piece.id, { stage, status });
    refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolio"
        title="Work that shows the level"
        description="The capstone ties every department together; the pieces beside it are the proof along the way."
      >
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> New piece
        </Button>
      </PageHeader>

      {capstone ? (
        <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-32 h-64 opacity-[0.12] blur-3xl"
            style={{ background: 'linear-gradient(90deg, hsl(var(--chart-1)), hsl(var(--chart-4)), transparent)' }}
          />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mono-label">Main software integration capstone</p>
              <h2 className="mt-2.5 font-display text-2xl font-medium tracking-tight text-foreground">{capstone.title}</h2>
              <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                {capstone.summary || 'Set a short summary so the build stays anchored to a real outcome.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {capstone.link_url ? (
                <a
                  href={capstone.link_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                >
                  open <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => openEdit(capstone)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
              >
                edit <Pencil className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="relative mt-6 flex items-center gap-1.5">
            {Array.from({ length: capstone.stages || 8 }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i < (capstone.stage || 0) ? 'bg-primary' : 'bg-secondary'}`}
              />
            ))}
          </div>

          <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              stage {capstone.stage || 0} of {capstone.stages || 8}
              {capstone.tools ? ` · ${capstone.tools}` : ''}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => moveStage(capstone, -1)} className="gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> back
              </Button>
              <Button size="sm" onClick={() => moveStage(capstone, 1)} className="gap-1">
                advance <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {pieces.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pieces.map((piece) => {
            const meta = metaFor(piece.department_code);
            const dept = departments.find((d) => d.code === piece.department_code);
            return (
              <article key={piece.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
                {piece.media_url ? (
                  <div className="aspect-[16/10] w-full overflow-hidden bg-secondary">
                    <Image src={piece.media_url} alt={piece.title} className="h-full w-full" fittingType="fill" />
                  </div>
                ) : (
                  <div className="flex aspect-[16/10] w-full items-center justify-center bg-secondary/50">
                    <Layers className="h-6 w-6" strokeWidth={1.4} style={{ color: meta.color }} />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: meta.color }}>
                      {dept?.name || piece.department_code || 'Unassigned'}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${STATUS_CLASS[piece.status] || STATUS_CLASS.concept}`}>
                      {piece.status}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-medium leading-snug text-foreground">{piece.title}</h3>
                  {piece.summary ? (
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{piece.summary}</p>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => openEdit(piece)}
                      className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                    >
                      edit
                    </button>
                    {piece.link_url ? (
                      <a
                        href={piece.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                      >
                        open <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Layers} title="No pieces yet" hint="Add the projects you're building — even the rough ones belong here.">
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New piece
          </Button>
        </EmptyState>
      )}

      <PortfolioForm open={formOpen} onOpenChange={setFormOpen} departments={departments} piece={editing} />
    </div>
  );
}