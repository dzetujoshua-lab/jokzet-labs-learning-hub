import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { waitForWindowRoom } from "./helpers/window";
import { db } from "@/lib/db";
import {
  acceptRecommendation, attachRubricTemplate, createPersonalActivity, dismissRecommendation, getActivityDetail, listActivities,
  listRecommendations, refreshRecommendations, startActivity, type ActivityInput,
} from "@/lib/activities/service";
import { deriveRecommendations, MAX_OPEN_RECOMMENDATIONS } from "@/lib/activities/recommend";
import { RUBRIC_TEMPLATES, templateProblems } from "@/lib/activities/rubric-templates";
import { getAnalytics } from "@/lib/analytics/service";
import { assessSubmission } from "@/lib/assessments/service";
import { registerUser } from "@/lib/auth/service";
import { createEvidence } from "@/lib/evidence/service";
import { startMission, submitMission } from "@/lib/missions/progress";
import { deleteMission, getTotalXp } from "@/lib/missions/service";
import { LIMITS, bucketKey, rateLimitHit } from "@/lib/ratelimit";

const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `act-test-${n}@example.test`;
const EXPLAIN = "I completed every step and tested the edge cases carefully.";
let userA = "";
let userB = "";

const base = (over: Partial<ActivityInput> = {}): ActivityInput => ({
  title: "Build my portfolio site", departmentCode: "fswd", kind: "Build", evidenceType: "Screenshot", minutes: 90,
  objective: "Build and publish a one-page personal portfolio with my projects.", deliverables: "A live link and a screenshot.",
  instructions: "Plan the sections first, then build and test on my phone.", skillIds: [], rubricTemplate: "build", date: "", ...over,
});

async function create(userId: string, over: Partial<ActivityInput> = {}) {
  const r = await createPersonalActivity(userId, base(over));
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

/** Submits (with a link as evidence) and returns the new submission with its rubric criteria. */
async function submit(userId: string, learnerMissionId: string, departmentCode = "fswd") {
  const ev = await createEvidence(userId, { title: "Proof", departmentCode, kind: "Link", description: "", linkUrl: "https://github.com/jokzet/work", capturedDate: "2026-11-16" }, undefined, learnerMissionId);
  if (!ev.ok) throw new Error(ev.error);
  const sent = await submitMission(userId, learnerMissionId, { explanation: EXPLAIN, githubUrl: "", liveUrl: "" });
  if (!sent.ok) throw new Error(sent.error);
  const submission = await db.submission.findFirstOrThrow({ where: { learnerMissionId, attempt: sent.attempt } });
  const lm = await db.learnerMission.findUniqueOrThrow({ where: { id: learnerMissionId }, include: { mission: { include: { rubric: { include: { criteria: { orderBy: { position: "asc" } } } } } } } });
  return { submission, criteria: lm.mission.rubric!.criteria };
}

async function assessCurriculum(userId: string, code: string, points: number[]) {
  await startMission(userId, code);
  const lm = await db.learnerMission.findFirstOrThrow({ where: { userId, mission: { code } } });
  const { submission, criteria } = await submit(userId, lm.id, code.startsWith("SEC") ? "sec" : "fswd");
  return assessSubmission(userId, submission.id, { scores: criteria.map((c, i) => ({ criterionId: c.id, points: points[i] })) });
}

async function clearBuckets() {
  await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "activity:" } } });
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "act-test" } } });
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
  await clearBuckets();
  const a = await registerUser({ displayName: "A", email: mail("a"), password: PASSWORD });
  const b = await registerUser({ displayName: "B", email: mail("b"), password: PASSWORD });
  if (!a.ok || !b.ok) throw new Error("registration failed");
  userA = a.userId;
  userB = b.userId;
}, 180_000);

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "act-test" } } });
  await clearBuckets();
  await db.$disconnect();
});

