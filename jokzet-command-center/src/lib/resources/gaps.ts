import { db } from "@/lib/db";

/**
 * Content gaps: published curriculum missions that have no APPROVED primary learning resource. A learner who opens such a mission
 * or its assessment sees a plain "not available yet" notice (never a made-up substitute); this list is what authorised staff use to
 * decide which resource to find and approve next. It is computed from the data every time, so it cannot go stale.
 */
export type ContentGap = { code: string; title: string; departmentCode: string; departmentName: string; level: number | null; hasSupplementary: boolean };

export async function listContentGaps(): Promise<ContentGap[]> {
  const missions = await db.mission.findMany({
    where: { createdById: null, isPublished: true, category: "CURRICULUM_MISSION", role: { in: ["LESSON", "CHECKPOINT"] } },
    select: {
      code: true, title: true, level: { select: { number: true } }, department: { select: { code: true, name: true, sortOrder: true } },
      missionResources: { where: { resource: { status: "APPROVED" } }, select: { role: true } },
    },
    orderBy: [{ department: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  return missions
    .filter((m) => m.code && !m.missionResources.some((r) => r.role === "PRIMARY"))
    .map((m) => ({
      code: m.code!, title: m.title, departmentCode: m.department.code, departmentName: m.department.name, level: m.level?.number ?? null,
      hasSupplementary: m.missionResources.length > 0,
    }));
}
