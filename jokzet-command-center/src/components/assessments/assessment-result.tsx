import { CorrectionsList } from "./corrections-list";

type ResultAssessment = {
  percentage: number;
  totalPoints: number;
  maxPoints: number;
  outcome: "PASS" | "REVISE" | "FAIL";
  weaknesses: string[];
  scores: { id: string; points: number; comment: string | null; criterion: { name: string; maxPoints: number } }[];
  feedback: { id: string; kind: "GENERAL" | "CORRECTION" | "REMEDIATION"; body: string; resolvedAt: Date | null }[];
};

const CHIP = {
  PASS: "border-primary/50 bg-primary/10 text-primary",
  REVISE: "border-destructive/50 bg-destructive/10 text-destructive",
  FAIL: "border-destructive/50 bg-destructive/10 text-destructive",
} as const;

/** Result of an assessment: score, per-criterion points, feedback, remediation and the correction checklist. */
export function AssessmentResult({ assessment }: { assessment: ResultAssessment }) {
  const general = assessment.feedback.filter((f) => f.kind === "GENERAL");
  const corrections = assessment.feedback.filter((f) => f.kind === "CORRECTION");
  const remediation = assessment.feedback.filter((f) => f.kind === "REMEDIATION");

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-5">
        <div>
          <p className="mono-label">Assessment result</p>
          <p className="mt-2 font-display text-3xl tabular-nums leading-none text-foreground">
            {assessment.totalPoints}<span className="text-muted-foreground">/{assessment.maxPoints}</span>
            <span className="ml-3 text-lg text-muted-foreground">{assessment.percentage}%</span>
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${CHIP[assessment.outcome]}`}>
          {assessment.outcome === "PASS" ? "pass" : assessment.outcome === "FAIL" ? "fail" : "revise"}
        </span>
      </header>

      <ul>
        {assessment.scores.map((s) => (
          <li key={s.id} className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3 last:border-0">
            <div className="min-w-0">
              <p className="text-[13px] text-foreground">{s.criterion.name}</p>
              {s.comment ? <p className="mt-0.5 text-xs text-muted-foreground">{s.comment}</p> : null}
            </div>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{s.points}/{s.criterion.maxPoints}</span>
          </li>
        ))}
      </ul>

      {general.length ? (
        <div className="border-t border-border px-5 py-4">
          <p className="mono-label">Feedback</p>
          {general.map((f) => (
            <p key={f.id} className="mt-2 text-[13px] leading-relaxed text-foreground">{f.body}</p>
          ))}
        </div>
      ) : null}

      {corrections.length ? (
        <div className="border-t border-border px-5 py-4">
          <p className="mono-label">Corrections · {corrections.filter((c) => !c.resolvedAt).length} open</p>
          <CorrectionsList items={corrections.map((c) => ({ id: c.id, body: c.body, resolved: c.resolvedAt !== null }))} />
        </div>
      ) : null}

      {remediation.length ? (
        <div className="border-t border-border px-5 py-4">
          <p className="mono-label">Remediation</p>
          {remediation.map((f) => (
            <p key={f.id} className="mt-2 text-[13px] leading-relaxed text-foreground">{f.body}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