describe("rubric templates", () => {
  it("are all valid: unique keys, at least three criteria, whole points totalling 100", () => {
    expect(new Set(RUBRIC_TEMPLATES.map((t) => t.key)).size).toBe(RUBRIC_TEMPLATES.length);
    for (const t of RUBRIC_TEMPLATES) expect(templateProblems(t), t.key).toEqual([]);
    expect(templateProblems({ ...RUBRIC_TEMPLATES[0], criteria: [["a", "b", 50], ["c", "d", 40], ["e", "f", 5]] }).join()).toMatch(/sum to 95/);
  });
});

describe("recommendation rules (pure and deterministic)", () => {
  const d = (n: number) => new Date(`2026-11-${String(10 + n).padStart(2, "0")}T10:00:00Z`);
  const a = (id: string, mission: string, day: number, weaknesses: string[]) => ({ id, assessedAt: d(day), missionId: mission, missionTitle: `Mission ${mission}`, weaknesses });

  it("offers corrections before weak criteria, newest first, one offer per mission, with a stated reason", () => {
    const input = {
      assessments: [a("a1", "m1", 1, ["Testing"]), a("a2", "m2", 3, ["Docs"]), a("a3", "m3", 2, [])],
      openCorrections: [{ assessmentId: "a9", assessedAt: d(2), missionId: "m2", missionTitle: "Mission m2" }],
      alreadyRecommended: new Set<string>(),
      openOffers: 0,
    };
    const out = deriveRecommendations(input);
    expect(out.map((c) => [c.missionId, c.reasonCode])).toEqual([["m2", "OPEN_CORRECTION"], ["m1", "WEAK_CRITERION"]]);
    expect(out[0].reasonDetail).toMatch(/unresolved correction/);
    expect(out[1].reasonDetail).toMatch(/Testing/);
    expect(deriveRecommendations(input)).toEqual(out); // same inputs, same offers
  });

  it("never re-offers a mission that already has a recommendation, and respects the open-offer cap", () => {
    const all = Array.from({ length: 9 }, (_, i) => a(`a${i}`, `m${i}`, i, ["x"]));
    expect(deriveRecommendations({ assessments: all, openCorrections: [], alreadyRecommended: new Set(["m8"]), openOffers: 0 })).toHaveLength(MAX_OPEN_RECOMMENDATIONS);
    expect(deriveRecommendations({ assessments: all, openCorrections: [], alreadyRecommended: new Set(), openOffers: 3 })).toHaveLength(MAX_OPEN_RECOMMENDATIONS - 3);
    expect(deriveRecommendations({ assessments: all, openCorrections: [], alreadyRecommended: new Set(), openOffers: MAX_OPEN_RECOMMENDATIONS })).toEqual([]);
    expect(deriveRecommendations({ assessments: all.slice(0, 1), openCorrections: [], alreadyRecommended: new Set(["m0"]), openOffers: 0 })).toEqual([]);
  });

  it("offers nothing when there are no weaknesses or corrections", () => {
    expect(deriveRecommendations({ assessments: [a("a1", "m1", 1, [])], openCorrections: [], alreadyRecommended: new Set(), openOffers: 0 })).toEqual([]);
  });
});

