import { cache } from "react";
import { aiConfig } from "@/lib/ai/config";
import { db } from "@/lib/db";
import { listContentGaps } from "@/lib/resources/gaps";

/**
 * Everything the Administration Centre dashboard shows. Every figure is an aggregate read from the database at request time:
 * nothing is estimated, no trend is shown unless the stored dates support it, and no learner is named or identifiable.
 * The acting account is re-read and must be an ADMIN right now (the page also checks, this is the second layer).
 */
export type Kpi = { key: string; label: string; value: number; note: string };
export type ActivityEvent = { id: string; kind: "REGISTRATION" | "ENROLMENT" | "SUBMISSION" | "REVIEW" | "RESOURCE" | "ROLE"; text: string; at: Date };
export type Alert = { id: string; level: "info" | "warn" | "bad"; text: string; href?: string };
export type ScheduledItem = { id: string; when: Date; title: string; detail: string; href?: string };
export type AdminOverview = {
  kpis: Kpi[];
  learnerSplit: { active: number; inactive: number; newThisWeek: number; activitiesThisWeek: number };
  programmes: { code: string; name: string; learners: number }[];
  assessments: { submitted: number; passed: number; needsImprovement: number; failed: number; pendingReview: number; failedJobs: number };
  weekly: { label: string; activities: number }[];
  activity: ActivityEvent[];
  alerts: Alert[];
  upcoming: ScheduledItem[];
  generatedAt: Date;
};
export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const DAY = 24 * 60 * 60 * 1000;
/** A learner is "active" if they did something recordable in the last 14 days. */
export const ACTIVE_DAYS = 14;

const startOfWeek = (d: Date) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
};

