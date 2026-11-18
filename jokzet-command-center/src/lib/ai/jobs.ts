import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { outcomeFor, WEAKNESS_THRESHOLD } from "@/lib/assessments/service";
import { db } from "@/lib/db";
import { recordBaselineResult } from "@/lib/plan/onboarding";
import { bucketKey, rateLimitHit } from "@/lib/ratelimit";
import { aiConfig, PROMPT_VERSION, SCHEMA_VERSION } from "./config";
import { buildEvidencePackage } from "./package";
import { buildMessages, type MissionContext, type RubricSnapshot } from "./prompt";
import { getProvider, ProviderError } from "./provider";
import { validateAiResult, type AiResult } from "./validate";

type Tx = Prisma.TransactionClient | typeof db;

/** The stale-lock window: a worker that died mid-job loses its claim after this long, and another worker may take over. */
const STALE_LOCK_MS = 10 * 60 * 1000;
const backoffMs = (attempt: number) => Math.min(15 * 60 * 1000, 30_000 * 2 ** Math.max(0, attempt - 1));

export const aiAssessmentEnabled = () => aiConfig().enabled;

export type EnqueueResult = { queued: true; jobId: string } | { queued: false; reason: "DISABLED" | "NO_RUBRIC" | "LEARNER_LIMIT" | "EXISTS" };

/**
 * Creates the assessment job for a submission that has just been stored. One job per submission (unique), so repeating this
 * is safe. The rubric is frozen into the job now, so the AI scores against exactly the version the learner worked to.
 * Called in the same transaction that marks the submission SUBMITTED: the evidence is durable before any provider call.
 */
export async function enqueueAssessmentJob(tx: Tx, userId: string, submissionId: string): Promise<EnqueueResult> {
  const cfg = aiConfig();
  if (!cfg.enabled) return { queued: false, reason: "DISABLED" };
  const existing = await tx.assessmentJob.findUnique({ where: { submissionId }, select: { id: true } });
  if (existing) return { queued: false, reason: "EXISTS" };
  const submission = await tx.submission.findFirst({
    where: { id: submissionId, userId },
    select: { learnerMission: { select: { mission: { select: { rubric: { select: { version: true, passingScore: true, criteria: { orderBy: { position: "asc" }, select: { id: true, position: true, name: true, description: true, maxPoints: true } } } } } } } } },
  });
  const rubric = submission?.learnerMission.mission.rubric;
  if (!rubric || rubric.criteria.length === 0) return { queued: false, reason: "NO_RUBRIC" };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if ((await tx.assessmentJob.count({ where: { userId, createdAt: { gte: since } } })) >= cfg.userDailyLimit) return { queued: false, reason: "LEARNER_LIMIT" };
  const snapshot: RubricSnapshot = { passingScore: rubric.passingScore, criteria: rubric.criteria };
  const job = await tx.assessmentJob.create({
    data: { userId, submissionId, rubricVersion: rubric.version, rubricSnapshot: snapshot as unknown as Prisma.InputJsonValue, provider: getProvider().name },
  });
  return { queued: true, jobId: job.id };
}

type Outcome = "SKIPPED" | "COMPLETE" | "ESCALATED" | "RETRY";

async function escalate(jobId: string, workerId: string, escalation: string, errorCode?: string): Promise<Outcome> {
  await db.assessmentJob.updateMany({ where: { id: jobId, lockedBy: workerId }, data: { status: "NEEDS_HUMAN_REVIEW", escalation, errorCode: errorCode ?? null, lockedAt: null, lockedBy: null } });
  return "ESCALATED";
}

async function retryOrEscalate(jobId: string, workerId: string, attempts: number, code: string, retryable: boolean): Promise<Outcome> {
  if (retryable && attempts < aiConfig().maxAttempts) {
    await db.assessmentJob.updateMany({ where: { id: jobId, lockedBy: workerId }, data: { status: "RETRY_PENDING", errorCode: code, nextAttemptAt: new Date(Date.now() + backoffMs(attempts)), lockedAt: null, lockedBy: null } });
    return "RETRY";
  }
  return escalate(jobId, workerId, retryable ? "AI_UNAVAILABLE" : "AI_NOT_ABLE_TO_ASSESS", code);
}

/**
 * Runs one job. Safe to call twice at once: only the caller that wins the claim does any work; the other returns SKIPPED.
 * Never invents a score: every failure ends in a retry or a human review, with a short error code and no provider text.
 */
