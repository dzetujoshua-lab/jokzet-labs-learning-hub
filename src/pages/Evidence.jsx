import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Images, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import EvidenceForm from '@/components/evidence/EvidenceForm';
import EvidenceMedia from '@/components/evidence/EvidenceMedia';
import { Button } from '@/components/ui/button';
import { useDepartments, useEvidence } from '@/hooks/useProgramme';
import { fmtDate, metaFor, sortBy } from '@/lib/programme';

export default function Evidence() {
  const queryClient = useQueryClient();
  const { data: departments = [] } = useDepartments();
  const { data: evidence = [] } = useEvidence();
  const [formOpen, setFormOpen] = useState(false);

  const items = sortBy(evidence, 'captured_date', 'desc');

  const remove = async (item) => {
    await base44.entities.Evidence.delete(item.id);
    queryClient.invalidateQueries({ queryKey: ['evidence'] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Evidence vault"
        title="Proof of work"
        description="Every mission leaves something behind. Files are stored privately and open only for you."
      >
        <Button onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Log evidence
        </Button>
      </PageHeader>

      {items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const meta = metaFor(item.department_code);
            const dept = departments.find((d) => d.code === item.department_code);
            return (
              <article key={item.id} className="group overflow-hidden rounded-2xl border border-border bg-card">
                <EvidenceMedia evidence={item} />
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: meta.color }}>
                      {dept?.name || item.department_code}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {fmtDate(item.captured_date)}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-medium leading-snug text-foreground">{item.title}</h3>
                  {item.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                      {item.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      aria-label="Delete evidence"
                      className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Images} title="The vault is empty" hint="Log your first piece of evidence — a screenshot, a file, or a link to work you shipped.">
          <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Log evidence
          </Button>
        </EmptyState>
      )}

      <EvidenceForm open={formOpen} onOpenChange={setFormOpen} departments={departments} />
    </div>
  );
}