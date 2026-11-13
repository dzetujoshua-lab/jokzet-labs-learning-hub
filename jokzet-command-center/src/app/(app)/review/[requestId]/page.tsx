import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { ReviewForm } from "@/components/reviews/review-controls";
import { requireRole } from "@/lib/auth/dal";
import { fmtDate, metaFor } from "@/lib/programme";
import { getReviewCase } from "@/lib/reviews/service";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewCasePage({ params }: PageProps<"/review/[requestId]">) {
  const { requestId } = await params;
  const user = await requireRole("ADMIN", "REVIEWER");
  const c = await getReviewCase({ id: user.id, role: user.role, displayName: user.displayName }, requestId);
  if (!c) notFound(); // not yours, not claimed, out of scope and non-existent all look the same
  const meta = metaFor(c.mission.departmentCode);
  const file = (evidenceId: string) => `/api/review/${requestId}/evidence/${evidenceId}/file`;

  return (
    <div className="space-y-6">
      <Link href="/review" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> review queue
      </Link>

      <header className="panel p-6">
        <p className="mono-label" style={{ color: meta.color }}>{c.mission.departmentCode} · {c.learnerName}</p>
        <h1 className="mt-2 font-display text-2xl font-medium leading-tight text-foreground">{c.mission.title}</h1>
        {c.mission.objective ? <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{c.mission.objective}</p> : null}
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          self-assessed {c.selfPercentage}% · {c.selfOutcome.toLowerCase()} · pass at {c.mission.passingScore}%
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-4"><p className="mono-label">Learner&apos;s own scores</p></div>
            <ul>
              {c.criteria.map((k) => (
                <li key={k.id} className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3 last:border-0">
                  <div className="min-w-0">
                    <p className="text-[13px] text-foreground">{k.name}</p>
                    {k.selfComment ? <p className="mt-0.5 text-xs text-muted-foreground">{k.selfComment}</p> : null}
                  </div>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{k.selfPoints}/{k.maxPoints}</span>
                </li>
              ))}
            </ul>
          </section>
          <ReviewForm requestId={requestId} criteria={c.criteria} passingScore={c.mission.passingScore} />
        </div>

        <aside className="space-y-5">
          <section className="panel p-5">
            <p className="mono-label">Submitted work</p>
            {c.explanation ? <p className="mt-3 text-[13px] leading-relaxed text-foreground">{c.explanation}</p> : null}
            <ul className="mt-3 space-y-2">
              {[["Repository", c.githubUrl], ["Live project", c.liveUrl]].map(([label, url]) =>
                url ? (
                  <li key={label}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                      {label} <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ) : null,
              )}
            </ul>
          </section>

          <section className="space-y-3">
            <p className="mono-label px-1">Evidence · {c.evidence.length}</p>
            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">Opening a file is recorded in the access log.</p>
            {c.evidence.map((e) => (
              <article key={e.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                {e.fileKind === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private, request-scoped route; next/image would cache it
                  <img src={file(e.id)} alt={e.title} className="max-h-72 w-full object-cover" />
                ) : e.fileKind === "VIDEO" ? (
                  <video src={file(e.id)} controls preload="none" className="max-h-72 w-full" />
                ) : null}
                <div className="p-4">
                  <h3 className="text-sm font-medium leading-snug text-foreground">{e.title}</h3>
                  {e.fileName && e.fileKind !== "IMAGE" && e.fileKind !== "VIDEO" ? (
                    <a href={file(e.id)} className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary"><FileText className="h-3.5 w-3.5" /> {e.fileName}</a>
                  ) : null}
                  {e.linkUrl ? (
                    <a href={e.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary">Link <ExternalLink className="h-3 w-3" /></a>
                  ) : null}
                </div>
              </article>
            ))}
          </section>

          {c.priorReviews.length ? (
            <section className="panel p-5">
              <p className="mono-label">Earlier reviews</p>
              <ul className="mt-3 space-y-2 text-[13px] text-foreground">
                {c.priorReviews.map((p, i) => (
                  <li key={i}>{p.decision.toLowerCase()} · {p.percentage}% <span className="text-muted-foreground">· {p.reviewerLabel} · {fmtDate(p.at.slice(0, 10))}</span></li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
