import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { infoFor } from "@/lib/plan/programme-info";

type Client = Prisma.TransactionClient | typeof db;

/** A live enrolment is one the learner is taking (or has paused): at most one per learner and course (partial unique index). */
export const LIVE_STATUSES = ["ACTIVE", "PAUSED"] as const;
/** What the Departments area shows: live and finished courses. A withdrawn course is history, not shown. */
export const VISIBLE_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED"] as const;

/**
 * Which departments this learner may see in their learning area. Derived on the server from the signed-in learner's own
 * enrolments, never from anything the browser sends.
 *  - A personalised learner sees exactly the courses they are enrolled in.
 *  - The original fixed programme (LEGACY mode, or an account with no profile) is built around all nine departments, so it
 *    keeps showing them: `null` means "no restriction".
 */
export async function visibleDepartmentIds(userId: string, client: Client = db): Promise<string[] | null> {
  const profile = await client.profile.findUnique({ where: { userId }, select: { learnerMode: true } });
  if (!profile || profile.learnerMode !== "PERSONALISED") return null;
  const rows = await client.courseEnrolment.findMany({ where: { userId, status: { in: [...VISIBLE_STATUSES] } }, select: { departmentId: true } });
  return [...new Set(rows.map((r) => r.departmentId))];
}

/** Enrols the learner in each of the given departments unless they already have a live enrolment there. Safe to repeat. */
export async function ensureEnrolments(tx: Prisma.TransactionClient, userId: string, departmentIds: string[], requestKey?: string): Promise<number> {
  let created = 0;
  for (const departmentId of new Set(departmentIds)) {
    const existing = await tx.courseEnrolment.findFirst({ where: { userId, departmentId, status: { in: [...LIVE_STATUSES] } }, select: { id: true } });
    if (existing) continue;
    await tx.courseEnrolment.create({ data: { userId, departmentId, status: "ACTIVE", requestKey: requestKey && departmentIds.length === 1 ? requestKey : undefined } });
    created += 1;
  }
  return created;
}

export type EnrolmentView = { id: string; departmentCode: string; departmentName: string; status: "ACTIVE" | "PAUSED" | "COMPLETED"; enrolledAt: string };

export async function listEnrolments(userId: string): Promise<EnrolmentView[]> {
  const rows = await db.courseEnrolment.findMany({
    where: { userId, status: { in: [...VISIBLE_STATUSES] } },
    include: { department: { select: { code: true, name: true, sortOrder: true } } },
    orderBy: { enrolledAt: "asc" },
  });
  return rows.map((r) => ({ id: r.id, departmentCode: r.department.code, departmentName: r.department.name, status: r.status as EnrolmentView["status"], enrolledAt: r.enrolledAt.toISOString().slice(0, 10) }));
}

export type CourseOffer = {
  code: string;
  name: string;
  description: string;
  outcomes: string[];
  lessons: number;
  /** Published lessons that already have an approved WATCH resource. Reported honestly: none until a reviewer approves some. */
  lessonsWithApprovedResource: number;
  resourcesComplete: boolean;
};

/**
 * Courses the learner can add: published (approved) curriculum only, minus courses they already have. This is the catalogue,
 * not the learner's enrolled list. A department with no published lesson is never offered.
 */
export async function listCatalogue(userId: string): Promise<CourseOffer[]> {
  const [departments, enrolled, lessons] = await Promise.all([
    db.department.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true, summary: true } }),
    db.courseEnrolment.findMany({ where: { userId, status: { in: [...VISIBLE_STATUSES] } }, select: { departmentId: true } }),
    db.mission.findMany({
      where: { createdById: null, isPublished: true, category: "CURRICULUM_MISSION", role: "LESSON" },
      select: { id: true, departmentId: true, missionResources: { where: { resource: { status: "APPROVED" } }, select: { resourceId: true }, take: 1 } },
    }),
  ]);
  const have = new Set(enrolled.map((e) => e.departmentId));
  const out: CourseOffer[] = [];
  for (const d of departments) {
    if (have.has(d.id)) continue;
    const mine = lessons.filter((l) => l.departmentId === d.id);
    if (mine.length === 0) continue;
    const withResource = mine.filter((l) => l.missionResources.length > 0).length;
    const info = infoFor(d.code);
    out.push({ code: d.code, name: d.name, description: info.description || d.summary || "", outcomes: info.outcomes, lessons: mine.length, lessonsWithApprovedResource: withResource, resourcesComplete: withResource === mine.length });
  }
  return out;
}
