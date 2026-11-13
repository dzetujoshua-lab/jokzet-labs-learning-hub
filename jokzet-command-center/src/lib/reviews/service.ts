import { z } from "zod";
import type { AssessmentOutcome, CompetencyLevel, ReviewDecision, Prisma } from "@/generated/prisma/client";
import { outcomeFor } from "@/lib/assessments/service";
import type { Role } from "@/lib/auth/sessions";
import { db } from "@/lib/db";
import { secretIssue } from "@/lib/evidence/secrets";
import { adjustDepartmentXp } from "@/lib/missions/service";
import { LIMITS, bucketKey, rateLimitHit } from "@/lib/ratelimit";

/**
 * Human review: a learner's self-assessment can be verified by a reviewer.
 *
 * Rules that this module enforces:
 *  - Only the learner can ask for a review of their own assessment; only a reviewer (or administrator) with the right
 *    scope can claim and complete it; nobody can review their own work (also a database CHECK).
 *  - The learner's self-assessment is never overwritten: the review is a separate, append-only record, and the latest
 *    review is the verified result.
 *  - Only a verified pass can create competency (SkillCompetency) or upgrade skills to the VERIFIED tier. A reviewer who
 *    adjusts or rejects a result that had earned credit takes that credit back; one who upgrades a result grants it.
 *  - Reviewer access to a learner's evidence is request-scoped and logged (see the evidence route).
 */

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export type Actor = { id: string; role: Role; displayName: string };
export const isReviewerRole = (role: Role) => role === "ADMIN" || role === "REVIEWER";

/** Competency level for a verified pass. Only called for percentages at or above the passing score. */
export function competencyLevelFor(percentage: number): CompetencyLevel {
  if (percentage >= 90) return "STRONG";
  if (percentage >= 80) return "WORKING";
  return "BASIC";
}
const RANK: Record<CompetencyLevel, number> = { NONE: 0, BASIC: 1, WORKING: 2, STRONG: 3 };

/** Departments a reviewer may review, or "ALL" for an administrator. Empty for anyone else. */
export async function reviewerScope(actor: Actor): Promise<string[] | "ALL"> {
  if (actor.role === "ADMIN") return "ALL";
  if (actor.role !== "REVIEWER") return [];
  const rows = await db.reviewerScope.findMany({ where: { userId: actor.id }, select: { departmentId: true } });
  return rows.map((r) => r.departmentId);
}

// ── Learner side ──

/** The learner asks for their self-assessment to be verified. Owner-scoped; one open request per assessment. */
export async function requestReview(userId: string, assessmentId: string): Promise<Result> {
  const limit = await rateLimitHit(bucketKey("review:request", userId), LIMITS.reviewRequestUser);
  if (!limit.ok) return fail("You have asked for several reviews recently. Please try again later.");
  return db.$transaction(async (tx) => {
    const assessment = await tx.assessment.findFirst({ where: { id: assessmentId, userId }, include: { reviewRequest: true, rubric: { select: { mission: { select: { role: true } } } } } });
    if (!assessment) return fail("Assessment not found.");
    if (assessment.rubric.mission.role === "BASELINE") return fail("A baseline is a placement exercise and is not reviewed.");
    if (assessment.status !== "SELF_RECORDED") {
      return fail(assessment.status === "PENDING_REVIEW" ? "A review has already been requested." : "This assessment has already been reviewed.");
    }
    if (assessment.reviewRequest && assessment.reviewRequest.status !== "CANCELLED") return fail("A review has already been requested.");
    if (assessment.reviewRequest) {
      await tx.reviewRequest.update({ where: { id: assessment.reviewRequest.id }, data: { status: "OPEN", claimedById: null, claimedAt: null, closedAt: null, createdAt: new Date() } });
    } else {
      await tx.reviewRequest.create({ data: { assessmentId, userId } });
    }
    await tx.assessment.update({ where: { id: assessmentId }, data: { status: "PENDING_REVIEW" } });
    return { ok: true } as const;
  });
}

/** The learner withdraws a request that no reviewer has picked up yet. */
export async function cancelReviewRequest(userId: string, assessmentId: string): Promise<Result> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.reviewRequest.updateMany({ where: { assessmentId, userId, status: "OPEN" }, data: { status: "CANCELLED", closedAt: new Date() } });
    if (count === 0) return fail("This request can no longer be withdrawn.");
    await tx.assessment.updateMany({ where: { id: assessmentId, userId, status: "PENDING_REVIEW" }, data: { status: "SELF_RECORDED" } });
    return { ok: true } as const;
  });
}

