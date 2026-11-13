import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AssessmentResult } from "@/components/assessments/assessment-result";
import { RubricForm } from "@/components/assessments/rubric-form";
import { DeptGlyph } from "@/components/dashboard/dept-glyph";
import { EvidenceMedia } from "@/components/evidence/evidence-media";
import { Button } from "@/components/ui/button";
import { getAssessmentContext } from "@/lib/assessments/service";
import { ReviewStatus } from "@/components/reviews/review-status";
import { requireUser } from "@/lib/auth/dal";
import { getReviewState } from "@/lib/reviews/service";
import { fmtDate, metaFor, toLabel } from "@/lib/programme";

export const metadata: Metadata = { title: "Assessment" };

export default async function AssessmentDetailPage({ params }: PageProps<"/assessments/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const submission = await getAssessmentContext(user.id, id); // owner-scoped: someone else's id is simply "not found"
  if (!submission || submission.status === "DRAFT") notFound();

  const mission = submission.learnerMission.mission;
  const meta = metaFor(mission.department.code);
  const rubric = mission.rubric;
  const assessed = submission.status === "ASSESSED" && submission.assessment;
  const reviewState = assessed ? await getReviewState(user.id, submission.assessment!.id) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/assessments" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> assessments
        </Link>
      </div>

      <header className="panel animate-rise p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-secondary" style={{ color: meta.color }}>
              <DeptGlyph icon={meta.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="mono-label">{mission.department.name} · attempt {submission.attempt}</p>
              <h1 className="mt-2 font-display text-2xl font-medium leading-tight text-foreground">{mission.title}</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{mission.submissionRequirements}</p>
            </div>
          </div>
          {mission.code ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/missions/${mission.code}`}>Open mission</Link>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {reviewState ? <ReviewStatus state={reviewState} canAsk /> : null}
          {assessed ? (
            <AssessmentResult assessment={submission.assessment!} />
          ) : rubric ? (
            <RubricForm
              submissionId={submission.id}
              passingScore={rubric.passingScore}
              criteria={rubric.criteria.map((c) => ({ id: c.id, name: c.name, description: c.description, maxPoints: c.maxPoints }))}
            />
          ) : (
            <p className="panel p-5 text-sm text-muted-foreground">This mission has no rubric yet.</p>
          )}
        </div>

        <aside className="space-y-5">
          <section className="panel p-5">
            <p className="mono-label">Submitted work</p>
            {submission.explanation ? <p className="mt-3 text-[13px] leading-relaxed text-foreground">{submission.explanation}</p> : null}
            <ul className="mt-3 space-y-2">
              {[["Repository", submission.githubUrl], ["Live project", submission.liveUrl]].map(([label, url]) =>
                url ? (
                  <li key={label}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                      {label} <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ) : null,
              )}
            </ul>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {submission.submittedAt ? `Submitted ${fmtDate(submission.submittedAt.toISOString().slice(0, 10))}` : ""}
            </p>
          </section>

          <section className="space-y-3">
            <p className="mono-label px-1">Evidence · {submission.evidence.length}</p>
            {submission.evidence.length ? (
              submission.evidence.map((e) => (
                <article key={e.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <EvidenceMedia
                    item={{ id: e.id, title: e.title, kind: toLabel(e.kind), departmentCode: e.department.code, fileName: e.file?.originalName ?? null, fileKind: e.file?.kind ?? null, linkUrl: e.linkUrl }}
                  />
                  <div className="p-4">
                    <h3 className="text-sm font-medium leading-snug text-foreground">{e.title}</h3>
                    {e.description ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{e.description}</p> : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="panel p-5 text-xs text-muted-foreground">No files were attached. Only the links above were submitted.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
