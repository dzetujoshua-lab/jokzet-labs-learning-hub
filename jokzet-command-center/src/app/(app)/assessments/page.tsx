import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getAssessmentOverview } from "@/lib/assessments/service";
import { requireUser } from "@/lib/auth/dal";
import { ensureLearnerSetup, listDepartments } from "@/lib/missions/service";
import { fmtDate, metaFor } from "@/lib/programme";

export const metadata: Metadata = { title: "Checkpoints" };

// Classes copied from the Base44 Assessments page (OUTCOME_CLASS).
const OUTCOME_CLASS = {
  pass: "border-primary/50 bg-primary/10 text-primary",
  revise: "border-destructive/50 bg-destructive/10 text-destructive",
  fail: "border-destructive/50 bg-destructive/10 text-destructive",
  pending: "border-border text-muted-foreground",
} as const;

export default async function AssessmentsPage() {
  const user = await requireUser();
  await ensureLearnerSetup(user.id);
  const [{ rows, pending, weaknesses, stats }, departments] = await Promise.all([getAssessmentOverview(user.id), listDepartments(user.id)]);
  const deptName = (code: string) => departments.find((d) => d.code === code)?.name || code;

  const tiles = [
    { label: "Average score", value: `${stats.average}%` },
    { label: "Passed", value: stats.passed },
    { label: "To revise", value: stats.toRevise },
    { label: "Logged", value: stats.logged },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assessments"
        title="Checkpoints"
        description="Score submitted evidence against the rubric. A pass finishes the mission and earns its XP; anything else comes back with corrections."
      >
        {pending.length ? (
          <Button asChild className="gap-1.5">
            <Link href={`/assessments/${pending[0].submissionId}`}>
              <ClipboardCheck className="h-4 w-4" /> Assess a submission
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-border bg-card px-4 py-4">
            <p className="font-display text-2xl leading-none tabular-nums text-foreground">{tile.value}</p>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{tile.label}</p>
          </div>
        ))}
      </div>

      {pending.length ? (
        <section className="panel overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <p className="mono-label">Awaiting assessment · {pending.length}</p>
          </div>
          <ul>
            {pending.map((p) => {
              const meta = metaFor(p.departmentCode);
              return (
                <li key={p.submissionId} className="flex flex-wrap items-center gap-4 border-b border-border/60 px-5 py-4 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-foreground">{p.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 font-mono text-[10px] uppercase tracking-[0.12em]">
                      <span style={{ color: meta.color }}>{deptName(p.departmentCode)}</span>
                      <span className="text-muted-foreground">attempt {p.attempt}</span>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/assessments/${p.submissionId}`}>Assess</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {rows.length ? (
        <section className="panel overflow-hidden">
          <ul>
            {rows.map((item) => {
              const meta = metaFor(item.departmentCode);
              return (
                <li key={item.id} className="group flex flex-wrap items-center gap-4 border-b border-border/60 px-5 py-4 last:border-0">
                  <div className="min-w-0 flex-1">
                    <Link href={`/assessments/${item.submissionId}`} className="block text-sm leading-snug text-foreground hover:text-primary">
                      {item.title}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 font-mono text-[10px] uppercase tracking-[0.12em]">
                      <span style={{ color: meta.color }}>{deptName(item.departmentCode)}</span>
                      <span className="text-muted-foreground">attempt {item.attempt}</span>
                      <span className="text-muted-foreground">{fmtDate(item.date)}</span>
                      {item.openCorrections ? <span className="text-destructive">{item.openCorrections} open correction{item.openCorrections > 1 ? "s" : ""}</span> : null}
                    </div>
                  </div>

                  <div className="flex w-32 items-center gap-2">
                    <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full" style={{ width: `${item.percentage}%`, background: meta.color }} />
                    </div>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {item.score}/{item.maxScore}
                    </span>
                  </div>

                  <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${OUTCOME_CLASS[item.outcome]}`}>{item.outcome}</span>

                  {/* Base44 reserves this space for a hover-only delete button. Assessments are permanent records here, so
                      the space stays (identical layout) but there is no button. */}
                  <span aria-hidden className="h-3.5 w-3.5" />
                </li>
              );
            })}
          </ul>
        </section>
      ) : pending.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No checkpoints yet" hint="Submit a mission with evidence, then score it against its rubric to see where you actually stand." />
      ) : null}

      {weaknesses.length ? (
        <section className="panel p-5">
          <p className="mono-label">Weak areas</p>
          <ul className="mt-3 space-y-2.5">
            {weaknesses.map((w) => (
              <li key={`${w.departmentCode}:${w.name}`} className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-[13px] text-foreground">
                  {w.name} <span className="text-muted-foreground">· {deptName(w.departmentCode)}</span>
                </p>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {w.count}× below target
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
