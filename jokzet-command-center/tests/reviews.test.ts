import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPersonalActivity, startActivity } from "@/lib/activities/service";
import { assessSubmission } from "@/lib/assessments/service";
import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { createEvidence } from "@/lib/evidence/service";
import { startMission, submitMission } from "@/lib/missions/progress";
import { getTotalXp } from "@/lib/missions/service";
import {
  authoriseEvidenceAccess, cancelReviewRequest, claimRequest, competencyLevelFor, completeReview, getReviewCase, getReviewState, listQueue,
  logEvidenceAccess, releaseRequest, requestReview, type Actor,
} from "@/lib/reviews/service";

const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `rev-test-${n}@example.test`;
const EXPLAIN = "I completed every step and tested the edge cases carefully.";
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });

const people: Record<string, { id: string; actor: Actor }> = {};
async function person(name: string, role: Actor["role"] = "LEARNER", scopes: string[] = []) {
  const reg = await registerUser({ displayName: name, email: mail(name.toLowerCase()), password: PASSWORD });
  if (!reg.ok) throw new Error("registration failed");
  if (role !== "LEARNER") await db.user.update({ where: { id: reg.userId }, data: { role } });
  for (const code of scopes) {
    const dept = await db.department.findUniqueOrThrow({ where: { code } });
    await db.reviewerScope.create({ data: { userId: reg.userId, departmentId: dept.id } });
  }
  people[name] = { id: reg.userId, actor: { id: reg.userId, role, displayName: name } };
  return people[name];
}

/** Learner submits a curriculum mission with a link as evidence and self-assesses it. */
async function selfAssess(userId: string, code: string, points: number[]) {
  await startMission(userId, code);
  const lm = await db.learnerMission.findFirstOrThrow({ where: { userId, mission: { code } } });
  const ev = await createEvidence(userId, { title: "Proof", departmentCode: "fswd", kind: "Link", description: "", linkUrl: "https://github.com/jokzet/work", capturedDate: "2026-11-16" }, undefined, lm.id);
  if (!ev.ok) throw new Error(ev.error);
  const sent = await submitMission(userId, lm.id, { explanation: EXPLAIN, githubUrl: "", liveUrl: "" });
  if (!sent.ok) throw new Error(sent.error);
  const submission = await db.submission.findFirstOrThrow({ where: { learnerMissionId: lm.id, attempt: sent.attempt } });
  const criteria = await db.rubricCriterion.findMany({ where: { rubric: { mission: { code } } }, orderBy: { position: "asc" } });
  const r = await assessSubmission(userId, submission.id, { scores: criteria.map((c, i) => ({ criterionId: c.id, points: points[i] })) });
  if (!r.ok) throw new Error(r.error);
  const assessment = await db.assessment.findUniqueOrThrow({ where: { submissionId: submission.id } });
  return { assessmentId: assessment.id, learnerMissionId: lm.id, criteria };
}
const FULL = [25, 30, 20, 25]; // FSWD-L0-01 rubric points
const FULLS: Record<string, number[]> = { "FSWD-L0-01": [25, 30, 20, 25], "FSWD-L0-02": [20, 35, 25, 20], "SEC-L0-01": [30, 35, 15, 20], "SEC-L0-02": [30, 35, 20, 15] };
const requestFor = async (assessmentId: string) => (await db.reviewRequest.findUniqueOrThrow({ where: { assessmentId } })).id;

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "rev-test" } } });
  seed();
  await person("Learner");
  await person("Other");
  await person("Rita", "REVIEWER", ["fswd"]);
  await person("Uma", "REVIEWER", ["uxui"]);
  await person("Ada", "ADMIN");
  await person("Dual", "REVIEWER", ["fswd"]); // a reviewer who also does missions
}, 240_000);

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "rev-test" } } });
  await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "review:" } } });
  await db.$disconnect();
});

describe("competency levels", () => {
  it("map a verified pass to a level", () => {
    expect(competencyLevelFor(70)).toBe("BASIC");
    expect(competencyLevelFor(79)).toBe("BASIC");
    expect(competencyLevelFor(80)).toBe("WORKING");
    expect(competencyLevelFor(89)).toBe("WORKING");
    expect(competencyLevelFor(90)).toBe("STRONG");
    expect(competencyLevelFor(100)).toBe("STRONG");
  });
});

