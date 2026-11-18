import { db } from "@/lib/db";

export type JobState = "QUEUED" | "REVIEWING_EVIDENCE" | "AI_IN_PROGRESS" | "AI_COMPLETE" | "NEEDS_HUMAN_REVIEW" | "RETRY_PENDING" | "FAILED";

export type AiJobView = {
  status: JobState;
  /** True while the AI still owns the submission (no score yet). */
  processing: boolean;
  /** True once there is a stored score from the AI. */
  hasResult: boolean;
  label: string;
  detail: string;
  confidencePercent: number | null;
  escalation: string | null;
  summary: string | null;
  strengths: string[];
  improvements: string[];
  limitations: string[];
  nextSteps: string[];
  model: string | null;
};

const LABEL: Record<JobState, { label: string; detail: string }> = {
  QUEUED: { label: "Queued", detail: "Your work has been received and is waiting to be assessed." },
  REVIEWING_EVIDENCE: { label: "Reviewing evidence", detail: "Your evidence is being prepared for assessment." },
  AI_IN_PROGRESS: { label: "AI assessment in progress", detail: "The Academy's AI assessor is scoring your work against the rubric." },
  AI_COMPLETE: { label: "AI assessment complete", detail: "Scored by the Academy's AI assessor. A reviewer has not confirmed it, so it does not award official XP or skills yet." },
  NEEDS_HUMAN_REVIEW: { label: "Needs human review", detail: "A person needs to look at this work before it can be scored or confirmed." },
  RETRY_PENDING: { label: "Retry pending", detail: "The assessment hit a temporary problem and will try again shortly." },
  FAILED: { label: "Failed, awaiting recovery", detail: "The assessment could not be completed. You can score your own work or ask a reviewer." },
};

const WHY: Record<string, string> = {
  LOW_CONFIDENCE: "The AI was not confident enough in this result, so a reviewer will check it.",
  LINKS_NOT_INSPECTED: "Only links were submitted, and links are not opened automatically, so a reviewer will check it.",
  NO_INSPECTABLE_EVIDENCE: "There was nothing the AI could read or see, so a reviewer needs to look at it.",
  AI_UNAVAILABLE: "The AI assessor was not available. A reviewer needs to look at it, or you can score your own work.",
  AI_NOT_ABLE_TO_ASSESS: "The AI assessor could not assess this work. A reviewer needs to look at it, or you can score your own work.",
  SUBMISSION_CHANGED: "This submission changed while it was being assessed.",
};

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** The learner's view of the AI job for one of THEIR submissions (someone else's id gives null). */
export async function getAiJobView(userId: string, submissionId: string): Promise<AiJobView | null> {
  const job = await db.assessmentJob.findFirst({ where: { submissionId, userId } });
  if (!job) return null;
  const status = job.status as JobState;
  const base = LABEL[status];
  const result = (job.result ?? null) as { summary?: unknown; strengths?: unknown; improvements?: unknown; limitations?: unknown; nextSteps?: unknown } | null;
  return {
    status,
    processing: ["QUEUED", "REVIEWING_EVIDENCE", "AI_IN_PROGRESS", "RETRY_PENDING"].includes(status) && !job.assessmentId,
    hasResult: !!job.assessmentId && !!result,
    label: base.label,
    detail: job.escalation ? (WHY[job.escalation] ?? base.detail) : base.detail,
    confidencePercent: job.confidence === null ? null : Math.round(job.confidence * 100),
    escalation: job.escalation,
    summary: typeof result?.summary === "string" ? result.summary : null,
    strengths: strings(result?.strengths),
    improvements: strings(result?.improvements),
    limitations: strings(result?.limitations),
    nextSteps: strings(result?.nextSteps),
    model: job.model,
  };
}
