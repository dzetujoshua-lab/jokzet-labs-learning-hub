import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ClaimButton } from "@/components/reviews/review-controls";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { fmtDate, metaFor } from "@/lib/programme";
import { listQueue } from "@/lib/reviews/service";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewQueuePage() {
  const user = await requireRole("ADMIN", "REVIEWER");
  const queue = await listQueue({ id: user.id, role: user.role, displayName: user.displayName });
  const mine = queue.filter((q) => q.mine);
  const open = queue.filter((q) => !q.mine);

  const row = (q: (typeof queue)[number]) => {
    const meta = metaFor(q.departmentCode);
    return (
      <li key={q.id} className="flex flex-wrap items-center gap-4 border-b border-border/60 px-5 py-4 last:border-0">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-foreground">{q.missionTitle}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 font-mono text-[10px] uppercase tracking-[0.12em]">
            <span style={{ color: meta.color }}>{q.departmentCode}</span>
            <span className="text-muted-foreground">{q.learnerName}</span>
            <span className="text-muted-foreground">self {q.selfPercentage}% · {q.selfOutcome.toLowerCase()}</span>
            <span className="text-muted-foreground">{fmtDate(q.requestedAt.slice(0, 10))}</span>
          </div>
        </div>
        {q.mine ? (
          <Button asChild size="sm" variant="secondary">
            <Link href={`/review/${q.id}`}>Continue</Link>
          </Button>
        ) : (
          <ClaimButton requestId={q.id} />
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reviewer"
        title="Review queue"
        description="Learners' self-assessments waiting to be verified. Claim one to see the work and its evidence; every file you open is logged. You never see your own work here."
      />
      {mine.length ? (
        <section className="panel overflow-hidden">
          <div className="border-b border-border px-5 py-4"><p className="mono-label">Claimed by you · {mine.length}</p></div>
          <ul>{mine.map(row)}</ul>
        </section>
      ) : null}
      {open.length ? (
        <section className="panel overflow-hidden">
          <div className="border-b border-border px-5 py-4"><p className="mono-label">Open · {open.length}</p></div>
          <ul>{open.map(row)}</ul>
        </section>
      ) : mine.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing to review" hint="When a learner in your departments asks for a review, it will appear here." />
      ) : null}
    </div>
  );
}
