import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAnalytics } from "@/lib/analytics/service";
import { assessSubmission } from "@/lib/assessments/service";
import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { getDashboardData } from "@/lib/dashboard";
import { createEvidence } from "@/lib/evidence/service";
import { ensureLearnerSetup, getTotalXp, listMissions } from "@/lib/missions/service";
import { startMission, submitMission } from "@/lib/missions/progress";
import { addFromMission, listSuggestions } from "@/lib/portfolio/service";
import { placementFromPercentage } from "@/lib/plan/baseline";
import { personalisedLearningEnabled } from "@/lib/plan/flag";
import { completeOnboarding, getOnboardingState, onboardingRedirectFor, saveOnboarding, skipBaseline, startBaseline } from "@/lib/plan/onboarding";
import { onboardingSchema, type OnboardingInput } from "@/lib/plan/schema";
import { requestReview } from "@/lib/reviews/service";
import { LEVEL0 } from "../prisma/curriculum/level0";
import { missionProblems } from "../prisma/curriculum/validate";

const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `onb-test-${n}@example.test`;
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
const BASE_CODE = "ZZB-L0-01";

const input = (over: Partial<OnboardingInput> = {}): OnboardingInput => ({
  experience: "BEGINNER",
  goals: [{ departmentCode: "fswd", weight: 3, targetLevel: 1, note: "I want to build websites." }, { departmentCode: "sec", weight: 2, targetLevel: 1, note: "" }],
  sessionMinutes: 45, weekdays: [1, 3, 5], startTime: "18:00", timezone: "Africa/Accra", durationKind: "ONE_MONTH", startDate: "2026-12-01", ...over,
});

async function account(name: string, mode: "on" | "off") {
  const before = process.env.PERSONALISED_LEARNING;
  if (mode === "on") process.env.PERSONALISED_LEARNING = "on";
  else delete process.env.PERSONALISED_LEARNING;
  try {
    const r = await registerUser({ displayName: name, email: mail(name.toLowerCase()), password: PASSWORD });
    if (!r.ok) throw new Error("registration failed");
    return r.userId;
  } finally {
    if (before === undefined) delete process.env.PERSONALISED_LEARNING;
    else process.env.PERSONALISED_LEARNING = before;
  }
}

let legacy = "";
let learner = "";
let other = "";

beforeAll(async () => {
  await cleanup();
  seed();
  // A baseline mission of our own (curriculum-shaped, published, XP 0, no skills) in the real fswd department.
  const dept = await db.department.findUniqueOrThrow({ where: { code: "fswd" } });
  const mission = await db.mission.create({
    data: {
      code: BASE_CODE, departmentId: dept.id, role: "BASELINE", xpReward: 0, status: "PUBLISHED", isPublished: true, sortOrder: 99, title: "Where do I start? (baseline)",
      objective: "Show what you can already do.", durationMinutes: 30, requiredTools: [], experimentChallenge: "e", submissionRequirements: "Share what you built.", remediation: "r",
    },
  });
  const rubric = await db.assessmentRubric.create({ data: { missionId: mission.id, passingScore: 70, version: 1 } });
  await db.rubricCriterion.createMany({ data: [{ rubricId: rubric.id, position: 1, name: "Structure", description: "Clean structure", maxPoints: 50 }, { rubricId: rubric.id, position: 2, name: "Behaviour", description: "Works as described", maxPoints: 50 }] });

  legacy = await account("Legacy", "off");
  learner = await account("Learner", "on");
  other = await account("Other", "on");
}, 240_000);