export async function processAssessmentJob(jobId: string, now: Date = new Date()): Promise<Outcome> {
  const cfg = aiConfig();
  if (!cfg.enabled) return "SKIPPED";
  const workerId = randomUUID();
  const stale = new Date(now.getTime() - STALE_LOCK_MS);
  const claimed = await db.assessmentJob.updateMany({
    where: {
      id: jobId,
      OR: [
        { status: { in: ["QUEUED", "RETRY_PENDING"] }, nextAttemptAt: { lte: now } },
        { status: { in: ["REVIEWING_EVIDENCE", "AI_IN_PROGRESS"] }, lockedAt: { lt: stale } }, // a worker died mid-job
      ],
    },
    data: { status: "REVIEWING_EVIDENCE", lockedAt: now, lockedBy: workerId, attempts: { increment: 1 }, errorCode: null },
  });
  if (claimed.count === 0) return "SKIPPED";

  const job = await db.assessmentJob.findUniqueOrThrow({ where: { id: jobId } });
  const budget = await rateLimitHit(bucketKey("ai:global", "day"), { limit: cfg.globalDailyLimit, windowSeconds: 24 * 60 * 60 });
  if (!budget.ok) {
    // The Academy-wide daily allowance is used up: wait, without spending an attempt.
    await db.assessmentJob.updateMany({ where: { id: jobId, lockedBy: workerId }, data: { status: "RETRY_PENDING", errorCode: "DAILY_LIMIT", attempts: { decrement: 1 }, nextAttemptAt: new Date(now.getTime() + 60 * 60 * 1000), lockedAt: null, lockedBy: null } });
    return "RETRY";
  }

  const rubric = job.rubricSnapshot as unknown as RubricSnapshot;
  const submission = await db.submission.findFirst({
    where: { id: job.submissionId, userId: job.userId, status: "SUBMITTED" },
    select: { learnerMission: { select: { mission: { select: { title: true, objective: true, submissionRequirements: true } } } } },
  });
  if (!submission) return escalate(jobId, workerId, "SUBMISSION_CHANGED", "SUBMISSION_CHANGED"); // withdrawn, assessed another way, or gone

  const provider = getProvider();
  const model = cfg.assessmentModel;
  const pkg = await buildEvidencePackage(job.userId, job.submissionId, { vision: provider.supportsImages(model) });
  if (!pkg) return escalate(jobId, workerId, "NO_EVIDENCE_PACKAGE", "NO_EVIDENCE_PACKAGE");
  const hasAnswer = pkg.items.some((i) => i.kind === "ANSWER");
  if (pkg.inspectable === 0 && !hasAnswer) return escalate(jobId, workerId, "NO_INSPECTABLE_EVIDENCE", "NO_INSPECTABLE_EVIDENCE");

  const textSize = pkg.items.reduce((n, i) => n + (i.kind === "TEXT" || i.kind === "ANSWER" ? i.text.length : 0), 0);
  const chosen = cfg.advancedModel && pkg.images.length === 0 && textSize > 60_000 ? cfg.advancedModel : model;
  const ctx: MissionContext = { title: submission.learnerMission.mission.title, objective: submission.learnerMission.mission.objective ?? "", submissionRequirements: submission.learnerMission.mission.submissionRequirements ?? "" };

  await db.assessmentJob.updateMany({ where: { id: jobId, lockedBy: workerId }, data: { status: "AI_IN_PROGRESS", model: chosen, promptVersion: PROMPT_VERSION, schemaVersion: SCHEMA_VERSION } });

  let out;
  try {
    out = await provider.assess({ model: chosen, messages: buildMessages(ctx, rubric, pkg), maxOutputTokens: cfg.maxOutputTokens, timeoutMs: cfg.timeoutMs });
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : "NETWORK";
    return retryOrEscalate(jobId, workerId, job.attempts, code, error instanceof ProviderError ? error.retryable : true);
  }

  const checked = validateAiResult(out.content, rubric, pkg.refs);
  if (!checked.ok) return retryOrEscalate(jobId, workerId, job.attempts, checked.reason, true); // malformed or contradictory output: try again, then a human

  const lowConfidence = checked.result.confidence < cfg.minConfidence;
  const noEvidenceBeyondLinks = pkg.inspectable === 0 && pkg.links.length > 0;
  const escalation = lowConfidence ? "LOW_CONFIDENCE" : noEvidenceBeyondLinks ? "LINKS_NOT_INSPECTED" : null;

  return persistResult(job.id, workerId, job.userId, job.submissionId, rubric, checked.result, { totalPoints: checked.totalPoints, maxPoints: checked.maxPoints, percentage: checked.percentage }, out, chosen, escalation);
}

