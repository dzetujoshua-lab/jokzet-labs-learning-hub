"use client";

import { useState } from "react";
import { Images, Plus, Trash2 } from "lucide-react";
import { deleteEvidenceAction } from "@/app/(app)/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { fmtDate, metaFor } from "@/lib/programme";
import type { EvidenceView } from "@/lib/evidence/service";
import { EvidenceForm } from "./evidence-form";
import { EvidenceMedia } from "./evidence-media";

type Dept = { code: string; name: string };

/** Same page structure as the Base44 Evidence page: header + button, card grid, empty state. */
export function EvidenceVault({ items, departments, today }: { items: EvidenceView[]; departments: Dept[]; today: string }) {
  const [formOpen, setFormOpen] = useState(false);

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
            const meta = metaFor(item.departmentCode);
            const dept = departments.find((d) => d.code === item.departmentCode);
            return (
              <article key={item.id} className="group overflow-hidden rounded-2xl border border-border bg-card">
                <EvidenceMedia item={item} />
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: meta.color }}>
                      {dept?.name || item.departmentCode}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{fmtDate(item.capturedDate)}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-medium leading-snug text-foreground">{item.title}</h3>
                  {item.description ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p> : null}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{item.kind}</span>
                      {item.status === "verified" ? (
                        <span className="rounded-full border border-primary/50 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-primary">verified</span>
                      ) : item.attached ? (
                        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">in a mission</span>
                      ) : null}
                    </span>
                    {item.locked ? null : (
                      <form action={deleteEvidenceAction.bind(null, item.id)}>
                        <button
                          type="submit"
                          aria-label="Delete evidence"
                          className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                        </button>
                      </form>
                    )}
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

      <EvidenceForm open={formOpen} onOpenChange={setFormOpen} departments={departments} today={today} />
    </div>
  );
}
