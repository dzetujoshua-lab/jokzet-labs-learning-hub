"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelReviewAction, requestReviewAction } from "@/app/(app)/review/actions";
import { Button } from "@/components/ui/button";
import type { ReviewState } from "@/lib/reviews/service";

const LABEL: Record<ReviewState["status"], string> = {
  SELF_RECORDED: "Self-assessed",
  PENDING_REVIEW: "Waiting for a reviewer",
  VERIFIED: "Verified by a reviewer",
  NEEDS_REVISION: "Reviewed: needs revision",
  REJECTED: "Reviewed: not accepted",
};

const DECISION: Record<"CONFIRM" | "ADJUST" | "REJECT", string> = {
  CONFIRM: "Your self-assessment was confirmed.",
  ADJUST: "A reviewer adjusted your scores.",
  REJECT: "A reviewer did not accept this work.",
};

/** The learner's view of review: what the status means, and the request / withdraw buttons. */
export function ReviewStatus({ state, canAsk }: { state: ReviewState; canAsk: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setError("");
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      toast.success(done);
      router.refresh();
    });
  };

  const r = state.latestReview;
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="mono-label">Review</p>
        <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{LABEL[state.status]}</span>
      </div>

      {state.status === "SELF_RECORDED" ? (
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          This result is your own assessment. Ask a reviewer to verify it and it becomes a verified result. The reviewer will see this submission and its evidence.
        </p>
      ) : null}
      {state.status === "PENDING_REVIEW" ? (
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          {state.requestStatus === "CLAIMED" ? "A reviewer is looking at this now." : "No reviewer has picked this up yet. You can withdraw it until one does."}
        </p>
      ) : null}
      {r ? (
        <div className="mt-3 text-[13px] leading-relaxed text-foreground">
          <p>{DECISION[r.decision]}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Verified result {r.percentage}% · {r.outcome.toLowerCase()} · {r.reviewerLabel}
          </p>
          {r.reason ? <p className="mt-2 text-muted-foreground">{r.reason}</p> : null}
          {r.decision !== "CONFIRM" ? <p className="mt-2 text-xs text-muted-foreground">The scores below are your own self-assessment, kept as you recorded it.</p> : null}
        </div>
      ) : null}

      {canAsk && state.status === "SELF_RECORDED" ? (
        <Button className="mt-4" size="sm" disabled={pending} onClick={() => run(() => requestReviewAction(state.assessmentId), "Review requested")}>
          {pending ? "Requesting…" : "Request review"}
        </Button>
      ) : null}
      {state.status === "PENDING_REVIEW" && state.requestStatus === "OPEN" ? (
        <Button className="mt-4" size="sm" variant="secondary" disabled={pending} onClick={() => run(() => cancelReviewAction(state.assessmentId), "Request withdrawn")}>
          Withdraw request
        </Button>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