async function cleanup() {
  await db.user.deleteMany({ where: { email: { startsWith: "onb-test" } } });
  await db.mission.deleteMany({ where: { code: BASE_CODE } });
}

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("placement and validation (pure)", () => {
  it("places by percentage: advisory, content only", () => {
    expect(placementFromPercentage(0, [0, 1])).toEqual({ level: 0, foundationReview: true });
    expect(placementFromPercentage(39, [0, 1])).toEqual({ level: 0, foundationReview: true });
    expect(placementFromPercentage(40, [0, 1])).toEqual({ level: 0, foundationReview: false });
    expect(placementFromPercentage(69, [0, 1])).toEqual({ level: 0, foundationReview: false });
    expect(placementFromPercentage(70, [0, 1])).toEqual({ level: 1, foundationReview: false });
    expect(placementFromPercentage(100, [0, 1, 2])).toEqual({ level: 1, foundationReview: false });
    expect(placementFromPercentage(95, [0])).toEqual({ level: 0, foundationReview: false }); // nothing above Level 0 is published
    expect(placementFromPercentage(250, [0, 3])).toEqual({ level: 3, foundationReview: false }); // out-of-range input is clamped
  });

  it("validates onboarding answers", () => {
    expect(onboardingSchema.safeParse(input()).success).toBe(true);
    const bad = (over: Partial<OnboardingInput>) => onboardingSchema.safeParse(input(over)).success;
    expect(bad({ goals: [] })).toBe(false);
    expect(bad({ goals: Array.from({ length: 6 }, (_, i) => ({ departmentCode: `d${i}`, weight: 1, targetLevel: 1, note: "" })) })).toBe(false);
    expect(bad({ goals: [{ departmentCode: "fswd", weight: 3, targetLevel: 1, note: "" }, { departmentCode: "fswd", weight: 1, targetLevel: 1, note: "" }] })).toBe(false); // duplicate subject
    expect(bad({ goals: [{ departmentCode: "fswd", weight: 6, targetLevel: 1, note: "" }] })).toBe(false);
    expect(bad({ goals: [{ departmentCode: "fswd", weight: 0, targetLevel: 1, note: "" }] })).toBe(false);
    expect(bad({ sessionMinutes: 10 })).toBe(false);
    expect(bad({ sessionMinutes: 300 })).toBe(false);
    expect(bad({ weekdays: [] })).toBe(false);
    expect(bad({ weekdays: [1, 1] })).toBe(false);
    expect(bad({ weekdays: [7] })).toBe(false);
    expect(bad({ startTime: "25:00" })).toBe(false);
    expect(bad({ timezone: "Mars/Olympus" })).toBe(false);
    expect(bad({ startDate: "2026-02-31" })).toBe(false);
    expect(bad({ durationKind: "CUSTOM" })).toBe(false); // custom needs a number of days
    expect(bad({ durationKind: "CUSTOM", customDays: 3 })).toBe(false);
    expect(bad({ durationKind: "CUSTOM", customDays: 45 })).toBe(true);
    expect(bad({ goals: [{ departmentCode: "fswd", weight: 1, targetLevel: 1, note: "password: hunter2hunter2" }] })).toBe(false); // secret scan on free text
  });

  it("holds baseline missions to the rules: XP 0 and no skills", () => {
    const m = JSON.parse(JSON.stringify(LEVEL0[0].missions[0]));
    m.role = "BASELINE";
    expect(missionProblems(m).join(" ")).toMatch(/xp 0/);
    expect(missionProblems(m).join(" ")).toMatch(/must not teach skills/);
    m.xp = 0;
    m.skills = [];
    expect(missionProblems(m)).toEqual([]);
    m.role = "LESSON";
    expect(missionProblems(m).join(" ")).toMatch(/at least one skill/); // a lesson without skills is still invalid
  });
});

