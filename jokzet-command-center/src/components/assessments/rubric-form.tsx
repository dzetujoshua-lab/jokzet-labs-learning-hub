"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assessSubmissionAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Criterion = { id: string; name: string; description: string; maxPoints: number };

const FAIL_BELOW = 40;

/** Live rubric scoring. The server recomputes everything; this only previews the result. */
export function RubricForm({ submissionId, criteria, passingScore }: { submissionId: string; criteria: Criterion[]; passingScore: number }) {
  const router = useRouter();
  const [points, setPoints] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const max = criteria.reduce((s, c) => s + c.maxPoints, 0);
  const complete = criteria.every((c) => points[c.id] !== undefined && points[c.id] !== "");
  const total = criteria.reduce((s, c) => s + Math.min(Math.max(Number(points[c.id] ?? 0) || 0, 0), c.maxPoints), 0);
  const pct = max ? Math.round((total / max) * 100) : 0;
  const outcome = pct >= passingScore ? "pass" : pct < FAIL_BELOW ? "fail" : "revise";

  const preview = useMemo(
    () => (complete ? { pass: "Pass", revise: "Needs revision", fail: "Fail" }[outcome] : "Score every criterion"),
    [complete, outcome],
  );

  const save = () => {
    setError("");
    startTransition(async () => {
      const result = await assessSubmissionAction(
        submissionId,
        criteria.map((c) => ({ criterionId: c.id, points: Math.round(Number(points[c.id])), comment: comments[c.id]?.trim() || undefined })),
        feedback.trim(),
      );
      if (!result.ok) return setError(result.error);
      toast.success(result.outcome === "PASS" ? `Passed with ${result.percentage}%${result.xpAwarded ? ` · +${result.xpAwarded} XP` : ""}` : `Scored ${result.percentage}%. Corrections added.`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <section className="panel overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <p className="mono-label">Rubric · pass at {passingScore}%</p>
        </div>
        <ul>
          {criteria.map((c) => (
            <li key={c.id} className="border-b border-border/60 px-5 py-4 last:border-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`pts-${c.id}`} className="text-sm text-foreground">{c.name}</label>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id={`pts-${c.id}`} type="number" inputMode="numeric" min={0} max={c.maxPoints} step={1} className="w-20"
                    value={points[c.id] ?? ""} onChange={(e) => setPoints((p) => ({ ...p, [c.id]: e.target.value }))} aria-describedby={`max-${c.id}`}
                  />
                  <span id={`max-${c.id}`} className="font-mono text-[10px] tabular-nums text-muted-foreground">/ {c.maxPoints}</span>
                </div>
              </div>
              <Input
                aria-label={`Comment on ${c.name}`} className="mt-2.5" placeholder="What happened here (optional)" maxLength={500}
                value={comments[c.id] ?? ""} onChange={(e) => setComments((p) => ({ ...p, [c.id]: e.target.value }))}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-5">
        <label htmlFor="feedback" className="mono-label">Overall feedback</label>
        <Textarea id="feedback" rows={3} maxLength={2000} className="mt-2" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What went well, what to fix next…" />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-2xl tabular-nums leading-none text-foreground">
              {total}<span className="text-muted-foreground">/{max}</span>
              <span className="ml-3 text-base text-muted-foreground">{pct}%</span>
            </p>
            <p aria-live="polite" className={`mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] ${complete && outcome === "pass" ? "text-primary" : complete ? "text-destructive" : "text-muted-foreground"}`}>
              {preview}
            </p>
          </div>
          <Button onClick={save} disabled={pending || !complete}>
            {pending ? "Saving…" : "Save assessment"}
          </Button>
        </div>
        {error ? <p role="alert" className="mt-3 text-xs text-destructive">{error}</p> : null}
      </section>
    </div>
  );
}