export async function getAdminOverview(actorId: string, now: Date = new Date()): Promise<Result<{ overview: AdminOverview }>> {
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { role: true } });
  if (actor?.role !== "ADMIN") return { ok: false, error: "Only an Academy Admin can open the Administration Centre." };

  const week = new Date(now.getTime() - 7 * DAY);
  const activeSince = new Date(now.getTime() - ACTIVE_DAYS * DAY);
  const thisMonday = startOfWeek(now);
  const eightWeeksAgo = new Date(thisMonday.getTime() - 7 * 7 * DAY);

  const [
    totalLearners, newLearners, activeRows, enrolments, byDepartment, pendingReview, pendingResources, submitted, outcomes, failedJobs, retryJobs, activitiesWeek, activityRows,
    regs, enrols, subs, closed, approvals, roles, gaps, heartbeat, openReviews,
  ] = await Promise.all([
    db.user.count({ where: { role: "LEARNER" } }),
    db.user.count({ where: { role: "LEARNER", createdAt: { gte: week } } }),
    db.activityRecord.findMany({ where: { occurredAt: { gte: activeSince }, user: { role: "LEARNER" } }, distinct: ["userId"], select: { userId: true } }),
    db.courseEnrolment.count({ where: { status: { in: ["ACTIVE", "PAUSED"] } } }),
    db.courseEnrolment.groupBy({ by: ["departmentId"], where: { status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] } }, _count: { _all: true } }),
    db.reviewRequest.count({ where: { status: { in: ["OPEN", "CLAIMED"] } } }),
    db.learningResource.count({ where: { status: "PENDING_REVIEW" } }),
    db.submission.count({ where: { status: { in: ["SUBMITTED", "ASSESSED"] } } }),
    db.assessment.groupBy({ by: ["outcome"], _count: { _all: true } }),
    db.assessmentJob.count({ where: { status: "NEEDS_HUMAN_REVIEW", assessmentId: null } }),
    db.assessmentJob.findMany({ where: { status: "RETRY_PENDING" }, orderBy: { nextAttemptAt: "asc" }, take: 3, select: { id: true, nextAttemptAt: true, errorCode: true } }),
    db.activityRecord.count({ where: { occurredAt: { gte: week } } }),
    db.activityRecord.findMany({ where: { occurredAt: { gte: eightWeeksAgo } }, select: { occurredAt: true } }),
    db.user.findMany({ where: { role: "LEARNER" }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, createdAt: true } }),
    db.courseEnrolment.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, createdAt: true, department: { select: { name: true } } } }),
    db.submission.findMany({ where: { submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, take: 6, select: { id: true, submittedAt: true, learnerMission: { select: { mission: { select: { title: true } } } } } }),
    db.reviewRequest.findMany({ where: { status: "DONE", closedAt: { not: null } }, orderBy: { closedAt: "desc" }, take: 6, select: { id: true, closedAt: true } }),
    db.learningResource.findMany({ where: { status: "APPROVED", approvedAt: { not: null } }, orderBy: { approvedAt: "desc" }, take: 6, select: { id: true, title: true, approvedAt: true } }),
    db.roleAudit.findMany({ orderBy: { at: "desc" }, take: 6, select: { id: true, action: true, role: true, targetEmail: true, departmentCode: true, at: true } }),
    listContentGaps(),
    db.rateLimitBucket.findFirst({ where: { key: { startsWith: "cron:heartbeat" } }, orderBy: { windowStart: "desc" }, select: { windowStart: true } }),
    db.reviewRequest.findMany({ where: { status: { in: ["OPEN", "CLAIMED"] } }, orderBy: { createdAt: "asc" }, take: 3, select: { id: true, createdAt: true } }),
  ]);

  const departments = await db.department.findMany({ select: { id: true, code: true, name: true, sortOrder: true }, orderBy: { sortOrder: "asc" } });
  const programmes = departments.map((d) => ({ code: d.code, name: d.name, learners: byDepartment.find((b) => b.departmentId === d.id)?._count._all ?? 0 })).filter((p) => p.learners > 0);
  const outcomeCount = (o: string) => outcomes.find((x) => x.outcome === o)?._count._all ?? 0;

  // Recordable activity per week, Monday to Sunday, for the last eight weeks (this week included).
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const from = new Date(thisMonday.getTime() - (7 - i) * 7 * DAY);
    const to = new Date(from.getTime() + 7 * DAY);
    return { label: from.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }), activities: activityRows.filter((r) => r.occurredAt >= from && r.occurredAt < to).length };
  });

  const ROLE_NAME: Record<string, string> = { ADMIN: "Academy Admin", AUTHOR: "Curriculum Manager", REVIEWER: "Assessment Reviewer", LEARNER: "no staff role" };
  const activity: ActivityEvent[] = [
    ...regs.map((r) => ({ id: `u-${r.id}`, kind: "REGISTRATION" as const, text: "New learner registered", at: r.createdAt })),
    ...enrols.map((e) => ({ id: `e-${e.id}`, kind: "ENROLMENT" as const, text: `A learner enrolled in ${e.department.name}`, at: e.createdAt })),
    ...subs.map((s) => ({ id: `s-${s.id}`, kind: "SUBMISSION" as const, text: `Assessment submitted: ${s.learnerMission.mission.title}`, at: s.submittedAt! })),
    ...closed.map((c) => ({ id: `r-${c.id}`, kind: "REVIEW" as const, text: "A reviewer completed an assessment review", at: c.closedAt! })),
    ...approvals.map((a) => ({ id: `a-${a.id}`, kind: "RESOURCE" as const, text: `Resource approved: ${a.title}`, at: a.approvedAt! })),
    ...roles.map((r) => ({
      id: `k-${r.id}`, kind: "ROLE" as const, at: r.at,
      text: r.action === "GRANTED" ? `${ROLE_NAME[r.role ?? ""] ?? r.role} role granted to ${r.targetEmail}` : r.action === "REVOKED" ? `${ROLE_NAME[r.role ?? ""] ?? r.role} role removed from ${r.targetEmail}` : r.action === "SCOPE_ADDED" ? `${r.departmentCode} added to ${r.targetEmail}` : `${r.departmentCode} removed from ${r.targetEmail}`,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 12);

  // Alerts are only things that are true right now, each with where to act.
  const cfg = aiConfig();
  const beat = heartbeat?.windowStart ?? null;
  const alerts: Alert[] = [];
  if (pendingReview) alerts.push({ id: "reviews", level: "info", text: `${pendingReview} assessment${pendingReview === 1 ? "" : "s"} waiting for a reviewer`, href: "/review" });
  if (failedJobs) alerts.push({ id: "jobs", level: "bad", text: `${failedJobs} AI assessment${failedJobs === 1 ? "" : "s"} stopped on a provider problem`, href: "/review" });
  if (retryJobs.length) alerts.push({ id: "retry", level: "warn", text: `${retryJobs.length} AI assessment${retryJobs.length === 1 ? " is" : "s are"} waiting to retry` });
  if (gaps.length) alerts.push({ id: "gaps", level: "warn", text: `${gaps.length} lesson${gaps.length === 1 ? " has" : "s have"} no approved video or guide`, href: "/admin/curriculum" });
  if (pendingResources) alerts.push({ id: "resources", level: "info", text: `${pendingResources} resource${pendingResources === 1 ? "" : "s"} awaiting review`, href: "/admin/curriculum" });
  if (!cfg.enabled) alerts.push({ id: "ai", level: "info", text: "AI assessment is switched off, so learners assess themselves" });
  if (!beat || now.getTime() - beat.getTime() > 15 * 60 * 1000) alerts.push({ id: "beat", level: "bad", text: beat ? "The scheduler has not reported in the last 15 minutes" : "The scheduler has never reported" });

  const upcoming: ScheduledItem[] = [
    ...retryJobs.map((j) => ({ id: `j-${j.id}`, when: j.nextAttemptAt, title: "AI assessment retry", detail: j.errorCode === "BILLING" || j.errorCode === "AUTH" ? "Waiting for the AI provider account to be fixed" : "Scheduled to try again" })),
    ...openReviews.map((r) => ({ id: `q-${r.id}`, when: r.createdAt, title: "Assessment review waiting", detail: "Waiting since this date", href: "/review" })),
  ].sort((a, b) => a.when.getTime() - b.when.getTime()).slice(0, 5);

  return {
    ok: true,
    overview: {
      kpis: [
        { key: "learners", label: "Total learners", value: totalLearners, note: `${newLearners} joined in the last 7 days` },
        { key: "active", label: "Active learners", value: activeRows.length, note: `active in the last ${ACTIVE_DAYS} days` },
        { key: "pending", label: "Pending assessments", value: pendingReview, note: "waiting for a reviewer" },
        { key: "enrolments", label: "Enrolled programmes", value: enrolments, note: `${programmes.length} programme${programmes.length === 1 ? "" : "s"} with learners` },
        { key: "content", label: "Pending content reviews", value: pendingResources, note: `${gaps.length} lesson${gaps.length === 1 ? "" : "s"} without an approved video` },
      ],
      learnerSplit: { active: activeRows.length, inactive: Math.max(0, totalLearners - activeRows.length), newThisWeek: newLearners, activitiesThisWeek: activitiesWeek },
      programmes,
      assessments: { submitted, passed: outcomeCount("PASS"), needsImprovement: outcomeCount("REVISE"), failed: outcomeCount("FAIL"), pendingReview, failedJobs },
      weekly, activity, alerts, upcoming, generatedAt: now,
    },
  };
}

/** One read per request: the layout (alert count) and the page (everything) share it. */
export const getOverviewForRequest = cache((actorId: string) => getAdminOverview(actorId));
