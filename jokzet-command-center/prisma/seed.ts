import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type MissionPhase } from "../src/generated/prisma/client";
import { DEPARTMENTS } from "../src/lib/departments";
import { LEVEL0, PASSING_SCORE, type MissionSpec } from "./curriculum/level0";

/**
 * Idempotent seed: safe to run repeatedly and safe on a database that already holds learner data.
 * Curriculum rows are upserted by stable keys; learner progress rows are never touched.
 * No learning URLs are invented: demonstration resources carry url = null.
 */

function validate(mission: MissionSpec) {
  const total = mission.rubric.reduce((sum, [, , points]) => sum + points, 0);
  if (total !== 100) throw new Error(`${mission.code}: rubric points sum to ${total}, expected 100`);
  if (!mission.watch.length || !mission.doSteps.length) throw new Error(`${mission.code}: missing WATCH/DO steps`);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

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
        validate(m);
        const data = {
          departmentId: department.id,
          levelId: level.id,
          title: m.title,
          objective: m.objective,
          durationMinutes: m.minutes,
          kind: m.kind as never,
          evidenceType: m.evidence as never,
          xpReward: m.xp,
          requiredTools: m.tools,
          experimentChallenge: m.experiment,
          submissionRequirements: m.show,
          remediation: m.remediation,
          sortOrder: order,
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

        // Resource placeholder: a demonstration is required but no link has been supplied yet.
        await prisma.resource.deleteMany({ where: { missionId: mission.id } });
        await prisma.resource.create({
          data: {
            missionId: mission.id,
            title: "Demonstration video",
            type: "DEMONSTRATION",
            url: null,
            notes: "Demonstration to be supplied. No link has been verified yet.",
          },
        });

        // Rubric: criteria upserted by position so existing assessment scores stay valid.
        const rubric = await prisma.assessmentRubric.upsert({
          where: { missionId: mission.id },
          update: { passingScore: PASSING_SCORE },
          create: { missionId: mission.id, passingScore: PASSING_SCORE },
        });
        for (const [i, [name, description, maxPoints]] of m.rubric.entries()) {
          await prisma.rubricCriterion.upsert({
            where: { rubricId_position: { rubricId: rubric.id, position: i + 1 } },
            update: { name, description, maxPoints },
            create: { rubricId: rubric.id, position: i + 1, name, description, maxPoints },
          });
        }

        await prisma.missionSkill.deleteMany({ where: { missionId: mission.id } });
        await prisma.missionSkill.createMany({
          data: m.skills.map((s) => {
            const skillId = skillIds.get(s);
            if (!skillId) throw new Error(`${m.code}: unknown skill "${s}"`);
            return { missionId: mission.id, skillId };
          }),
        });
        missionCount += 1;
      }
    }

    const [departments, levels, skills, missions] = await Promise.all([
      prisma.department.count(),
      prisma.level.count(),
      prisma.skill.count(),
      prisma.mission.count({ where: { createdById: null } }),
    ]);
    console.log(`Seed complete: ${departments} departments, ${levels} levels, ${skills} skills, ${missions} curriculum missions (${missionCount} upserted).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