describe("learner mode and the rollout flag", () => {
  it("is OFF unless explicitly on", () => {
    delete process.env.PERSONALISED_LEARNING;
    expect(personalisedLearningEnabled()).toBe(false);
    process.env.PERSONALISED_LEARNING = "true";
    expect(personalisedLearningEnabled()).toBe(false);
    process.env.PERSONALISED_LEARNING = "on";
    expect(personalisedLearningEnabled()).toBe(true);
    delete process.env.PERSONALISED_LEARNING;
  });

  it("with the flag off a new account is the original programme: LEGACY, COMPLETE, Level 0 scheduled", async () => {
    expect(await db.profile.findUniqueOrThrow({ where: { userId: legacy } })).toMatchObject({ learnerMode: "LEGACY", onboardingStatus: "COMPLETE" });
    expect(await db.learnerMission.count({ where: { userId: legacy } })).toBe(18); // the baseline fixture is never scheduled
    expect(await onboardingRedirectFor(legacy)).toBeNull();
    expect((await listMissions(legacy)).some((m) => m.code === BASE_CODE)).toBe(false);
  });

  it("with the flag on a new account is PERSONALISED and not given the fixed schedule", async () => {
    expect(await db.profile.findUniqueOrThrow({ where: { userId: learner } })).toMatchObject({ learnerMode: "PERSONALISED", onboardingStatus: "NOT_STARTED" });
    expect(await db.learnerMission.count({ where: { userId: learner } })).toBe(0);
    await ensureLearnerSetup(learner); // must not quietly schedule it
    expect(await db.learnerMission.count({ where: { userId: learner } })).toBe(0);
    expect(await db.learnerDepartment.count({ where: { userId: learner } })).toBe(9);
    expect(await onboardingRedirectFor(learner)).toBe("/onboarding");
  });

  it("existing accounts keep working: a user with no profile row is not forced anywhere", async () => {
    expect(await onboardingRedirectFor("no-such-user")).toBeNull();
  });
});

describe("onboarding service", () => {
  it("saves one draft plan with goals, and saving again replaces it instead of adding another", async () => {
    expect(await saveOnboarding(learner, input())).toEqual({ ok: true });
    let state = (await getOnboardingState(learner))!;
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.draft).toMatchObject({ experience: "BEGINNER", sessionMinutes: 45, weekdays: [1, 3, 5], startTime: "18:00", durationDays: 30, startDate: "2026-12-01" });
    expect(state.draft!.goals.map((g) => g.departmentCode).sort()).toEqual(["fswd", "sec"]);

    expect(await saveOnboarding(learner, input({ experience: "ADVANCED", goals: [{ departmentCode: "ai", weight: 5, targetLevel: 2, note: "" }], durationKind: "CUSTOM", customDays: 21 }))).toEqual({ ok: true });
    state = (await getOnboardingState(learner))!;
    expect(state.draft).toMatchObject({ experience: "ADVANCED", durationDays: 21 });
    expect(state.draft!.goals).toEqual([{ departmentCode: "ai", weight: 5, targetLevel: 2, note: "" }]);
    expect(await db.learningPlan.count({ where: { userId: learner } })).toBe(1);
    const plan = await db.learningPlan.findFirstOrThrow({ where: { userId: learner } });
    expect(plan.endDate.toISOString().slice(0, 10)).toBe("2026-12-21"); // 21 days inclusive of the start date
    expect(plan.draftKey).toBe(learner);
  });

  it("refuses bad input, unknown subjects, secrets in notes, and accounts that are not personalised", async () => {
    expect((await saveOnboarding(learner, input({ goals: [] }))).ok).toBe(false);
    expect((await saveOnboarding(learner, input({ goals: [{ departmentCode: "nope", weight: 1, targetLevel: 1, note: "" }] }))).ok).toBe(false);
    const secret = await saveOnboarding(learner, input({ goals: [{ departmentCode: "fswd", weight: 1, targetLevel: 1, note: "api_key=abcdef1234567890" }] }));
    expect(secret.ok).toBe(false);
    expect((await saveOnboarding(legacy, input())).ok).toBe(false); // original-programme learners are never put through onboarding
    expect(await db.learningPlan.count({ where: { userId: legacy } })).toBe(0);
  });

  it("keeps each learner's plan private", async () => {
    expect((await getOnboardingState(other))!.draft).toBeNull();
    expect(await saveOnboarding(other, input({ goals: [{ departmentCode: "photo", weight: 1, targetLevel: 0, note: "" }] }))).toEqual({ ok: true });
    expect((await getOnboardingState(learner))!.draft!.goals.map((g) => g.departmentCode)).toEqual(["ai"]);
    expect((await getOnboardingState(other))!.draft!.goals.map((g) => g.departmentCode)).toEqual(["photo"]);
    expect((await startBaseline(other, "fswd")).ok).toBe(false); // fswd is not one of other's goals
  });

  it("enforces the plan rules in the database too", async () => {
    const plan = await db.learningPlan.findFirstOrThrow({ where: { userId: learner } });
    const data = { userId: learner, durationKind: "ONE_MONTH" as const, durationDays: 30, startDate: new Date("2026-12-01"), endDate: new Date("2026-12-30"), timezone: "UTC", experience: "BEGINNER" as const, sessionMinutes: 30, weekdays: [1], startTime: "09:00" };
    await expect(db.learningPlan.create({ data: { ...data, status: "DRAFT", draftKey: learner } })).rejects.toThrow(); // a second draft
    await expect(db.learningPlan.create({ data: { ...data, status: "DRAFT", draftKey: null } })).rejects.toThrow(); // DRAFT without its key
    await expect(db.learningPlan.create({ data: { ...data, status: "ACTIVE", activeKey: other } })).rejects.toThrow(); // another user's key
    await expect(db.learningPlan.update({ where: { id: plan.id }, data: { sessionMinutes: 5 } })).rejects.toThrow();
    await expect(db.learningPlan.update({ where: { id: plan.id }, data: { weekdays: [9] } })).rejects.toThrow();
    await expect(db.learningPlan.update({ where: { id: plan.id }, data: { weekdays: [] } })).rejects.toThrow();
    await expect(db.learningGoal.updateMany({ where: { planId: plan.id }, data: { weight: 9 } })).rejects.toThrow();
  });

  it("cannot finish without a saved goal, and finishing releases the redirect", async () => {
    expect((await completeOnboarding(other)).ok).toBe(true); // other saved goals above
    expect(await onboardingRedirectFor(other)).toBeNull();
    const fresh = await account("Fresh", "on");
    expect((await completeOnboarding(fresh)).ok).toBe(false);
    expect(await onboardingRedirectFor(fresh)).toBe("/onboarding");
  });
});