async function persistResult(
  jobId: string, workerId: string, userId: string, submissionId: string, rubric: RubricSnapshot, r: AiResult,
  score: { totalPoints: number; maxPoints: number; percentage: number },
  out: { model: string; tokensIn: number | null; tokensOut: number | null }, chosen: string, escalation: string | null,
): Promise<Outcome> {
  const now = new Date();
  return db.$transaction(async (tx): Promise<Outcome> => {
    // Only the worker that holds the claim may write, and only once: the unique submission and the claim check make a
    // second worker, a retry or a crash-and-resume unable to create a second assessment, XP or review.
    const job = await tx.assessmentJob.findUnique({ where: { id: jobId } });
    if (!job || job.lockedBy !== workerId || job.status !== "AI_IN_PROGRESS" || job.assessmentId) return "SKIPPED";
    if (await tx.assessment.findUnique({ where: { submissionId }, select: { id: true } })) return "SKIPPED";
    const submission = await tx.submission.findFirst({
      where: { id: submissionId, userId, status: "SUBMITTED" },
      select: { attempt: true, learnerMission: { select: { id: true, startedAt: true, mission: { select: { role: true, durationMinutes: true, rubric: { select: { id: true } } } } } } },
    });
    const rubricRow = submission?.learnerMission.mission.rubric;
    if (!submission || !rubricRow) return "SKIPPED";

    const needsReview = !!escalation && submission.learnerMission.mission.role !== "BASELINE"; // a baseline is placement only and is never queued for review
    const byId = new Map(rubric.criteria.map((c) => [c.id, c]));
    const outcome = outcomeFor(score.percentage, rubric.passingScore);
    const weak = r.criteria.filter((c) => c.score < (byId.get(c.criterionId)!.maxPoints * WEAKNESS_THRESHOLD));
    const assessment = await tx.assessment.create({
      data: {
        userId, submissionId, rubricId: rubricRow.id, assessorId: null, assessorKind: "AUTOMATED", status: needsReview ? "PENDING_REVIEW" : "AI_ASSESSED",
        rubricVersion: job.rubricVersion, totalPoints: score.totalPoints, maxPoints: score.maxPoints, percentage: score.percentage, outcome, weaknesses: weak.map((c) => byId.get(c.criterionId)!.name), assessedAt: now,
        scores: { create: r.criteria.map((c) => ({ criterionId: c.criterionId, points: c.score, comment: c.feedback, criterionName: byId.get(c.criterionId)!.name, maxPoints: byId.get(c.criterionId)!.maxPoints })) },
      },
    });
    if (outcome !== "PASS") {
      await tx.feedback.createMany({ data: weak.map((c) => ({ assessmentId: assessment.id, authorId: userId, kind: "CORRECTION" as const, body: `${byId.get(c.criterionId)!.name}: ${c.feedback}` })) });
    }
    await tx.submission.update({ where: { id: submissionId }, data: { status: "ASSESSED" } });
    // Formative progress only, exactly like a self-assessment: no XP, no skills. Official credit needs a reviewer's confirmation.
    const lm = submission.learnerMission;
    if (outcome === "PASS") await tx.learnerMission.update({ where: { id: lm.id }, data: { status: "PASSED", completedAt: now, startedAt: lm.startedAt ?? now } });
    else await tx.learnerMission.update({ where: { id: lm.id }, data: { status: "NEEDS_REVISION" } });
    if (lm.mission.role === "BASELINE") await recordBaselineResult(tx, userId, lm.id, score.percentage);
    await tx.activityRecord.create({
      data: { userId, type: outcome === "PASS" ? "ASSESSMENT_PASSED" : "ASSESSMENT_REVISE", entityType: "Assessment", entityId: assessment.id, minutes: outcome === "PASS" ? lm.mission.durationMinutes : null, occurredAt: now, metadata: { percentage: score.percentage, attempt: submission.attempt, by: "AI" } },
    });
    if (needsReview) await tx.reviewRequest.create({ data: { assessmentId: assessment.id, userId } });
    await tx.assessmentJob.update({
      where: { id: jobId },
      data: {
        status: escalation ? "NEEDS_HUMAN_REVIEW" : "AI_COMPLETE", escalation, assessmentId: assessment.id, confidence: r.confidence, model: out.model || chosen, tokensIn: out.tokensIn, tokensOut: out.tokensOut,
        result: { summary: r.summary, strengths: r.strengths, improvements: r.improvements, limitations: r.limitations, nextSteps: r.nextSteps, criteria: r.criteria.map((c) => ({ criterionId: c.criterionId, evidenceRefs: c.evidenceRefs })) } as unknown as Prisma.InputJsonValue,
        lockedAt: null, lockedBy: null, errorCode: null,
      },
    });
    return escalation ? "ESCALATED" : "COMPLETE";
  });
}

/** Picks up jobs that are due (queued, waiting to retry, or abandoned by a crashed worker). Called by the cron endpoint. */
export async function processDueAssessmentJobs(limit = 5, now: Date = new Date()): Promise<{ attempted: number; complete: number; escalated: number; retry: number }> {
  const stats = { attempted: 0, complete: 0, escalated: 0, retry: 0 };
  if (!aiConfig().enabled) return stats;
  const stale = new Date(now.getTime() - STALE_LOCK_MS);
  const due = await db.assessmentJob.findMany({
    where: { OR: [{ status: { in: ["QUEUED", "RETRY_PENDING"] }, nextAttemptAt: { lte: now } }, { status: { in: ["REVIEWING_EVIDENCE", "AI_IN_PROGRESS"] }, lockedAt: { lt: stale } }] },
    orderBy: { nextAttemptAt: "asc" }, take: limit, select: { id: true },
  });
  for (const j of due) {
    const o = await processAssessmentJob(j.id, now);
    if (o === "SKIPPED") continue;
    stats.attempted += 1;
    if (o === "COMPLETE") stats.complete += 1;
    else if (o === "ESCALATED") stats.escalated += 1;
    else stats.retry += 1;
  }
  return stats;
}
