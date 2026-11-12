import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import { rubricChanged } from "./validate";

export type RubricSpec = { passingScore: number; rubric: [name: string, description: string, points: number][] };

/**
 * Brings one mission's rubric in line with the curriculum file, safely:
 *  - creates it (version 1) when missing;
 *  - when criteria text, points, order or the passing score changed, bumps `version` (assessments store the version
 *    and a snapshot of every criterion they scored, so earlier results keep their meaning);
 *  - removes surplus criteria only if none of them has ever been scored, otherwise refuses and writes nothing.
 * Returns true when the version was bumped.
 */
export async function syncRubric(prisma: PrismaClient, missionId: string, code: string, spec: RubricSpec): Promise<boolean> {
  const existing = await prisma.assessmentRubric.findUnique({
    where: { missionId },
    include: { criteria: { orderBy: { position: "asc" } } },
  });

  // Check before writing anything, so a refusal leaves the rubric exactly as it was.
  if (existing) {
    const surplus = existing.criteria.filter((c) => c.position > spec.rubric.length);
    if (surplus.length) {
      const scored = await prisma.assessmentScore.count({ where: { criterionId: { in: surplus.map((c) => c.id) } } });
      if (scored > 0) throw new Error(`${code}: refusing to remove rubric criteria that already have scores`);
    }
  }

  const rubric = existing ?? (await prisma.assessmentRubric.create({ data: { missionId, passingScore: spec.passingScore, version: 1 } }));
  let bumped = false;
  if (existing && rubricChanged(existing, spec)) {
    await prisma.assessmentRubric.update({ where: { id: rubric.id }, data: { passingScore: spec.passingScore, version: { increment: 1 } } });
    bumped = true;
  }
  for (const [i, [name, description, maxPoints]] of spec.rubric.entries()) {
    await prisma.rubricCriterion.upsert({
      where: { rubricId_position: { rubricId: rubric.id, position: i + 1 } },
      update: { name, description, maxPoints },
      create: { rubricId: rubric.id, position: i + 1, name, description, maxPoints },
    });
  }
  await prisma.rubricCriterion.deleteMany({ where: { rubricId: rubric.id, position: { gt: spec.rubric.length } } });
  return bumped;
}

/**
 * Every mission needs a place for its demonstration, but the seed never invents a link. A placeholder (url = null) is
 * created ONLY when the mission has no resource at all; existing resources are never deleted or overwritten, so a link
 * that was added and approved later survives every re-seed.
 */
export async function ensurePlaceholderResource(prisma: PrismaClient, missionId: string): Promise<boolean> {
  if ((await prisma.resource.count({ where: { missionId } })) > 0) return false;
  await prisma.resource.create({
    data: {
      missionId,
      title: "Demonstration video",
      type: "DEMONSTRATION",
      url: null,
      notes: "Demonstration to be supplied. No link has been verified yet.",
    },
  });
  return true;
}

/**
 * Missions that are no longer in the curriculum files are archived (kept for history), never deleted. `where` scopes
 * what counts as curriculum (default: platform-authored missions).
 */
export async function archiveRetired(
  prisma: PrismaClient,
  keepCodes: string[],
  where: Prisma.MissionWhereInput = { createdById: null },
): Promise<number> {
  const { count } = await prisma.mission.updateMany({
    where: { AND: [where, { code: { notIn: keepCodes } }, { status: { not: "ARCHIVED" } }] },
    data: { status: "ARCHIVED", isPublished: false },
  });
  return count;
}
