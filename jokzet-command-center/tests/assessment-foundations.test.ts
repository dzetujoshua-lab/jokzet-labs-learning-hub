import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { assessSubmission } from "@/lib/assessments/service";
import { registerUser } from "@/lib/auth/service";
import { createEvidence } from "@/lib/evidence/service";
import { startMission, submitMission } from "@/lib/missions/progress";
import { getTotalXp } from "@/lib/missions/service";
import { LEVEL0, PASSING_SCORE } from "../prisma/curriculum/level0";
import { archiveRetired, ensurePlaceholderResource, syncRubric } from "../prisma/curriculum/sync";
import { curriculumProblems, missionProblems, rubricChanged } from "../prisma/curriculum/validate";

const PASSWORD = "correct-horse-42battery";
const CODE = "FSWD-L0-01";
const EXPLAIN = "I completed every step and tested the edge cases carefully.";
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "pipe", shell: true });

let userId = "";
let assessmentId = "";
let rubricVersionAtAssessment = 0;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "found-test" } } });
  seed();
  const reg = await registerUser({ displayName: "Found", email: "found-test-a@example.test", password: PASSWORD });
  if (!reg.ok) throw new Error("registration failed");
  userId = reg.userId;
}, 180_000);

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "found-test" } } });
  await db.mission.deleteMany({ where: { code: { in: ["ZZZ-L0-99", "ZZZ-L0-96", "ZZZ-L0-95"] } } });
  await db.user.deleteMany({ where: { email: { startsWith: "found-test" } } });
  await db.$disconnect();
});

describe("curriculum validators (pure)", () => {
  const first = () => clone(LEVEL0[0].missions[0]);

  it("accept the real curriculum", () => {
    expect(curriculumProblems(LEVEL0)).toEqual([]);
  });

  it("reject incomplete or unsafe missions with a clear reason", () => {
    const rubricOff = first();
    rubricOff.rubric[0][2] -= 1;
    expect(missionProblems(rubricOff).join()).toMatch(/sum to 99/);

    const noExperiment = first();
    noExperiment.experiment = " ";
    expect(missionProblems(noExperiment).join()).toMatch(/EXPERIMENT/);

    const noWatch = first();
    noWatch.watch = [];
    expect(missionProblems(noWatch).join()).toMatch(/WATCH/);

    const badCode = first();
    badCode.code = "fswd-1";
    expect(missionProblems(badCode).join()).toMatch(/code must look like/);

    const tooShort = first();
    tooShort.minutes = 3;
    expect(missionProblems(tooShort).join()).toMatch(/minutes/);

    const badKind = first();
    badKind.kind = "NONSENSE";
    expect(missionProblems(badKind).join()).toMatch(/kind must be one of/);

    const oneCriterion = first();
    oneCriterion.rubric = [["Only", "One", 100]];
    expect(missionProblems(oneCriterion).join()).toMatch(/at least two criteria/);

    const leaky = first();
    leaky.objective = "Use the " + "pass" + "word = hunter2hunter2 to log in.";
    expect(missionProblems(leaky).join()).toMatch(/content contains/);
  });

  it("reject duplicate codes and skills that the department does not declare", () => {
    const specs = clone(LEVEL0);
    specs[0].missions.push(clone(specs[0].missions[0]));
    expect(curriculumProblems(specs).join()).toMatch(/used twice/);

    const unknown = clone(LEVEL0);
    unknown[0].missions[0].skills.push("A skill nobody declared");
    expect(curriculumProblems(unknown).join()).toMatch(/unknown skill/);
  });

  it("detect a rubric change (text, points, order, count or passing score)", () => {
    const spec = { passingScore: PASSING_SCORE, rubric: LEVEL0[0].missions[0].rubric };
    const stored = { passingScore: PASSING_SCORE, criteria: spec.rubric.map(([name, description, maxPoints]) => ({ name, description, maxPoints })) };
    expect(rubricChanged(stored, spec)).toBe(false);
    expect(rubricChanged({ ...stored, passingScore: PASSING_SCORE + 5 }, spec)).toBe(true);
    expect(rubricChanged({ ...stored, criteria: stored.criteria.slice(1) }, spec)).toBe(true);
    const renamed = clone(stored);
    renamed.criteria[0].name = "Something else";
    expect(rubricChanged(renamed, spec)).toBe(true);
    const reordered = { ...stored, criteria: [stored.criteria[1], stored.criteria[0], ...stored.criteria.slice(2)] };
    expect(rubricChanged(reordered, spec)).toBe(true);
  });
});