describe("asking for a review", () => {
  it("is the learner's own action, once, and can be withdrawn until a reviewer takes it", async () => {
    const { assessmentId } = await selfAssess(people.Learner.id, "FSWD-L0-01", FULL);
    expect(await getReviewState(people.Other.id, assessmentId)).toBeNull(); // not visible to anyone else
    expect(await requestReview(people.Other.id, assessmentId)).toMatchObject({ ok: false, error: "Assessment not found." });
    expect(await requestReview(people.Rita.id, assessmentId)).toMatchObject({ ok: false }); // a reviewer cannot ask on the learner's behalf

    expect(await requestReview(people.Learner.id, assessmentId)).toEqual({ ok: true });
    expect(await getReviewState(people.Learner.id, assessmentId)).toMatchObject({ status: "PENDING_REVIEW", requestStatus: "OPEN" });
    expect(await requestReview(people.Learner.id, assessmentId)).toMatchObject({ ok: false, error: expect.stringMatching(/already been requested/) });

    expect(await cancelReviewRequest(people.Other.id, assessmentId)).toMatchObject({ ok: false });
    expect(await cancelReviewRequest(people.Learner.id, assessmentId)).toEqual({ ok: true });
    expect(await getReviewState(people.Learner.id, assessmentId)).toMatchObject({ status: "SELF_RECORDED", requestStatus: "CANCELLED" });
    expect(await requestReview(people.Learner.id, assessmentId)).toEqual({ ok: true }); // can ask again
    expect(await db.reviewRequest.count({ where: { assessmentId } })).toBe(1); // reopened, not duplicated

    const requestId = await requestFor(assessmentId);
    expect(await claimRequest(people.Rita.actor, requestId)).toEqual({ ok: true });
    expect(await cancelReviewRequest(people.Learner.id, assessmentId)).toMatchObject({ ok: false }); // too late to withdraw
    expect(await releaseRequest(people.Rita.actor, requestId)).toEqual({ ok: true });
  });

  it("never lets a learner set a verified status themselves", async () => {
    const a = await db.assessment.findFirstOrThrow({ where: { userId: people.Learner.id } });
    expect(["SELF_RECORDED", "PENDING_REVIEW"]).toContain(a.status);
    expect(a.assessorKind).toBe("SELF");
    expect(await db.assessmentReview.count({ where: { userId: people.Learner.id } })).toBe(0);
  });
});