describe("baseline: placement only, never earned", () => {
  const EXPLAIN = "I completed every step and tested the edge cases carefully.";

  it("offers a baseline only where one is published, and says so otherwise", async () => {
    await saveOnboarding(learner, input()); // fswd + sec again
    const state = (await getOnboardingState(learner))!;
    expect(state.baselineAvailable).toEqual(["fswd"]);
    const none = await startBaseline(learner, "sec");
    expect(none).toMatchObject({ ok: false });
    expect(JSON.stringify(none)).toMatch(/Level 0/);
  });

  it("assesses like any mission but records only advisory placement", async () => {
    const started = await startBaseline(learner, "fswd");
    expect(started).toEqual({ ok: true, missionCode: BASE_CODE });
    expect((await startBaseline(learner, "fswd")).ok).toBe(true); // idempotent while not assessed
    expect(await db.baselineAssessment.count({ where: { userId: learner } })).toBe(1);

    const lm = await db.learnerMission.findFirstOrThrow({ where: { userId: learner, mission: { code: BASE_CODE } } });
    const ev = await createEvidence(learner, { title: "Proof", departmentCode: "fswd", kind: "Link", description: "", linkUrl: "https://github.com/jokzet/work", capturedDate: "2026-12-01" }, undefined, lm.id);
    if (!ev.ok) throw new Error(ev.error);
    const sent = await submitMission(learner, lm.id, { explanation: EXPLAIN, githubUrl: "", liveUrl: "" });
    if (!sent.ok) throw new Error(sent.error);
    const submission = await db.submission.findFirstOrThrow({ where: { learnerMissionId: lm.id } });
    const criteria = await db.rubricCriterion.findMany({ where: { rubric: { mission: { code: BASE_CODE } } }, orderBy: { position: "asc" } });
    const result = await assessSubmission(learner, submission.id, { scores: [{ criterionId: criteria[0].id, points: 50 }, { criterionId: criteria[1].id, points: 40 }] });
    expect(result).toMatchObject({ ok: true, outcome: "PASS", percentage: 90, xpAwarded: 0 });

    // Placement is recorded...
    expect(await db.baselineAssessment.findFirstOrThrow({ where: { userId: learner } })).toMatchObject({ status: "ASSESSED", percentage: 90, placementLevel: 0 }); // only Level 0 is published, so 0
    // ...and nothing was earned.
    expect(await getTotalXp(learner)).toBe(0);
    expect(await db.userSkill.count({ where: { userId: learner } })).toBe(0);
    expect(await db.learnerMission.findUniqueOrThrow({ where: { id: lm.id } })).toMatchObject({ xpAwarded: 0 });
    expect((await startBaseline(learner, "fswd")).ok).toBe(false); // already done
    expect((await skipBaseline(learner, "fswd")).ok).toBe(false); // a finished baseline is never overwritten
  });

  it("never appears in anything that measures achievement", async () => {
    const dash = await getDashboardData(learner);
    expect(dash.assessmentsPassed).toBe(0);
    expect(dash.missions.some((m) => m.code === BASE_CODE)).toBe(false);
    expect((await listMissions(learner)).some((m) => m.code === BASE_CODE)).toBe(false);

    const analytics = await getAnalytics(learner);
    expect(analytics.totals).toMatchObject({ assessments: 0, missionsCompleted: 0, skills: 0 });
    expect(analytics.performance).toEqual([]);

    expect(await listSuggestions(learner)).toEqual([]);
    expect((await addFromMission(learner, BASE_CODE)).ok).toBe(false);
  });

  it("cannot be sent for human review", async () => {
    const assessment = await db.assessment.findFirstOrThrow({ where: { userId: learner } });
    expect(await requestReview(learner, assessment.id)).toMatchObject({ ok: false });
    expect(await db.reviewRequest.count({ where: { userId: learner } })).toBe(0);
  });

  it("can be skipped, and a baseline for a dropped subject disappears with the subject", async () => {
    expect((await skipBaseline(other, "photo")).ok).toBe(true); // photo has no baseline: nothing to record
    expect(await db.baselineAssessment.count({ where: { userId: other } })).toBe(0);
    await saveOnboarding(other, input({ goals: [{ departmentCode: "fswd", weight: 2, targetLevel: 1, note: "" }] }));
    expect((await skipBaseline(other, "fswd")).ok).toBe(true);
    expect((await getOnboardingState(other))!.baselines.map((b) => b.status)).toEqual(["SKIPPED"]);
    await saveOnboarding(other, input({ goals: [{ departmentCode: "ai", weight: 2, targetLevel: 1, note: "" }] }));
    expect(await db.baselineAssessment.count({ where: { userId: other } })).toBe(0); // fswd was dropped and never attempted
  });

  it("leaves ordinary lessons exactly as they were: they still earn XP and skills", async () => {
    await startMission(legacy, "FSWD-L0-01");
    const lm = await db.learnerMission.findFirstOrThrow({ where: { userId: legacy, mission: { code: "FSWD-L0-01" } } });
    const ev = await createEvidence(legacy, { title: "Proof", departmentCode: "fswd", kind: "Link", description: "", linkUrl: "https://github.com/jokzet/work", capturedDate: "2026-12-01" }, undefined, lm.id);
    if (!ev.ok) throw new Error(ev.error);
    await submitMission(legacy, lm.id, { explanation: EXPLAIN, githubUrl: "", liveUrl: "" });
    const submission = await db.submission.findFirstOrThrow({ where: { learnerMissionId: lm.id } });
    const criteria = await db.rubricCriterion.findMany({ where: { rubric: { mission: { code: "FSWD-L0-01" } } }, orderBy: { position: "asc" } });
    const r = await assessSubmission(legacy, submission.id, { scores: criteria.map((c) => ({ criterionId: c.id, points: c.maxPoints })) });
    expect(r).toMatchObject({ ok: true, outcome: "PASS" });
    expect((r as { xpAwarded: number }).xpAwarded).toBeGreaterThan(0);
    expect(await db.userSkill.count({ where: { userId: legacy } })).toBeGreaterThan(0);
    expect((await getDashboardData(legacy)).assessmentsPassed).toBe(1);
  });
});