export type ReviewState = {
  assessmentId: string;
  status: "SELF_RECORDED" | "PENDING_REVIEW" | "VERIFIED" | "NEEDS_REVISION" | "REJECTED";
  requestStatus: "OPEN" | "CLAIMED" | "DONE" | "CANCELLED" | null;
  latestReview: { reviewerLabel: string; decision: ReviewDecision; reason: string | null; percentage: number; outcome: AssessmentOutcome; at: string } | null;
};

/** What the learner sees about review of one of their own assessments (null for anyone else's). */
export async function getReviewState(userId: string, assessmentId: string): Promise<ReviewState | null> {
  const a = await db.assessment.findFirst({
    where: { id: assessmentId, userId },
    select: { id: true, status: true, reviewRequest: { select: { status: true } }, reviews: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!a) return null;
  const r = a.reviews[0];
  return {
    assessmentId: a.id,
    status: a.status,
    requestStatus: a.reviewRequest?.status ?? null,
    latestReview: r ? { reviewerLabel: r.reviewerLabel, decision: r.decision, reason: r.reason, percentage: r.percentage, outcome: r.outcome, at: r.createdAt.toISOString() } : null,
  };
}

// ── Reviewer side ──

export type QueueItem = {
  id: string;
  learnerName: string;
  missionTitle: string;
  departmentCode: string;
  category: string;
  selfPercentage: number;
  selfOutcome: AssessmentOutcome;
  requestedAt: string;
  status: "OPEN" | "CLAIMED";
  mine: boolean;
};

/** Open requests inside the reviewer's scope (never their own work), plus the ones they have claimed. */
export async function listQueue(actor: Actor): Promise<QueueItem[]> {
  if (!isReviewerRole(actor.role)) return [];
  const scope = await reviewerScope(actor);
  if (scope !== "ALL" && scope.length === 0) return [];
  const inScope: Prisma.ReviewRequestWhereInput = scope === "ALL" ? {} : { assessment: { rubric: { mission: { departmentId: { in: scope } } } } };
  const rows = await db.reviewRequest.findMany({
    where: { AND: [inScope, { OR: [{ status: "OPEN", userId: { not: actor.id } }, { status: "CLAIMED", claimedById: actor.id }] }] },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      user: { select: { profile: { select: { displayName: true } }, email: true } },
      assessment: { select: { percentage: true, outcome: true, rubric: { select: { mission: { select: { title: true, category: true, department: { select: { code: true } } } } } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    learnerName: r.user.profile?.displayName ?? r.user.email,
    missionTitle: r.assessment.rubric.mission.title,
    departmentCode: r.assessment.rubric.mission.department.code,
    category: r.assessment.rubric.mission.category,
    selfPercentage: r.assessment.percentage,
    selfOutcome: r.assessment.outcome,
    requestedAt: r.createdAt.toISOString(),
    status: r.status === "CLAIMED" ? "CLAIMED" : "OPEN",
    mine: r.claimedById === actor.id,
  }));
}

async function authorise(actor: Actor, requestId: string) {
  if (!isReviewerRole(actor.role)) return { ok: false, error: "You do not have access to reviews." } as const;
  const request = await db.reviewRequest.findUnique({
    where: { id: requestId },
    include: { assessment: { select: { rubric: { select: { mission: { select: { departmentId: true } } } } } } },
  });
  // The same answer for "does not exist", "out of scope" and "not yours": nothing about other cases is revealed.
  if (!request) return { ok: false, error: "Review not found." } as const;
  if (request.userId === actor.id) return { ok: false, error: "Review not found." } as const; // never your own work
  const scope = await reviewerScope(actor);
  if (scope !== "ALL" && !scope.includes(request.assessment.rubric.mission.departmentId)) return { ok: false, error: "Review not found." } as const;
  return { ok: true, request } as const;
}

export async function claimRequest(actor: Actor, requestId: string): Promise<Result> {
  const limit = await rateLimitHit(bucketKey("review:act", actor.id), LIMITS.reviewActionReviewer);
  if (!limit.ok) return fail("Please slow down.");
  const auth = await authorise(actor, requestId);
  if (!auth.ok) return fail(auth.error);
  // Atomic: only one reviewer can take an open request.
  const { count } = await db.reviewRequest.updateMany({
    where: { id: requestId, status: "OPEN", userId: { not: actor.id } },
    data: { status: "CLAIMED", claimedById: actor.id, claimedAt: new Date() },
  });
  return count ? { ok: true } : fail("Someone else has already taken this review.");
}

export async function releaseRequest(actor: Actor, requestId: string): Promise<Result> {
  const { count } = await db.reviewRequest.updateMany({
    where: { id: requestId, status: "CLAIMED", claimedById: actor.id },
    data: { status: "OPEN", claimedById: null, claimedAt: null },
  });
  return count ? { ok: true } : fail("You have not claimed this review.");
}

export type ReviewCase = {
  requestId: string;
  assessmentId: string;
  learnerName: string;
  mission: { title: string; objective: string | null; departmentCode: string; category: string; passingScore: number };
  explanation: string | null;
  githubUrl: string | null;
  liveUrl: string | null;
  evidence: { id: string; title: string; kind: string; fileName: string | null; fileKind: string | null; linkUrl: string | null }[];
  criteria: { id: string; name: string; maxPoints: number; selfPoints: number; selfComment: string | null }[];
  selfPercentage: number;
  selfOutcome: AssessmentOutcome;
  priorReviews: { reviewerLabel: string; decision: ReviewDecision; percentage: number; at: string }[];
};

/** Everything a reviewer needs for a request they have claimed. */
export async function getReviewCase(actor: Actor, requestId: string): Promise<ReviewCase | null> {
  const auth = await authorise(actor, requestId);
  if (!auth.ok) return null;
  if (auth.request.status !== "CLAIMED" || auth.request.claimedById !== actor.id) return null;

  const a = await db.assessment.findUnique({
    where: { id: auth.request.assessmentId },
    include: {
      scores: { include: { criterion: { select: { position: true } } }, orderBy: { criterion: { position: "asc" } } },
      rubric: { select: { passingScore: true, mission: { select: { title: true, objective: true, category: true, department: { select: { code: true } } } } } },
      submission: { include: { evidence: { include: { file: { select: { originalName: true, kind: true } } }, orderBy: { createdAt: "asc" } } } },
      reviews: { orderBy: { createdAt: "asc" } },
      user: { select: { email: true, profile: { select: { displayName: true } } } },
    },
  });
  if (!a) return null;
  return {
    requestId,
    assessmentId: a.id,
    learnerName: a.user.profile?.displayName ?? a.user.email,
    mission: { title: a.rubric.mission.title, objective: a.rubric.mission.objective, departmentCode: a.rubric.mission.department.code, category: a.rubric.mission.category, passingScore: a.rubric.passingScore },
    explanation: a.submission.explanation,
    githubUrl: a.submission.githubUrl,
    liveUrl: a.submission.liveUrl,
    evidence: a.submission.evidence.map((e) => ({ id: e.id, title: e.title, kind: e.kind, fileName: e.file?.originalName ?? null, fileKind: e.file?.kind ?? null, linkUrl: e.linkUrl })),
    criteria: a.scores.map((s) => ({ id: s.criterionId, name: s.criterionName ?? "", maxPoints: s.maxPoints ?? 0, selfPoints: s.points, selfComment: s.comment })),
    selfPercentage: a.percentage,
    selfOutcome: a.outcome,
    priorReviews: a.reviews.map((r) => ({ reviewerLabel: r.reviewerLabel, decision: r.decision, percentage: r.percentage, at: r.createdAt.toISOString() })),
  };
}

const text = (max: number) => z.string().trim().max(max);
export const completeSchema = z.object({
  decision: z.enum(["CONFIRM", "ADJUST", "REJECT"]),
  reason: text(2000).default(""),
  scores: z.array(z.object({ criterionId: z.string().min(1).max(64), points: z.number().int().min(0), comment: text(500).optional() })).max(50).default([]),
});
export type CompleteInput = z.input<typeof completeSchema>;

export type CompleteResult = Result<{ outcome: AssessmentOutcome; percentage: number; decision: ReviewDecision; creditChange: "granted" | "revoked" | "none" }>;

/**
 * Finishes a claimed review. CONFIRM keeps the learner's scores as verified; ADJUST replaces them with the reviewer's
 * per-criterion points; REJECT does not accept the work. ADJUST and REJECT need a written reason the learner can read.
 */
export async function completeReview(actor: Actor, requestId: string, input: CompleteInput): Promise<CompleteResult> {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return fail("Check the review and try again.");
  const d = parsed.data;
  if (d.decision !== "CONFIRM" && d.reason.length < 10) return fail("Explain your decision in at least 10 characters so the learner can act on it.");
  const secret = secretIssue([d.reason, ...d.scores.map((s) => s.comment ?? "")].join("\n"));
  if (secret) return fail(secret);

  const limit = await rateLimitHit(bucketKey("review:act", actor.id), LIMITS.reviewActionReviewer);
  if (!limit.ok) return fail("Please slow down.");
  const auth = await authorise(actor, requestId);
  if (!auth.ok) return fail(auth.error);
  if (auth.request.status !== "CLAIMED" || auth.request.claimedById !== actor.id) return fail("Claim this review before completing it.");

  class Stop extends Error {}
  try {
    return await db.$transaction(async (tx): Promise<CompleteResult> => {
      const a = await tx.assessment.findUniqueOrThrow({
        where: { id: auth.request.assessmentId },
        include: {
          scores: true,
          rubric: { select: { passingScore: true, version: true } },
          submission: { select: { id: true, learnerMissionId: true } },
        },
      });
      if (a.status !== "PENDING_REVIEW") throw new Stop("This assessment is not waiting for review.");
      const lm = await tx.learnerMission.findUniqueOrThrow({
        where: { id: a.submission.learnerMissionId },
        include: { mission: { include: { skills: true } } },
      });
      const credited = lm.mission.category === "CURRICULUM_MISSION" && lm.mission.role !== "BASELINE";

      // Work out the verified result.
      let totalPoints = a.totalPoints;
      let maxPoints = a.maxPoints;
      let percentage = a.percentage;
      let outcome: AssessmentOutcome = a.outcome;
      let reviewScores: { criterionId: string; points: number; comment: string | null; criterionName: string; maxPoints: number }[] = a.scores.map((s) => ({
        criterionId: s.criterionId, points: s.points, comment: s.comment, criterionName: s.criterionName ?? "", maxPoints: s.maxPoints ?? 0,
      }));
      if (d.decision === "ADJUST") {
        const byId = new Map(a.scores.map((s) => [s.criterionId, s]));
        const seen = new Set<string>();
        for (const s of d.scores) {
          const base = byId.get(s.criterionId);
          if (!base) throw new Stop("A score refers to a criterion that is not part of this assessment.");
          if (seen.has(s.criterionId)) throw new Stop("Each criterion can be scored only once.");
          if (s.points > (base.maxPoints ?? 0)) throw new Stop(`"${base.criterionName}" is out of ${base.maxPoints} points.`);
          seen.add(s.criterionId);
        }
        if (seen.size !== a.scores.length) throw new Stop("Score every criterion when adjusting.");
        reviewScores = d.scores.map((s) => {
          const base = byId.get(s.criterionId)!;
          return { criterionId: s.criterionId, points: s.points, comment: s.comment ?? null, criterionName: base.criterionName ?? "", maxPoints: base.maxPoints ?? 0 };
        });
        maxPoints = reviewScores.reduce((t, s) => t + s.maxPoints, 0);
        totalPoints = reviewScores.reduce((t, s) => t + s.points, 0);
        percentage = maxPoints ? Math.round((totalPoints / maxPoints) * 100) : 0;
        outcome = outcomeFor(percentage, a.rubric.passingScore);
      } else if (d.decision === "REJECT") {
        totalPoints = 0;
        percentage = 0;
        outcome = "FAIL";
      }

      // Close the request first: only one completion can ever win.
      const closed = await tx.reviewRequest.updateMany({ where: { id: requestId, status: "CLAIMED", claimedById: actor.id }, data: { status: "DONE", closedAt: new Date() } });
      if (closed.count === 0) throw new Stop("This review was already completed or released.");

      const review = await tx.assessmentReview.create({
        data: {
          assessmentId: a.id, userId: a.userId, reviewerId: actor.id, reviewerLabel: actor.displayName, decision: d.decision, reason: d.reason || null,
          rubricVersion: a.rubricVersion, totalPoints, maxPoints, percentage, outcome,
          scores: { create: reviewScores.map((s) => ({ criterionId: s.criterionId, points: s.points, comment: s.comment, criterionName: s.criterionName, maxPoints: s.maxPoints })) },
        },
      });
      if (d.reason) await tx.feedback.create({ data: { assessmentId: a.id, authorId: actor.id, kind: "GENERAL", body: `Reviewer: ${d.reason}` } });

      const verifiedPass = d.decision !== "REJECT" && outcome === "PASS";
      const wasCredited = lm.status === "PASSED"; // the learner's self-assessment passed and earned credit
      let creditChange: "granted" | "revoked" | "none" = "none";

      await tx.assessment.update({
        where: { id: a.id },
        data: { assessorKind: "HUMAN", status: d.decision === "REJECT" ? "REJECTED" : "VERIFIED" },
      });

      const missionSkillIds = lm.mission.skills.map((s) => s.skillId);
      const now = new Date();
      if (verifiedPass) {
        if (!wasCredited) {
          // The reviewer upgraded a result that had not passed.
          await tx.learnerMission.update({ where: { id: lm.id }, data: { status: "PASSED", completedAt: lm.completedAt ?? now } });
          if (credited && lm.xpAwarded === 0) {
            await tx.learnerMission.update({ where: { id: lm.id }, data: { xpAwarded: lm.mission.xpReward } });
            await adjustDepartmentXp(tx, a.userId, lm.mission.departmentId, lm.mission.xpReward);
          }
          if (credited && missionSkillIds.length) {
            await tx.userSkill.createMany({ data: missionSkillIds.map((skillId) => ({ userId: a.userId, skillId, earnedAt: now })), skipDuplicates: true });
          }
          await tx.evidenceItem.updateMany({ where: { submissionId: a.submission.id }, data: { status: "VERIFIED" } });
          creditChange = credited ? "granted" : "none";
        }
        if (credited && missionSkillIds.length) {
          await tx.userSkill.updateMany({ where: { userId: a.userId, skillId: { in: missionSkillIds } }, data: { tier: "VERIFIED" } });
          const level = competencyLevelFor(percentage);
          for (const skillId of missionSkillIds) {
            const existing = await tx.skillCompetency.findUnique({ where: { userId_skillId: { userId: a.userId, skillId } } });
            if (!existing) await tx.skillCompetency.create({ data: { userId: a.userId, skillId, level, source: "ASSESSED", assessmentId: a.id } });
            else if (RANK[level] > RANK[existing.level]) await tx.skillCompetency.update({ where: { id: existing.id }, data: { level, source: "ASSESSED", assessmentId: a.id } });
          }
        }
      } else if (wasCredited) {
        // A pass that earned credit has not been verified: take the credit back, and ask the learner to resubmit.
        await tx.learnerMission.update({ where: { id: lm.id }, data: { status: "NEEDS_REVISION", completedAt: null, xpAwarded: 0 } });
        if (lm.xpAwarded > 0) await adjustDepartmentXp(tx, a.userId, lm.mission.departmentId, -lm.xpAwarded);
        if (credited && missionSkillIds.length) {
          // Remove a skill only if no OTHER passed curriculum mission still teaches it.
          for (const skillId of missionSkillIds) {
            const other = await tx.learnerMission.count({
              where: { userId: a.userId, id: { not: lm.id }, status: "PASSED", mission: { category: "CURRICULUM_MISSION", skills: { some: { skillId } } } },
            });
            if (other === 0) await tx.userSkill.deleteMany({ where: { userId: a.userId, skillId } });
          }
        }
        await tx.skillCompetency.deleteMany({ where: { userId: a.userId, assessmentId: a.id } });
        await tx.evidenceItem.updateMany({ where: { submissionId: a.submission.id }, data: { status: "LOGGED" } });
        creditChange = credited ? "revoked" : "none";
      } else if (d.decision === "REJECT" && lm.status !== "NEEDS_REVISION") {
        await tx.learnerMission.update({ where: { id: lm.id }, data: { status: "NEEDS_REVISION" } });
      }

      await tx.activityRecord.create({
        data: { userId: a.userId, type: "ASSESSMENT_REVIEWED", entityType: "Assessment", entityId: a.id, metadata: { decision: d.decision, outcome, percentage, reviewId: review.id } },
      });
      return { ok: true, outcome, percentage, decision: d.decision, creditChange };
    });
  } catch (error) {
    if (error instanceof Stop) return fail(error.message);
    throw error;
  }
}

/**
 * May this reviewer open evidence for this request? The request must be claimed by them, in their scope and not their own
 * work, and the evidence must belong to the submission being reviewed. Returns the file to stream, or null.
 */
export async function authoriseEvidenceAccess(actor: Actor, requestId: string, evidenceId: string) {
  const auth = await authorise(actor, requestId);
  if (!auth.ok) return null;
  const { request } = auth;
  if (request.status !== "CLAIMED" || request.claimedById !== actor.id) return null;
  const assessment = await db.assessment.findUnique({ where: { id: request.assessmentId }, select: { submissionId: true } });
  if (!assessment) return null;
  const item = await db.evidenceItem.findFirst({
    where: { id: evidenceId, userId: request.userId, submissionId: assessment.submissionId, fileId: { not: null } },
    include: { file: true },
  });
  if (!item?.file) return null;
  return { file: item.file, learnerId: request.userId };
}

export async function logEvidenceAccess(actor: Actor, requestId: string, evidenceId: string, learnerId: string): Promise<void> {
  await db.evidenceAccessLog.create({ data: { evidenceId, reviewerId: actor.id, reviewRequestId: requestId, learnerId, action: "VIEW_FILE" } });
}