describe("assessments record who scored them and what they were scored against", () => {
  it("keeps today's behaviour (XP, skills, pass) but marks the result as self-assessed with a rubric snapshot", async () => {
    await startMission(userId, CODE);
    const lm = await db.learnerMission.findFirstOrThrow({ where: { userId, mission: { code: CODE } }, include: { mission: { include: { rubric: { include: { criteria: { orderBy: { position: "asc" } } } } } } } });
    const ev = await createEvidence(userId, { title: "Proof", departmentCode: "fswd", kind: "Link", description: "", linkUrl: "https://github.com/jokzet/work", capturedDate: "2026-11-16" }, undefined, lm.id);
    if (!ev.ok) throw new Error(ev.error);
    const sent = await submitMission(userId, lm.id, { explanation: EXPLAIN, githubUrl: "", liveUrl: "" });
    if (!sent.ok) throw new Error(sent.error);
    const submission = await db.submission.findFirstOrThrow({ where: { learnerMissionId: lm.id, attempt: sent.attempt } });
    const criteria = lm.mission.rubric!.criteria;
    rubricVersionAtAssessment = lm.mission.rubric!.version;

    const result = await assessSubmission(userId, submission.id, { scores: criteria.map((c) => ({ criterionId: c.id, points: c.maxPoints })) });
    expect(result).toMatchObject({ ok: true, outcome: "PASS", percentage: 100, xpAwarded: 40 }); // unchanged legacy result
    expect(await getTotalXp(userId)).toBe(40);

    const assessment = await db.assessment.findUniqueOrThrow({ where: { submissionId: submission.id }, include: { scores: true } });
    assessmentId = assessment.id;
    expect(assessment).toMatchObject({ assessorId: null, assessorKind: "SELF", status: "SELF_RECORDED", rubricVersion: rubricVersionAtAssessment });
    expect(assessment.scores).toHaveLength(criteria.length);
    for (const score of assessment.scores) {
      const c = criteria.find((x) => x.id === score.criterionId)!;
      expect(score).toMatchObject({ criterionName: c.name, maxPoints: c.maxPoints });
    }

    const skills = await db.userSkill.findMany({ where: { userId } });
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.every((s) => s.tier === "SELF_ASSESSED")).toBe(true); // never VERIFIED without a reviewer
  });
});

describe("database guarantees", () => {
  it("blocks deleting a mission record that has submissions, and deleting a submission that has an assessment", async () => {
    const lm = await db.learnerMission.findFirstOrThrow({ where: { userId, mission: { code: CODE } } });
    await expect(db.$executeRaw`DELETE FROM "LearnerMission" WHERE id = ${lm.id}`).rejects.toThrow();
    const submission = await db.submission.findFirstOrThrow({ where: { learnerMissionId: lm.id } });
    await expect(db.submission.delete({ where: { id: submission.id } })).rejects.toThrow();
    expect(await db.assessment.count({ where: { id: assessmentId } })).toBe(1);
  });

  it("keeps publication status and the legacy isPublished flag in step", async () => {
    const rows = await db.mission.groupBy({ by: ["status", "isPublished"], _count: true });
    for (const r of rows) expect(r.status === "PUBLISHED").toBe(r.isPublished);
    const dept = await db.department.findFirstOrThrow();
    const data = { code: "ZZZ-L0-98", departmentId: dept.id, title: "x", objective: "o", durationMinutes: 30, requiredTools: [], experimentChallenge: "e", submissionRequirements: "s", remediation: "r" };
    await expect(db.mission.create({ data: { ...data, isPublished: true, status: "DRAFT" } })).rejects.toThrow();
    await expect(db.mission.create({ data: { ...data, code: "ZZZ-L0-97", isPublished: false, status: "PUBLISHED" } })).rejects.toThrow();
    expect(await db.mission.count({ where: { code: { in: ["ZZZ-L0-98", "ZZZ-L0-97"] } } })).toBe(0);
  });
});