describe("personal activities", () => {
  it("creates an owned, uncredited activity with its rubric, and rejects bad input", async () => {
    const skill = await db.skill.findFirstOrThrow({ where: { department: { code: "fswd" } } });
    const id = await create(userA, { skillIds: [skill.id], date: "2026-11-20" });
    const lm = await db.learnerMission.findUniqueOrThrow({ where: { id }, include: { mission: { include: { rubric: { include: { criteria: true } }, skills: true } } } });
    expect(lm.mission).toMatchObject({ category: "PERSONAL_ACTIVITY", origin: "LEARNER_CREATED", createdById: userA, xpReward: 0, isPublished: false, code: null });
    expect(lm.mission.skills).toHaveLength(1);
    expect(lm.mission.rubric?.criteria.reduce((s, c) => s + c.maxPoints, 0)).toBe(100);
    expect(lm.mission.rubric?.criteria).toHaveLength(4);

    const otherDept = await db.skill.findFirstOrThrow({ where: { department: { code: "uxui" } } });
    for (const [label, over, pattern] of [
      ["short objective", { objective: "short" }, /at least 10 characters/],
      ["bad department", { departmentCode: "nope" }, /department/i],
      ["skill from another department", { skillIds: [otherDept.id] }, /belong to the chosen department/],
      ["secret in title", { title: "pass" + "word = hunter2hunter2" }, /secret|password/i],
      ["secret in instructions", { instructions: "use my " + "pass" + "word = hunter2hunter2" }, /secret|password/i],
      ["too many minutes", { minutes: 9999 }, /at most 480/i],
    ] as const) {
      const r = await createPersonalActivity(userA, base(over as Partial<ActivityInput>));
      expect(r.ok, label).toBe(false);
      if (!r.ok) expect(r.error, label).toMatch(pattern);
    }
  });

  it("belongs to its owner only and never shows up as, or alongside, curriculum", async () => {
    const id = await create(userA, { title: "Only mine" });
    expect((await listActivities(userA)).some((x) => x.id === id)).toBe(true);
    expect(await listActivities(userB)).toEqual([]);
    expect(await getActivityDetail(userB, id)).toBeNull();
    expect(await startActivity(userB, id)).toBe(false);
    expect(await attachRubricTemplate(userB, id, "study")).toMatchObject({ ok: false });
    expect(await deleteMission(userB, id)).toBe(false);

    // A curriculum mission is not an activity: the workspace refuses it, and the catalogue stays at 18.
    await startMission(userA, "FSWD-L0-02");
    const curriculumLm = await db.learnerMission.findFirstOrThrow({ where: { userId: userA, mission: { code: "FSWD-L0-02" } } });
    expect(await getActivityDetail(userA, curriculumLm.id)).toBeNull();
    expect(await db.mission.count({ where: { category: "CURRICULUM_MISSION" } })).toBe(18);
  });

  it("starts, accepts a rubric later when it had none, and refuses to attach twice or after a submission", async () => {
    const id = await create(userA, { title: "No rubric yet", rubricTemplate: "none" });
    expect((await db.learnerMission.findUniqueOrThrow({ where: { id }, include: { mission: { include: { rubric: true } } } })).mission.rubric).toBeNull();
    expect(await startActivity(userA, id)).toBe(true);
    expect(await startActivity(userA, id)).toBe(false); // already started
    expect(await attachRubricTemplate(userA, id, "nonsense")).toMatchObject({ ok: false });
    expect(await attachRubricTemplate(userA, id, "study")).toEqual({ ok: true });
    expect(await attachRubricTemplate(userA, id, "study")).toMatchObject({ ok: false, error: expect.stringMatching(/already has a rubric/) });
  });

  it("is protected from the database side too: only learner-owned rows may be activities", async () => {
    const dept = await db.department.findUniqueOrThrow({ where: { code: "fswd" } });
    const data = { departmentId: dept.id, title: "x", objective: "o", durationMinutes: 30, requiredTools: [] as string[] };
    await expect(db.mission.create({ data: { ...data, code: "ZZA-L0-01", createdById: userA } })).rejects.toThrow(); // curriculum category but owned
    await expect(db.mission.create({ data: { ...data, category: "PERSONAL_ACTIVITY" } })).rejects.toThrow(); // personal but unowned
  });

  it("limits how fast activities can be created", async () => {
    await waitForWindowRoom(60 * 60);
    const key = bucketKey("activity:create", userB);
    for (let i = 0; i < LIMITS.activityCreateUser.limit; i++) await rateLimitHit(key, LIMITS.activityCreateUser);
    const r = await createPersonalActivity(userB, base());
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/very quickly/) });
    await clearBuckets();
  });

  it("can be deleted until work is submitted, and never afterwards", async () => {
    const id = await create(userA, { title: "Will be deleted" });
    expect(await deleteMission(userA, id)).toBe(true);
    const kept = await create(userA, { title: "Has work" });
    await startActivity(userA, kept);
    await submit(userA, kept);
    expect(await deleteMission(userA, kept)).toBe(false);
    expect(await db.learnerMission.count({ where: { id: kept } })).toBe(1);
  });
});

