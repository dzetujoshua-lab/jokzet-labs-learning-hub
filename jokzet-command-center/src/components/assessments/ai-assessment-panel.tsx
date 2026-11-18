"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AiJobView } from "@/lib/ai/view";

const STEPS = ["Submitted", "Queued", "Reviewing evidence", "AI assessment", "Result"] as const;
const STEP_OF: Record<AiJobView["status"], number> = { QUEUED: 1, REVIEWING_EVIDENCE: 2, AI_IN_PROGRESS: 3, RETRY_PENDING: 1, AI_COMPLETE: 4, NEEDS_HUMAN_REVIEW: 4, FAILED: 4 };

const List = ({ title, items }: { title: string; items: string[] }) =>
  items.length ? (
    <div className="mt-4">
      <p className="mono-label">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-foreground">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  ) : null;

/**
 * The AI assessment's state and, once there is one, what it found. It never shows a score that has not been stored: while the
 * job is still running it shows a step list instead, and refreshes itself until the state changes.
 */
export function AiAssessmentPanel({ view }: { view: AiJobView }) {
  const router = useRouter();
  useEffect(() => {
    if (!view.processing) return;
    const t = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(t);
  }, [view.processing, router]);

  const at = STEP_OF[view.status];
  return (
    <section className="panel p-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="mono-label">AI assessment</p>
        <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{view.label}</span>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{view.detail}</p>

      <ol className="mt-4 flex flex-wrap gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === at ? "step" : undefined}
            className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${i < at ? "border-primary/40 text-primary" : i === at ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
            {s}
          </li>
        ))}
      </ol>

      {view.hasResult ? (
        <div className="mt-5 border-t border-border pt-4">
          {view.summary ? <p className="text-sm leading-relaxed text-foreground">{view.summary}</p> : null}
          {view.confidencePercent !== null ? <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">AI confidence {view.confidencePercent}%</p> : null}
          <List title="What you did well" items={view.strengths} />
          <List title="What to improve" items={view.improvements} />
          <List title="Next steps" items={view.nextSteps} />
          <List title="Limits of this assessment" items={view.limitations} />
        </div>
      ) : null}
    </section>
  );
}
