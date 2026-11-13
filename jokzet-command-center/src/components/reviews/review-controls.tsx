"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { claimReviewAction, completeReviewAction, releaseReviewAction } from "@/app/(app)/review/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ClaimButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="text-right">
      <Button
        size="sm" disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await claimReviewAction(requestId);
            if (!r.ok) return setError(r.error ?? "Could not claim.");
            router.push(`/review/${requestId}`);
          })
        }
      >
        {pending ? "Claiming…" : "Claim"}
      </Button>
      {error ? <p role="alert" className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

type Criterion = { id: string; name: string; maxPoints: number; selfPoints: number; selfComment: string | null };
type Decision = "CONFIRM" | "ADJUST" | "REJECT";

const DECISIONS: { value: Decision; label: string; hint: string }[] = [
  { value: "CONFIRM", label: "Confirm", hint: "The learner's scores are right." },
  { value: "ADJUST", label: "Adjust", hint: "Score it differently and say why." },
  { value: "REJECT", label: "Reject", hint: "The work is not accepted." },
];

/** Confirm / Adjust / Reject. The server recomputes everything and enforces the rules; this only previews. */
export function ReviewForm({ requestId, criteria, passingScore }: { requestId: string; criteria: Criterion[]; passingScore: number }) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision>("CONFIRM");
  const [points, setPoints] = useState<Record<string, string>>(() => Object.fromEntries(criteria.map((c) => [c.id, String(c.selfPoints)])));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const max = criteria.reduce((s, c) => s + c.maxPoints, 0);
  const total = criteria.reduce((s, c) => s + Math.min(Math.max(Math.round(Number(points[c.id] ?? 0)) || 0, 0), c.maxPoints), 0);
  const pct = max ? Math.round((total / max) * 100) : 0;
  const needsReason = decision !== "CONFIRM";

  const submit = () => {
    setError("");
    startTransition(async () => {
      const r = await completeReviewAction(requestId, {
        decision,
        reason: reason.trim(),
        scores: decision === "ADJUST" ? criteria.map((c) => ({ criterionId: c.id, points: Math.round(Number(points[c.id])) })) : [],
      });
      if (!r.ok) return setError(r.error);
      toast.success(`Review saved: ${r.decision.toLowerCase()}`);
      router.push("/review");
    });
  };

  return (
    <section className="panel p-5">
      <p className="mono-label">Your decision</p>
      <div role="radiogroup" aria-label="Decision" className="mt-3 grid gap-2 sm:grid-cols-3">
        {DECISIONS.map((d) => (
          <button
            key={d.value} type="button" role="radio" aria-checked={decision === d.value} onClick={() => setDecision(d.value)}
            className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${decision === d.value ? "border-primary/60 bg-primary/10" : "border-border hover:border-primary/40"}`}
          >
            <span className="block text-sm text-foreground">{d.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{d.hint}</span>
          </button>
        ))}
      </div>

      {decision === "ADJUST" ? (
        <ul className="mt-4 divide-y divide-border/60 rounded-xl border border-border">
          {criteria.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <label htmlFor={`rv-${c.id}`} className="min-w-0 text-[13px] text-foreground">
                {c.name} <span className="text-muted-foreground">· self {c.selfPoints}</span>
              </label>
              <span className="flex items-center gap-2">
                <Input id={`rv-${c.id}`} type="number" inputMode="numeric" min={0} max={c.maxPoints} step={1} className="w-20" value={points[c.id] ?? ""} onChange={(e) => setPoints((p) => ({ ...p, [c.id]: e.target.value }))} />
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">/ {c.maxPoints}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {decision === "ADJUST" ? (
        <p aria-live="polite" className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {total}/{max} · {pct}% · {pct >= passingScore ? "pass" : "below pass mark"}
        </p>
      ) : null}

      <label htmlFor="reason" className="mono-label mt-4 block">Reason{needsReason ? " (required, shown to the learner)" : " (optional)"}</label>
      <Textarea id="reason" rows={3} maxLength={2000} className="mt-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What you checked and why you decided this…" />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => startTransition(async () => { await releaseReviewAction(requestId); router.push("/review"); })}>
          Release back to queue
        </Button>
        <Button disabled={pending || (needsReason && reason.trim().length < 10)} onClick={submit}>
          {pending ? "Saving…" : "Save review"}
        </Button>
      </div>
      {error ? <p role="alert" className="mt-3 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