describe("the seed is non-destructive and versions rubrics", () => {
  // These tests use rows owned by the test learner, never the shared curriculum, because other test files read the
  // curriculum (and seed it) in parallel against the same database.
  it("a re-seed leaves the real curriculum's resources alone", async () => {
    seed();
    const missions = await db.mission.findMany({ where: { createdById: null }, include: { resources: true } });
    expect(missions).toHaveLength(18);
    for (const m of missions) {
      expect(m.resources).toHaveLength(1); // never duplicated
      expect(m.resources[0].url).toBeNull(); // never invented
    }
  }, 180_000);

  it("never deletes or overwrites a resource: a placeholder is created only for a mission that has none", async () => {
    const dept = await db.department.findUniqueOrThrow({ where: { code: "fswd" } });
    const mission = await db.mission.create({
      data: { code: "ZZZ-L0-95", departmentId: dept.id, createdById: userId, title: "Resource test", objective: "o", durationMinutes: 30, requiredTools: [], experimentChallenge: "e", submissionRequirements: "s", remediation: "r" },
    });
    expect(await ensurePlaceholderResource(db, mission.id)).toBe(true);
    const resource = await db.resource.findFirstOrThrow({ where: { missionId: mission.id } });
    expect(resource.url).toBeNull();
    // A link is approved and added later; re-running the step must not touch it.
    await db.resource.update({ where: { id: resource.id }, data: { url: "https://example.test/approved-watch" } });
    expect(await ensurePlaceholderResource(db, mission.id)).toBe(false);
    expect(await ensurePlaceholderResource(db, mission.id)).toBe(false);
    const after = await db.resource.findMany({ where: { missionId: mission.id } });
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: resource.id, url: "https://example.test/approved-watch" });
  });

  it("archives missions that left the curriculum files instead of deleting them", async () => {
    const dept = await db.department.findUniqueOrThrow({ where: { code: "fswd" } });
    await db.mission.create({
      data: { code: "ZZZ-L0-99", departmentId: dept.id, createdById: userId, title: "Retired", objective: "o", durationMinutes: 30, requiredTools: [], experimentChallenge: "e", submissionRequirements: "s", remediation: "r", status: "PUBLISHED", isPublished: true },
    });
    const scope = { code: { in: ["ZZZ-L0-99", "ZZZ-L0-95"] } };
    expect(await archiveRetired(db, ["ZZZ-L0-95"], scope)).toBe(1); // only the one that is no longer listed
    expect(await db.mission.findUniqueOrThrow({ where: { code: "ZZZ-L0-99" } })).toMatchObject({ status: "ARCHIVED", isPublished: false });
    expect(await archiveRetired(db, ["ZZZ-L0-95"], scope)).toBe(0); // idempotent
    expect(await db.mission.count({ where: { code: "ZZZ-L0-95", status: { not: "ARCHIVED" } } })).toBe(1); // still listed: untouched
  });

  // Rubric versioning is tested on a mission of its own so it cannot interfere with other test files seeding in parallel.
  const spec = (): { passingScore: number; rubric: [string, string, number][] } => ({
    passingScore: 70,
    rubric: [["Structure", "Clean structure", 50], ["Behaviour", "Works as described", 50]],
  });

  it("bumps the rubric version on a change while earlier scores keep their wording, and does nothing when nothing changed", async () => {
    const dept = await db.department.findUniqueOrThrow({ where: { code: "fswd" } });
    const mission = await db.mission.create({
      data: { code: "ZZZ-L0-96", departmentId: dept.id, createdById: userId, title: "Rubric test", objective: "o", durationMinutes: 30, requiredTools: [], experimentChallenge: "e", submissionRequirements: "s", remediation: "r" },
    });
    expect(await syncRubric(db, mission.id, mission.code!, spec())).toBe(false); // created at version 1
    expect(await syncRubric(db, mission.id, mission.code!, spec())).toBe(false); // identical: no bump
    let rubric = await db.assessmentRubric.findUniqueOrThrow({ where: { missionId: mission.id }, include: { criteria: { orderBy: { position: "asc" } } } });
    expect(rubric.version).toBe(1);

    // A scored attempt against version 1.
    const lm = await db.learnerMission.create({ data: { userId, missionId: mission.id, status: "PASSED" } });
    const sub = await db.submission.create({ data: { userId, learnerMissionId: lm.id, attempt: 1, status: "ASSESSED" } });
    const assessment = await db.assessment.create({
      data: {
        userId, submissionId: sub.id, rubricId: rubric.id, totalPoints: 100, maxPoints: 100, percentage: 100, outcome: "PASS", rubricVersion: 1,
        scores: { create: rubric.criteria.map((c) => ({ criterionId: c.id, points: c.maxPoints, criterionName: c.name, maxPoints: c.maxPoints })) },
      },
    });

    // The curriculum changes: reworded criterion, different points, new passing score.
    expect(await syncRubric(db, mission.id, mission.code!, { passingScore: 75, rubric: [["Structure and naming", "Clean structure, good names", 60], ["Behaviour", "Works as described", 40]] })).toBe(true);
    rubric = await db.assessmentRubric.findUniqueOrThrow({ where: { missionId: mission.id }, include: { criteria: { orderBy: { position: "asc" } } } });
    expect(rubric).toMatchObject({ version: 2, passingScore: 75 });
    expect(rubric.criteria.map((c) => [c.name, c.maxPoints])).toEqual([["Structure and naming", 60], ["Behaviour", 40]]);

    // The old result still reads exactly as it was given.
    const old = await db.assessment.findUniqueOrThrow({ where: { id: assessment.id }, include: { scores: true } });
    expect(old.rubricVersion).toBe(1);
    expect(old.scores.map((x) => [x.criterionName, x.maxPoints]).sort()).toEqual([["Behaviour", 50], ["Structure", 50]]);
  }, 60_000);

  it("refuses to remove rubric criteria that already have scores, and writes nothing in that case", async () => {
    const mission = await db.mission.findUniqueOrThrow({ where: { code: "ZZZ-L0-96" }, include: { rubric: true } });
    const before = await db.assessmentRubric.findUniqueOrThrow({ where: { id: mission.rubric!.id }, include: { criteria: true } });
    // Shrinking to one criterion would drop "Behaviour", which has a score.
    await expect(syncRubric(db, mission.id, mission.code!, { passingScore: 70, rubric: [["Structure", "Clean structure", 100]] })).rejects.toThrow(/refusing to remove rubric criteria that already have scores/);
    const after = await db.assessmentRubric.findUniqueOrThrow({ where: { id: mission.rubric!.id }, include: { criteria: true } });
    expect(after.version).toBe(before.version);
    expect(after.criteria).toHaveLength(before.criteria.length);
  });

  it("deleting a whole account still removes its submissions and assessments (data-subject deletion keeps working)", async () => {
    await db.user.delete({ where: { id: userId } });
    expect(await db.assessment.count({ where: { id: assessmentId } })).toBe(0);
    expect(await db.submission.count({ where: { userId } })).toBe(0);
    expect(await db.learnerMission.count({ where: { userId } })).toBe(0);
  });
});
