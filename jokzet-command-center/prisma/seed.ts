import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type MissionPhase } from "../src/generated/prisma/client";
import { DEPARTMENTS } from "../src/lib/departments";
import { LEVEL0, PASSING_SCORE } from "./curriculum/level0";
import { archiveRetired, ensurePlaceholderResource, syncRubric } from "./curriculum/sync";
import { assertValidCurriculum } from "./curriculum/validate";
import { assertValidResources } from "./curriculum/resource-validate";
import { syncResourceCatalogue } from "./curriculum/resource-sync";
import { MISSION_RESOURCES, RESOURCES } from "./curriculum/resources";

/**
 * Idempotent and NON-DESTRUCTIVE seed: safe to run repeatedly and on a database that already holds learner data.
 *  - The whole curriculum is validated first; one bad mission aborts the run before anything is written.
 *  - Curriculum rows are upserted by stable keys; learner progress rows are never touched.
 *  - Resources are never deleted: a placeholder is created only when a mission has none (so a link that was added and
 *    approved later survives a re-seed). No learning URLs are invented: placeholders carry url = null.
 *  - Rubrics are versioned: if criteria text, points, order or the passing score change, the rubric version is bumped
 *    (assessments store the version and a snapshot of each criterion, so past scores keep their meaning). Removing
 *    criteria that already have scores is refused.
 *  - Missions that disappear from the curriculum files are archived, never deleted.
 */

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  assertValidCurriculum(LEVEL0);
  assertValidResources(RESOURCES, MISSION_RESOURCES, new Set(LEVEL0.flatMap((spec) => spec.missions.map((m) => m.code))));
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  let rubricBumps = 0;

  try {
    for (const [index, d] of DEPARTMENTS.entries()) {
      const department = await prisma.department.upsert({
        where: { code: d.code },
        update: { name: d.name, icon: d.icon, color: d.color, sortOrder: index },
        create: { code: d.code, name: d.name, icon: d.icon, color: d.color, sortOrder: index },
      });
      const path = await prisma.learningPath.upsert({
        where: { departmentId_title: { departmentId: department.id, title: `${d.name} roadmap` } },
        update: {},
        create: { departmentId: department.id, title: `${d.name} roadmap` },
      });
      await prisma.level.upsert({
        where: { learningPathId_number: { learningPathId: path.id, number: 0 } },
        update: { title: "Level 0: Foundations" },
        create: { learningPathId: path.id, number: 0, title: "Level 0: Foundations" },
      });
    }

    let missionCount = 0;
    for (const spec of LEVEL0) {
      const department = await prisma.department.findUniqueOrThrow({ where: { code: spec.code } });
      const level = await prisma.level.findFirstOrThrow({
        where: { number: 0, learningPath: { departmentId: department.id } },
      });
      await prisma.level.update({ where: { id: level.id }, data: { milestone: spec.milestone } });

      const skillIds = new Map<string, string>();
      for (const [name, description] of spec.skills) {
        const skill = await prisma.skill.upsert({
          where: { departmentId_name: { departmentId: department.id, name } },
          update: { description, levelId: level.id },
          create: { departmentId: department.id, levelId: level.id, name, description },
        });
        skillIds.set(name, skill.id);
      }

      for (const [order, m] of spec.missions.entries()) {
        const data = {
          departmentId: department.id,
          levelId: level.id,
          title: m.title,
          objective: m.objective,
          durationMinutes: m.minutes,
          kind: m.kind as never,
          evidenceType: m.evidence as never,
          role: m.role ?? ("LESSON" as const),
          xpReward: m.xp,
          requiredTools: m.tools,
          experimentChallenge: m.experiment,
          submissionRequirements: m.show,
          remediation: m.remediation,
          sortOrder: order,
          status: "PUBLISHED" as const, // validated above; isPublished stays in sync (database CHECK)
          isPublished: true,
        };
        const mission = await prisma.mission.upsert({
          where: { code: m.code },
          update: data,
          create: { code: m.code, ...data },
        });

        // Steps: WATCH → DO → EXPERIMENT → SHOW (upsert by position, then drop any extras).
        const steps: { phase: MissionPhase; title: string; instructions: string }[] = [
          ...m.watch.map((t) => ({ phase: "WATCH" as const, title: "Watch the demonstration", instructions: t })),
          ...m.doSteps.map((t, i) => ({ phase: "DO" as const, title: `Do: step ${i + 1}`, instructions: t })),
          { phase: "EXPERIMENT", title: "Experiment", instructions: m.experiment },
          { phase: "SHOW", title: "Show your work", instructions: m.show },
        ];
        for (const [i, step] of steps.entries()) {
          await prisma.missionStep.upsert({
            where: { missionId_position: { missionId: mission.id, position: i + 1 } },
            update: step,
            create: { missionId: mission.id, position: i + 1, ...step },
          });
        }
        await prisma.missionStep.deleteMany({ where: { missionId: mission.id, position: { gt: steps.length } } });

        // Resource placeholder: only when the mission has none. Never deleted or overwritten (see ensurePlaceholderResource).
        await ensurePlaceholderResource(prisma, mission.id);

        // Rubric: versioned and safe (see syncRubric): a change bumps the version; scored criteria are never removed.
        if (await syncRubric(prisma, mission.id, m.code, { passingScore: PASSING_SCORE, rubric: m.rubric })) rubricBumps += 1;

        // Skills: add what is missing, remove only what the file no longer lists (no delete-and-recreate churn).
        const wanted = m.skills.map((name) => {
          const skillId = skillIds.get(name);
          if (!skillId) throw new Error(`${m.code}: unknown skill "${name}"`);
          return skillId;
        });
        const current = await prisma.missionSkill.findMany({ where: { missionId: mission.id }, select: { skillId: true } });
        const currentIds = new Set(current.map((c) => c.skillId));
        const stale = [...currentIds].filter((id) => !wanted.includes(id));
        if (stale.length) await prisma.missionSkill.deleteMany({ where: { missionId: mission.id, skillId: { in: stale } } });
        const missing = wanted.filter((id) => !currentIds.has(id));
        if (missing.length) await prisma.missionSkill.createMany({ data: missing.map((skillId) => ({ missionId: mission.id, skillId })), skipDuplicates: true });
        missionCount += 1;
      }
    }

    // Curriculum missions that are no longer in the files are archived (kept for history), never deleted.
    const codes = LEVEL0.flatMap((spec) => spec.missions.map((m) => m.code));
    const archived = { count: await archiveRetired(prisma, codes) };

    // Approved WATCH resources (content-as-code). The catalogue file is empty until a reviewer has verified real links.
    const catalogue = await syncResourceCatalogue(prisma, RESOURCES, MISSION_RESOURCES);

    const [departments, levels, skills, missions] = await Promise.all([
      prisma.department.count(),
      prisma.level.count(),
      prisma.skill.count(),
      prisma.mission.count({ where: { createdById: null } }),
    ]);
    console.log(`Seed complete: ${departments} departments, ${levels} levels, ${skills} skills, ${missions} curriculum missions (${missionCount} upserted, ${rubricBumps} rubric version bump(s), ${archived.count} archived; resource catalogue: ${catalogue.resources} resources, ${catalogue.links} links, ${catalogue.archived} archived).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