describe("credit: practice earns neither XP nor skills and never replaces a curriculum mission", () => {
  it("assesses a personal activity against its rubric without XP, skills or curriculum progress", async () => {
    const skill = await db.skill.findFirstOrThrow({ where: { department: { code: "fswd" } } });
    const xpBefore = await getTotalXp(userA);
    const skillsBefore = await db.userSkill.count({ where: { userId: userA } });
    const curriculumBefore = await db.learnerMission.count({ where: { userId: userA, mission: { category: "CURRICULUM_MISSION" }, status: { in: ["PASSED", "COMPLETED"] } } });

    const id = await create(userA, { title: "Credit check", skillIds: [skill.id] });
    await startActivity(userA, id);
    const { submission, criteria } = await submit(userA, id);
    const result = await assessSubmission(userA, submission.id, { scores: criteria.map((c) => ({ criterionId: c.id, points: c.maxPoints })) });
    expect(result).toMatchObject({ ok: true, outcome: "PASS", percentage: 100, xpAwarded: 0 });

    expect((await db.learnerMission.findUniqueOrThrow({ where: { id } })).status).toBe("PASSED"); // recorded as passed
    expect(await getTotalXp(userA)).toBe(xpBefore);
    expect(await db.userSkill.count({ where: { userId: userA } })).toBe(skillsBefore);
    expect(await db.learnerMission.count({ where: { userId: userA, mission: { category: "CURRICULUM_MISSION" }, status: { in: ["PASSED", "COMPLETED"] } } })).toBe(curriculumBefore);
    const assessment = await db.assessment.findUniqueOrThrow({ where: { submissionId: submission.id } });
    expect(assessment).toMatchObject({ assessorKind: "SELF", status: "SELF_RECORDED" });
  });

  it("keeps practice out of the headline analytics and reports it separately", async () => {
    const before = await getAnalytics(userB);
    const id = await create(userB, { title: "Analytics check" });
    await startActivity(userB, id);
    const { submission, criteria } = await submit(userB, id);
    await assessSubmission(userB, submission.id, { scores: criteria.map((c) => ({ criterionId: c.id, points: c.maxPoints })) });
    const after = await getAnalytics(userB);
    expect(after.totals.missionsCompleted).toBe(before.totals.missionsCompleted);
    expect(after.totals.assessments).toBe(before.totals.assessments);
    expect(after.totals.minutes).toBe(before.totals.minutes);
    expect(after.practice.personal).toMatchObject({ completed: before.practice.personal.completed + 1, assessed: before.practice.personal.assessed + 1 });
    expect(after.practice.challenges.completed).toBe(0);
  });
});

