import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/**
 * The learner directory for Academy Admins (support and operations). It lists who has an account and where they are in the
 * Academy: name, email, when they joined, onboarding state, courses, last recorded activity and counts. It deliberately holds no
 * evidence, submissions' content, scores, feedback or notes: those stay with the reviewers who are scoped to them.
 * The acting account is re-read and must be an ADMIN right now.
 */
export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
export const PAGE_SIZE = 25;
export const ACTIVE_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

export const queryShape = z.object({
  q: z.string().trim().max(80).optional(),
  filter: z.enum(["all", "active", "inactive", "onboarding"]).optional(),
  course: z.string().trim().toLowerCase().max(40).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});
export type LearnerQuery = z.infer<typeof queryShape>;

export type LearnerRow = {
  email: string; displayName: string; joined: Date; onboarding: string; mode: string; courses: string[]; lastActivity: Date | null; passed: number; submitted: number; active: boolean;
};
export type LearnerPage = { rows: LearnerRow[]; total: number; page: number; pages: number; departments: { code: string; name: string }[]; query: { q: string; filter: string; course: string } };

const clean = (s: string | undefined) => (s ?? "").replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

export async function listLearners(actorId: string, input: unknown, now: Date = new Date()): Promise<Result<{ data: LearnerPage }>> {
  const a = await db.user.findUnique({ where: { id: actorId }, select: { role: true } });
  if (a?.role !== "ADMIN") return { ok: false, error: "Only an Academy Admin can open the learner directory." };
  const parsed = queryShape.safeParse(input ?? {});
  const p = parsed.success ? parsed.data : {};
  const q = clean(p.q);
  const filter = p.filter ?? "all";
  const course = p.course ?? "";
  const since = new Date(now.getTime() - ACTIVE_DAYS * DAY);

  // Each condition stands alone and they are all required, so a search and a filter never replace one another.
  const conditions: Prisma.UserWhereInput[] = [{ role: "LEARNER" }];
  if (q.length >= 2) conditions.push({ OR: [{ email: { contains: q, mode: "insensitive" } }, { profile: { displayName: { contains: q, mode: "insensitive" } } }] });
  if (filter === "active") conditions.push({ activity: { some: { occurredAt: { gte: since } } } });
  if (filter === "inactive") conditions.push({ activity: { none: { occurredAt: { gte: since } } } });
  if (filter === "onboarding") conditions.push({ OR: [{ profile: null }, { profile: { onboardingStatus: { not: "COMPLETE" } } }] });
  if (course) conditions.push({ courseEnrolments: { some: { department: { code: course }, status: { in: ["ACTIVE", "PAUSED"] } } } });
  const finalWhere: Prisma.UserWhereInput = { AND: conditions };

  const total = await db.user.count({ where: finalWhere });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(p.page ?? 1, pages);
  const users = await db.user.findMany({
    where: finalWhere, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    select: {
      id: true, email: true, createdAt: true,
      profile: { select: { displayName: true, onboardingStatus: true, learnerMode: true } },
      courseEnrolments: { where: { status: { in: ["ACTIVE", "PAUSED"] } }, select: { department: { select: { name: true } } } },
      _count: { select: { learnerMissions: { where: { status: "PASSED" } }, submissions: { where: { status: { in: ["SUBMITTED", "ASSESSED"] } } } } },
    },
  });
  const last = await db.activityRecord.groupBy({ by: ["userId"], where: { userId: { in: users.map((u) => u.id) } }, _max: { occurredAt: true } });
  const departments = await db.department.findMany({ select: { code: true, name: true }, orderBy: { sortOrder: "asc" } });

  return {
    ok: true,
    data: {
      total, page, pages, departments, query: { q, filter, course },
      rows: users.map((u) => {
        const lastActivity = last.find((l) => l.userId === u.id)?._max.occurredAt ?? null;
        return {
          email: u.email, displayName: u.profile?.displayName ?? "(no profile yet)", joined: u.createdAt, onboarding: u.profile?.onboardingStatus ?? "NOT_STARTED", mode: u.profile?.learnerMode ?? "PERSONALISED",
          courses: u.courseEnrolments.map((e) => e.department.name), lastActivity, passed: u._count.learnerMissions, submitted: u._count.submissions, active: !!lastActivity && lastActivity >= since,
        };
      }),
    },
  };
}