describe("the queue: roles, scope and own work", () => {
  it("shows a request only to reviewers whose scope covers its department, and to administrators", async () => {
    const queue = async (actor: Actor) => (await listQueue(actor)).map((q) => q.learnerName);
    expect(await queue(people.Rita.actor)).toContain("Learner");
    expect(await queue(people.Ada.actor)).toContain("Learner");
    expect(await queue(people.Uma.actor)).toEqual([]); // reviews uxui only
    expect(await listQueue(people.Learner.actor)).toEqual([]); // a plain learner has no queue
    expect(await listQueue({ ...people.Learner.actor, role: "AUTHOR" })).toEqual([]);
  });

  it("refuses non-reviewers and out-of-scope reviewers the same way as a missing review", async () => {
    const requestId = await requestFor((await db.assessment.findFirstOrThrow({ where: { userId: people.Learner.id } })).id);
    for (const actor of [people.Learner.actor, people.Other.actor, people.Uma.actor]) {
      expect(await claimRequest(actor, requestId)).toMatchObject({ ok: false });
      expect(await getReviewCase(actor, requestId)).toBeNull();
      expect(await completeReview(actor, requestId, { decision: "CONFIRM" })).toMatchObject({ ok: false });
    }
    expect(await claimRequest(people.Rita.actor, "does-not-exist")).toMatchObject({ ok: false, error: "Review not found." });
    expect((await db.reviewRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe("OPEN"); // nothing changed
  });

  it("never lets anyone review their own work, in code or in the database", async () => {
    const { assessmentId } = await selfAssess(people.Dual.id, "FSWD-L0-01", FULL);
    expect(await requestReview(people.Dual.id, assessmentId)).toEqual({ ok: true });
    const requestId = await requestFor(assessmentId);
    expect((await listQueue(people.Dual.actor)).some((q) => q.id === requestId)).toBe(false);
    expect((await listQueue(people.Ada.actor)).some((q) => q.id === requestId)).toBe(true); // others can still see it
    expect(await claimRequest(people.Dual.actor, requestId)).toMatchObject({ ok: false, error: "Review not found." });
    expect(await claimRequest(people.Ada.actor, requestId)).toMatchObject({ ok: true }); // an administrator may review a reviewer's work
    await expect(db.$executeRaw`UPDATE "ReviewRequest" SET "claimedById" = ${people.Dual.id} WHERE id = ${requestId}`).rejects.toThrow();
    await expect(db.assessmentReview.create({
      data: { assessmentId, userId: people.Dual.id, reviewerId: people.Dual.id, reviewerLabel: "x", decision: "CONFIRM", rubricVersion: 1, totalPoints: 1, maxPoints: 1, percentage: 100, outcome: "PASS" },
    })).rejects.toThrow();
    await releaseRequest(people.Ada.actor, requestId);
  });
});

describe("claiming", () => {
  it("lets exactly one reviewer take a request, even at the same moment", async () => {
    const { assessmentId } = await selfAssess(people.Other.id, "FSWD-L0-01", FULL);
    await requestReview(people.Other.id, assessmentId);
    const requestId = await requestFor(assessmentId);
    const [a, b] = await Promise.all([claimRequest(people.Rita.actor, requestId), claimRequest(people.Ada.actor, requestId)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const winner = a.ok ? people.Rita : people.Ada;
    const loser = a.ok ? people.Ada : people.Rita;
    expect(await getReviewCase(loser.actor, requestId)).toBeNull(); // only the claimer sees the case
    expect(await getReviewCase(winner.actor, requestId)).toMatchObject({ learnerName: "Other", mission: { departmentCode: "fswd" } });
    expect(await releaseRequest(loser.actor, requestId)).toMatchObject({ ok: false });
    expect(await releaseRequest(winner.actor, requestId)).toEqual({ ok: true });
  });
});

describe("completing a review", () => {
  it("refuses bad reviews and writes nothing", async () => {
    const { assessmentId, criteria } = await selfAssess(people.Learner.id, "FSWD-L0-02", [20, 20, 20, 20]);
    await requestReview(people.Learner.id, assessmentId);
    const requestId = await requestFor(assessmentId);
    expect(await completeReview(people.Rita.actor, requestId, { decision: "CONFIRM" })).toMatchObject({ ok: false, error: expect.stringMatching(/Claim this review/) });
    await claimRequest(people.Rita.actor, requestId);
    const refused = [
      { decision: "ADJUST" as const, reason: "short", scores: [] },
      { decision: "ADJUST" as const, reason: "Scores did not match the evidence.", scores: criteria.slice(1).map((c) => ({ criterionId: c.id, points: 1 })) },
      { decision: "ADJUST" as const, reason: "Scores did not match the evidence.", scores: criteria.map((c) => ({ criterionId: c.id, points: c.maxPoints + 1 })) },
      { decision: "ADJUST" as const, reason: "Scores did not match the evidence.", scores: [...criteria.slice(0, 3), criteria[0]].map((c) => ({ criterionId: c.id, points: 1 })) },
      { decision: "ADJUST" as const, reason: "Scores did not match the evidence.", scores: [{ criterionId: "not-a-criterion", points: 1 }, ...criteria.slice(1).map((c) => ({ criterionId: c.id, points: 1 }))] },
      { decision: "REJECT" as const, reason: "no" },
      { decision: "REJECT" as const, reason: "The evidence " + "pass" + "word = hunter2hunter2 is not valid." },
      { decision: "MAYBE" as never },
    ];
    for (const input of refused) expect(await completeReview(people.Rita.actor, requestId, input), JSON.stringify(input).slice(0, 60)).toMatchObject({ ok: false });
    expect(await db.assessmentReview.count({ where: { assessmentId } })).toBe(0);
    expect((await db.assessment.findUniqueOrThrow({ where: { id: assessmentId } })).status).toBe("PENDING_REVIEW");
    expect((await db.reviewRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe("CLAIMED");
    await releaseRequest(people.Rita.actor, requestId);
  }, 120_000);

  it("CONFIRM verifies a pass: verified tier, competency from the score, the learner's own scores untouched", async () => {
    const xpBefore = await getTotalXp(people.Learner.id);
    const mission = await db.mission.findUniqueOrThrow({ where: { code: "FSWD-L0-01" }, include: { skills: true } });
    const assessmentId = (await db.assessment.findFirstOrThrow({ where: { userId: people.Learner.id, rubric: { missionId: mission.id } } })).id;
    const before = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId }, include: { scores: true } });
    const requestId = await requestFor(assessmentId);
    expect(await claimRequest(people.Rita.actor, requestId)).toEqual({ ok: true });

    const result = await completeReview(people.Rita.actor, requestId, { decision: "CONFIRM", reason: "Clear evidence and clean work." });
    expect(result).toMatchObject({ ok: true, decision: "CONFIRM", outcome: "PASS", percentage: 100, creditChange: "none" });

    const after = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId }, include: { scores: true } });
    expect(after).toMatchObject({ status: "VERIFIED", assessorKind: "HUMAN", totalPoints: before.totalPoints, percentage: before.percentage });
    expect(after.scores.map((s) => [s.criterionId, s.points]).sort()).toEqual(before.scores.map((s) => [s.criterionId, s.points]).sort()); // self scores kept
    expect(await getTotalXp(people.Learner.id)).toBe(xpBefore); // no second award

    const skills = await db.userSkill.findMany({ where: { userId: people.Learner.id, skillId: { in: mission.skills.map((s) => s.skillId) } } });
    expect(skills.length).toBe(mission.skills.length);
    expect(skills.every((s) => s.tier === "VERIFIED")).toBe(true);
    const competencies = await db.skillCompetency.findMany({ where: { userId: people.Learner.id, assessmentId } });
    expect(competencies).toHaveLength(mission.skills.length);
    expect(competencies.every((c) => c.level === "STRONG" && c.source === "ASSESSED")).toBe(true);

    expect((await db.reviewRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe("DONE");
    const review = await db.assessmentReview.findFirstOrThrow({ where: { assessmentId } });
    expect(review).toMatchObject({ reviewerId: people.Rita.id, reviewerLabel: "Rita", decision: "CONFIRM" });
    expect((await getReviewState(people.Learner.id, assessmentId))?.latestReview).toMatchObject({ reviewerLabel: "Rita", outcome: "PASS" });
    expect(await db.feedback.count({ where: { assessmentId, authorId: people.Rita.id } })).toBe(1);
    expect(await db.activityRecord.count({ where: { userId: people.Learner.id, type: "ASSESSMENT_REVIEWED" } })).toBe(1);
    // A finished request cannot be completed, requested or claimed again.
    expect(await completeReview(people.Rita.actor, requestId, { decision: "CONFIRM" })).toMatchObject({ ok: false });
    expect(await requestReview(people.Learner.id, assessmentId)).toMatchObject({ ok: false, error: expect.stringMatching(/already been reviewed/) });
  });

  it("ADJUST that lowers a credited pass takes the credit back and invites a resubmission", async () => {
    const { assessmentId, learnerMissionId, criteria } = await selfAssess(people.Other.id, "FSWD-L0-02", FULLS["FSWD-L0-02"]);
    const mission = await db.mission.findUniqueOrThrow({ where: { code: "FSWD-L0-02" }, include: { skills: true } });
    const xpBefore = await getTotalXp(people.Other.id);
    expect(await db.userSkill.count({ where: { userId: people.Other.id, skillId: { in: mission.skills.map((s) => s.skillId) } } })).toBe(mission.skills.length);
    await requestReview(people.Other.id, assessmentId);
    const requestId = await requestFor(assessmentId);
    await claimRequest(people.Rita.actor, requestId);

    const result = await completeReview(people.Rita.actor, requestId, {
      decision: "ADJUST", reason: "The page is not responsive and there is no evidence of testing.", scores: criteria.map((c) => ({ criterionId: c.id, points: Math.floor(c.maxPoints / 4), comment: "Needs work" })),
    });
    expect(result).toMatchObject({ ok: true, decision: "ADJUST", outcome: "FAIL", creditChange: "revoked" });
    expect(await getTotalXp(people.Other.id)).toBe(xpBefore - mission.xpReward);
    const lm = await db.learnerMission.findUniqueOrThrow({ where: { id: learnerMissionId } });
    expect(lm).toMatchObject({ status: "NEEDS_REVISION", xpAwarded: 0, completedAt: null });
    // A skill is removed only if no OTHER passed curriculum mission still teaches it (this learner also passed FSWD-L0-01).
    const stillTaught = await db.missionSkill.findMany({ where: { skillId: { in: mission.skills.map((s) => s.skillId) }, mission: { code: { not: "FSWD-L0-02" }, learnerMissions: { some: { userId: people.Other.id, status: "PASSED" } } } }, select: { skillId: true } });
    const keep = new Set(stillTaught.map((x) => x.skillId));
    const left = await db.userSkill.findMany({ where: { userId: people.Other.id, skillId: { in: mission.skills.map((s) => s.skillId) } }, select: { skillId: true } });
    expect(new Set(left.map((x) => x.skillId))).toEqual(keep);
    expect(left.length).toBeLessThan(mission.skills.length); // at least one skill was taken back
    expect(await db.skillCompetency.count({ where: { userId: people.Other.id, assessmentId } })).toBe(0);
    expect((await db.assessment.findUniqueOrThrow({ where: { id: assessmentId } })).status).toBe("VERIFIED"); // the (negative) result is verified
    const review = await db.assessmentReview.findFirstOrThrow({ where: { assessmentId }, include: { scores: true } });
    expect(review.outcome).toBe("FAIL");
    expect(review.scores).toHaveLength(criteria.length);
    expect(review.percentage).toBeLessThan(40);

    // The learner can resubmit: attempt 2.
    const ev = await createEvidence(people.Other.id, { title: "Better proof", departmentCode: "fswd", kind: "Link", description: "", linkUrl: "https://github.com/jokzet/better", capturedDate: "2026-11-17" }, undefined, learnerMissionId);
    if (!ev.ok) throw new Error(ev.error);
    expect(await submitMission(people.Other.id, learnerMissionId, { explanation: EXPLAIN, githubUrl: "", liveUrl: "" })).toMatchObject({ ok: true, attempt: 2 });
  }, 120_000);

  it("ADJUST that raises a result that had not passed grants the credit", async () => {
    const { assessmentId, learnerMissionId, criteria } = await selfAssess(people.Learner.id, "SEC-L0-01", [10, 10, 10, 10]);
    expect(await db.learnerMission.findUniqueOrThrow({ where: { id: learnerMissionId } })).toMatchObject({ status: "NEEDS_REVISION", xpAwarded: 0 });
    const mission = await db.mission.findUniqueOrThrow({ where: { code: "SEC-L0-01" }, include: { skills: true } });
    const xpBefore = await getTotalXp(people.Learner.id);
    await requestReview(people.Learner.id, assessmentId);
    const requestId = await requestFor(assessmentId);
    await claimRequest(people.Ada.actor, requestId);
    const result = await completeReview(people.Ada.actor, requestId, {
      decision: "ADJUST", reason: "The evidence is stronger than the self-score suggests.", scores: criteria.map((c) => ({ criterionId: c.id, points: c.maxPoints })),
    });
    expect(result).toMatchObject({ ok: true, outcome: "PASS", creditChange: "granted" });
    expect(await getTotalXp(people.Learner.id)).toBe(xpBefore + mission.xpReward);
    expect(await db.learnerMission.findUniqueOrThrow({ where: { id: learnerMissionId } })).toMatchObject({ status: "PASSED" });
    const skills = await db.userSkill.findMany({ where: { userId: people.Learner.id, skillId: { in: mission.skills.map((s) => s.skillId) } } });
    expect(skills.every((s) => s.tier === "VERIFIED")).toBe(true);
    expect(await db.skillCompetency.count({ where: { userId: people.Learner.id, assessmentId } })).toBe(mission.skills.length);
  }, 120_000);

  it("REJECT does not accept the work, needs a reason, and revokes earned credit", async () => {
    const { assessmentId, learnerMissionId } = await selfAssess(people.Other.id, "SEC-L0-02", FULLS["SEC-L0-02"]);
    const mission = await db.mission.findUniqueOrThrow({ where: { code: "SEC-L0-02" } });
    const xpBefore = await getTotalXp(people.Other.id);
    await requestReview(people.Other.id, assessmentId);
    const requestId = await requestFor(assessmentId);
    await claimRequest(people.Rita.actor, requestId);
    // SEC is outside Rita's fswd scope: she cannot even open it.
    expect(await completeReview(people.Rita.actor, requestId, { decision: "REJECT", reason: "Not enough evidence." })).toMatchObject({ ok: false });
    await releaseRequest(people.Rita.actor, requestId);
    await claimRequest(people.Ada.actor, requestId);
    const result = await completeReview(people.Ada.actor, requestId, { decision: "REJECT", reason: "The screenshots do not show your own lab." });
    expect(result).toMatchObject({ ok: true, decision: "REJECT", outcome: "FAIL", percentage: 0, creditChange: "revoked" });
    expect((await db.assessment.findUniqueOrThrow({ where: { id: assessmentId } })).status).toBe("REJECTED");
    expect((await db.learnerMission.findUniqueOrThrow({ where: { id: learnerMissionId } })).status).toBe("NEEDS_REVISION");
    expect(await getTotalXp(people.Other.id)).toBe(xpBefore - mission.xpReward);
  }, 120_000);

  it("verifies a personal activity without any XP, skills or competency (practice earns none)", async () => {
    const created = await createPersonalActivity(people.Learner.id, {
      title: "Review me", departmentCode: "fswd", kind: "Build", evidenceType: "Screenshot", minutes: 30, objective: "Build a small thing and show it.", deliverables: "A screenshot", rubricTemplate: "build",
    });
    if (!created.ok) throw new Error(created.error);
    await startActivity(people.Learner.id, created.id);
    const ev = await createEvidence(people.Learner.id, { title: "Proof", departmentCode: "fswd", kind: "Link", description: "", linkUrl: "https://github.com/jokzet/practice", capturedDate: "2026-11-16" }, undefined, created.id);
    if (!ev.ok) throw new Error(ev.error);
    await submitMission(people.Learner.id, created.id, { explanation: EXPLAIN, githubUrl: "", liveUrl: "" });
    const submission = await db.submission.findFirstOrThrow({ where: { learnerMissionId: created.id } });
    const criteria = await db.rubricCriterion.findMany({ where: { rubric: { mission: { learnerMissions: { some: { id: created.id } } } } }, orderBy: { position: "asc" } });
    await assessSubmission(people.Learner.id, submission.id, { scores: criteria.map((c) => ({ criterionId: c.id, points: c.maxPoints })) });
    const assessmentId = (await db.assessment.findUniqueOrThrow({ where: { submissionId: submission.id } })).id;
    const xp = await getTotalXp(people.Learner.id);
    const competenciesBefore = await db.skillCompetency.count({ where: { userId: people.Learner.id } });
    await requestReview(people.Learner.id, assessmentId);
    const requestId = await requestFor(assessmentId);
    await claimRequest(people.Rita.actor, requestId);
    expect(await completeReview(people.Rita.actor, requestId, { decision: "CONFIRM" })).toMatchObject({ ok: true, outcome: "PASS", creditChange: "none" });
    expect((await db.assessment.findUniqueOrThrow({ where: { id: assessmentId } })).status).toBe("VERIFIED");
    expect(await getTotalXp(people.Learner.id)).toBe(xp);
    expect(await db.skillCompetency.count({ where: { userId: people.Learner.id } })).toBe(competenciesBefore);
  }, 120_000);

  it("lets only one of two simultaneous completions win", async () => {
    const { assessmentId } = await selfAssess(people.Dual.id, "FSWD-L0-02", FULLS["FSWD-L0-02"]);
    await requestReview(people.Dual.id, assessmentId);
    const requestId = await requestFor(assessmentId);
    await claimRequest(people.Ada.actor, requestId);
    const results = await Promise.all([completeReview(people.Ada.actor, requestId, { decision: "CONFIRM" }), completeReview(people.Ada.actor, requestId, { decision: "CONFIRM" })]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.assessmentReview.count({ where: { assessmentId } })).toBe(1);
  }, 120_000);
});

describe("database guarantees", () => {
  it("require a written reason for ADJUST and REJECT and keep percentages sane", async () => {
    const a = await db.assessment.findFirstOrThrow({ where: { userId: people.Learner.id } });
    const base = { assessmentId: a.id, userId: people.Learner.id, reviewerLabel: "x", rubricVersion: 1, totalPoints: 1, maxPoints: 2, percentage: 50, outcome: "REVISE" as const };
    await expect(db.assessmentReview.create({ data: { ...base, decision: "ADJUST" } })).rejects.toThrow();
    await expect(db.assessmentReview.create({ data: { ...base, decision: "REJECT", reason: "short" } })).rejects.toThrow();
    await expect(db.assessmentReview.create({ data: { ...base, decision: "CONFIRM", percentage: 150 } })).rejects.toThrow();
    await expect(db.assessmentReview.create({ data: { ...base, decision: "CONFIRM", totalPoints: 5 } })).rejects.toThrow();
  });
});

describe("evidence access for reviewers", () => {
  it("is limited to the claimed request's own submission, never to the learner's other evidence, and every use is logged", async () => {
    // The learner's FSWD-L0-02 assessment from the "refuses bad reviews" test is still waiting for review.
    const lm = await db.learnerMission.findFirstOrThrow({ where: { userId: people.Learner.id, mission: { code: "FSWD-L0-02" } } });
    const assessmentId = (await db.assessment.findFirstOrThrow({ where: { userId: people.Learner.id, submission: { learnerMissionId: lm.id } } })).id;
    const learnerMissionId = lm.id;
    expect(learnerMissionId).toBeTruthy();
    // Give the submission a stored file and a second, unrelated piece of evidence.
    const submission = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { submissionId: true } });
    const file = await db.submissionFile.create({ data: { userId: people.Learner.id, storageKey: "f".repeat(32), originalName: "shot.png", mimeType: "image/png", sizeBytes: 10, kind: "IMAGE", sha256: "0".repeat(64) } });
    const dept = await db.department.findUniqueOrThrow({ where: { code: "fswd" } });
    const attached = await db.evidenceItem.create({ data: { userId: people.Learner.id, departmentId: dept.id, title: "Attached", kind: "SCREENSHOT", capturedDate: new Date("2026-11-16"), fileId: file.id, submissionId: submission.submissionId } });
    const file2 = await db.submissionFile.create({ data: { userId: people.Learner.id, storageKey: "e".repeat(32), originalName: "other.png", mimeType: "image/png", sizeBytes: 10, kind: "IMAGE", sha256: "1".repeat(64) } });
    const unrelated = await db.evidenceItem.create({ data: { userId: people.Learner.id, departmentId: dept.id, title: "Unrelated private", kind: "SCREENSHOT", capturedDate: new Date("2026-11-16"), fileId: file2.id } });

    const requestId = await requestFor(assessmentId);
    // Not claimed yet: no access.
    expect(await authoriseEvidenceAccess(people.Rita.actor, requestId, attached.id)).toBeNull();
    await claimRequest(people.Rita.actor, requestId);
    expect(await authoriseEvidenceAccess(people.Rita.actor, requestId, attached.id)).toMatchObject({ learnerId: people.Learner.id });
    expect(await authoriseEvidenceAccess(people.Rita.actor, requestId, unrelated.id)).toBeNull(); // not part of this submission
    expect(await authoriseEvidenceAccess(people.Ada.actor, requestId, attached.id)).toBeNull(); // not the claimer
    expect(await authoriseEvidenceAccess(people.Uma.actor, requestId, attached.id)).toBeNull(); // out of scope
    expect(await authoriseEvidenceAccess(people.Learner.actor, requestId, attached.id)).toBeNull();
    expect(await authoriseEvidenceAccess(people.Rita.actor, "nope", attached.id)).toBeNull();

    await logEvidenceAccess(people.Rita.actor, requestId, attached.id, people.Learner.id);
    const log = await db.evidenceAccessLog.findMany({ where: { evidenceId: attached.id } });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ reviewerId: people.Rita.id, reviewRequestId: requestId, learnerId: people.Learner.id, action: "VIEW_FILE" });
    await releaseRequest(people.Rita.actor, requestId);
    await db.evidenceItem.deleteMany({ where: { id: { in: [attached.id, unrelated.id] } } });
    await db.submissionFile.deleteMany({ where: { id: { in: [file.id, file2.id] } } });
  }, 120_000);
});

describe("accounts and history", () => {
  it("keeps a review (with the reviewer's name) after the reviewer's account is deleted, and removes a learner's reviews with the learner", async () => {
    const review = await db.assessmentReview.findFirstOrThrow({ where: { reviewerId: people.Rita.id } });
    await db.user.delete({ where: { id: people.Rita.id } });
    const kept = await db.assessmentReview.findUniqueOrThrow({ where: { id: review.id } });
    expect(kept.reviewerId).toBeNull();
    expect(kept.reviewerLabel).toBe("Rita"); // the audit trail still says who decided

    await db.user.delete({ where: { id: people.Learner.id } }); // account deletion still works with reviews, requests and competencies
    expect(await db.assessmentReview.count({ where: { userId: people.Learner.id } })).toBe(0);
    expect(await db.reviewRequest.count({ where: { userId: people.Learner.id } })).toBe(0);
    expect(await db.skillCompetency.count({ where: { userId: people.Learner.id } })).toBe(0);
  });
});