describe("recommended challenges", () => {
  it("are offered from the learner's own assessments, with reasons, and only once", async () => {
    // L0-01 passes with one weak criterion; L0-02 comes back for revision (an open correction).
    expect(await assessCurriculum(userA, "FSWD-L0-01", [25, 30, 5, 25])).toMatchObject({ ok: true, outcome: "PASS" });
    expect(await assessCurriculum(userA, "FSWD-L0-02", [10, 10, 10, 10])).toMatchObject({ ok: true, outcome: "REVISE" });

    expect(await refreshRecommendations(userA)).toBeGreaterThanOrEqual(2);
    const offers = await listRecommendations(userA);
    const reasons = offers.map((o) => o.reasonCode);
    expect(reasons).toContain("OPEN_CORRECTION");
    expect(reasons).toContain("WEAK_CRITERION");
    expect(reasons.indexOf("OPEN_CORRECTION")).toBeLessThan(reasons.indexOf("WEAK_CRITERION")); // corrections first
    for (const o of offers) expect(o.reasonDetail.length).toBeGreaterThan(10);
    expect(await refreshRecommendations(userA)).toBe(0); // idempotent
    expect(await db.activityRecommendation.count({ where: { userId: userA, status: "OFFERED" } })).toBe(offers.length);

    expect(await refreshRecommendations(userB)).toBe(0); // nothing is derived from someone else's work
    expect(await listRecommendations(userB)).toEqual([]);
  }, 120_000);

  it("can only be accepted or dismissed by their owner", async () => {
    const [offer] = await listRecommendations(userA);
    expect(await acceptRecommendation(userB, offer.id)).toMatchObject({ ok: false });
    expect(await dismissRecommendation(userB, offer.id)).toBe(false);
    expect(await db.activityRecommendation.findUniqueOrThrow({ where: { id: offer.id } })).toMatchObject({ status: "OFFERED" });
  });

  it("when accepted become the learner's own optional challenge: same rubric standard, no XP, source untouched", async () => {
    const offer = (await listRecommendations(userA)).find((o) => o.reasonCode === "WEAK_CRITERION")!;
    const rec = await db.activityRecommendation.findUniqueOrThrow({ where: { id: offer.id }, include: { mission: { include: { rubric: { include: { criteria: { orderBy: { position: "asc" } } } } } } } });
    const sourceLmBefore = await db.learnerMission.findFirstOrThrow({ where: { userId: userA, missionId: rec.missionId } });

    const accepted = await acceptRecommendation(userA, offer.id);
    if (!accepted.ok) throw new Error(accepted.error);

    const lm = await db.learnerMission.findUniqueOrThrow({ where: { id: accepted.id }, include: { mission: { include: { rubric: { include: { criteria: { orderBy: { position: "asc" } } } } } } } });
    expect(lm.mission).toMatchObject({ category: "RECOMMENDED_CHALLENGE", origin: "PLATFORM_RECOMMENDATION", createdById: userA, xpReward: 0, objective: rec.mission.experimentChallenge });
    expect(lm.mission.rubric!.criteria.map((c) => [c.name, c.maxPoints])).toEqual(rec.mission.rubric!.criteria.map((c) => [c.name, c.maxPoints]));
    expect(lm.mission.rubric!.passingScore).toBe(rec.mission.rubric!.passingScore);
    expect(await db.activityRecommendation.findUniqueOrThrow({ where: { id: offer.id } })).toMatchObject({ status: "ACCEPTED", acceptedLearnerMissionId: lm.id });
    // The mandatory mission it was derived from is exactly as it was.
    expect(await db.learnerMission.findUniqueOrThrow({ where: { id: sourceLmBefore.id } })).toMatchObject({ status: sourceLmBefore.status, xpAwarded: sourceLmBefore.xpAwarded });
    expect((await listActivities(userA)).find((x) => x.id === lm.id)?.category).toBe("RECOMMENDED_CHALLENGE");
    // Accepting again is refused.
    expect(await acceptRecommendation(userA, offer.id)).toMatchObject({ ok: false });
  });

  it("are not offered again once dismissed", async () => {
    const [offer] = await listRecommendations(userA);
    expect(await dismissRecommendation(userA, offer.id)).toBe(true);
    expect(await dismissRecommendation(userA, offer.id)).toBe(false);
    await refreshRecommendations(userA);
    expect((await listRecommendations(userA)).some((o) => o.id === offer.id)).toBe(false);
    expect(await db.activityRecommendation.count({ where: { userId: userA, missionId: (await db.activityRecommendation.findUniqueOrThrow({ where: { id: offer.id } })).missionId, status: "OFFERED" } })).toBe(0);
  });
});
