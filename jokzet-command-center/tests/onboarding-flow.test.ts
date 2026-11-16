import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { ensureLearnerSetup } from "@/lib/missions/service";
import { buildPlanForReview, confirmPlan, onboardingRedirectFor, saveOnboarding } from "@/lib/plan/onboarding";
import type { OnboardingInput } from "@/lib/plan/schema";
import { personalisedLearningEnabled } from "@/lib/plan/flag";

// The whole registration → onboarding → review → confirmation journey, on the real test database. Nothing here sets the
// rollout flag: personalised onboarding must be the default behaviour of a fresh deployment.
const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `flow-test-${n}@example.test`;
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });

const answers = (over: Partial<OnboardingInput> = {}): OnboardingInput => ({
  experience: "BEGINNER", goals: [{ departmentCode: "fswd", weight: 2, targetLevel: 1, note: "" }, { departmentCode: "sec", weight: 1, targetLevel: 1, note: "" }],
  sessionMinutes: 45, weekdays: [1, 3, 5], startTime: "18:00", timezone: "Africa/Accra", durationKind: "ONE_MONTH", startDate: "2026-12-07", ...over,
});

async function signUp(name: string) {
  const r = await registerUser({ displayName: name, email: mail(name.toLowerCase()), password: PASSWORD }, { adultConfirmed: true });
  if (!r.ok) throw new Error("registration failed");
  return r.userId;
}
const status = async (id: string) => (await db.profile.findUniqueOrThrow({ where: { userId: id } })).onboardingStatus;
const plans = (id: string, s: "DRAFT" | "ACTIVE") => db.learningPlan.count({ where: { userId: id, status: s } });

let a = "";
let b = "";

async function cleanup() {
  await db.user.deleteMany({ where: { email: { startsWith: "flow-test" } } });
  await db.department.deleteMany({ where: { code: "flowtest-empty" } });
}
beforeAll(async () => {
  delete process.env.PERSONALISED_LEARNING; // prove the default, not the test setup
  await cleanup();
  seed();
  a = await signUp("A");
  b = await signUp("B");
}, 300_000);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("registration", () => {
  it("is personalised by default and starts onboarding, with no legacy Level 0 timetable", async () => {
    expect(personalisedLearningEnabled()).toBe(true);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: a } })).toMatchObject({ learnerMode: "PERSONALISED", onboardingStatus: "IN_PROGRESS" });
    expect(await db.learnerMission.count({ where: { userId: a } })).toBe(0);
    expect(await db.scheduleConfig.count({ where: { userId: a } })).toBe(0);
    expect(await plans(a, "ACTIVE")).toBe(0);
  });

  it("keeps the learner out of the app until onboarding is confirmed", async () => {
    expect(await onboardingRedirectFor(a)).toBe("/onboarding");
  });

  it("never lets ensureLearnerSetup schedule the legacy Level 0 programme for a personalised learner", async () => {
    await ensureLearnerSetup(a);
    expect(await db.learnerMission.count({ where: { userId: a } })).toBe(0);
    expect(await db.scheduleConfig.count({ where: { userId: a } })).toBe(0);
  });
});

describe("answers", () => {
  it("rejects missing programmes, unknown programmes, duplicates, bad days, times and zones, changing nothing", async () => {
    for (const bad of [
      answers({ goals: [] }),
      answers({ goals: [{ departmentCode: "nope", weight: 1, targetLevel: 1, note: "" }] }),
      answers({ goals: [{ departmentCode: "fswd", weight: 1, targetLevel: 1, note: "" }, { departmentCode: "fswd", weight: 1, targetLevel: 1, note: "" }] }),
      answers({ weekdays: [] }),
      answers({ weekdays: [9] }),
      answers({ startTime: "25:99" }),
      answers({ timezone: "Mars/Olympus" }),
      answers({ durationKind: "CUSTOM", customDays: 2 }),
      answers({ sessionMinutes: 5 }),
    ]) {
      expect((await saveOnboarding(a, bad)).ok).toBe(false);
    }
    expect(await plans(a, "DRAFT")).toBe(0);
  });

  it("refuses a programme that has no published lessons", async () => {
    await db.department.create({ data: { code: "flowtest-empty", name: "Empty", icon: "Code2", color: "#000000", sortOrder: 999 } });
    const r = await saveOnboarding(a, answers({ goals: [{ departmentCode: "flowtest-empty", weight: 1, targetLevel: 1, note: "" }] }));
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toMatch(/no published lessons/);
  });

  it("will not build a plan before the answers are saved", async () => {
    expect((await buildPlanForReview(a)).ok).toBe(false);
    expect(await status(a)).toBe("IN_PROGRESS");
  });

  it("saves incrementally and a repeat keeps exactly one draft", async () => {
    expect(await saveOnboarding(a, answers())).toEqual({ ok: true });
    expect(await saveOnboarding(a, answers())).toEqual({ ok: true });
    expect(await plans(a, "DRAFT")).toBe(1);
  });
});

describe("plan generation and review", () => {
  it("builds the syllabus and timetable for review without starting anything", async () => {
    const r = await buildPlanForReview(a);
    expect(r.ok).toBe(true);
    expect(await status(a)).toBe("PLAN_REVIEW");
    expect(await plans(a, "ACTIVE")).toBe(0);
    expect(await onboardingRedirectFor(a)).toBe("/onboarding");
    expect(await db.reminderSettings.count({ where: { userId: a } })).toBe(0);
    expect(await db.learnerMission.count({ where: { userId: a } })).toBe(0);
  });

  it("generates real, non-overlapping sessions from the published curriculum, on study days only", async () => {
    const plan = await db.learningPlan.findFirstOrThrow({ where: { userId: a, status: "DRAFT" } });
    const items = await db.learningPlanItem.findMany({ where: { planId: plan.id } });
    expect(items.length).toBeGreaterThan(0);
    const slots = items.map((i) => `${i.date.toISOString().slice(0, 10)}#${i.slotIndex}`);
    expect(new Set(slots).size).toBe(slots.length); // no two sessions in one slot
    for (const i of items) expect(plan.weekdays).toContain(i.date.getUTCDay());
    const missionIds = items.map((i) => i.missionId).filter((m): m is string => !!m);
    const real = await db.mission.count({ where: { id: { in: missionIds }, isPublished: true } });
    expect(real).toBe(new Set(missionIds).size);
  });

  it("is idempotent: building again returns the same plan and never duplicates it", async () => {
    const before = await db.learningPlan.findFirstOrThrow({ where: { userId: a, status: "DRAFT" }, select: { id: true } });
    const again = await buildPlanForReview(a);
    expect(again).toMatchObject({ ok: true, planId: before.id });
    expect(await plans(a, "DRAFT")).toBe(1);
    expect(await status(a)).toBe("PLAN_REVIEW");
  });

  it("goes back to in-progress when the answers change, and refuses to confirm a plan that was not reviewed", async () => {
    expect(await saveOnboarding(a, answers({ durationKind: "THREE_MONTHS" }))).toEqual({ ok: true });
    expect(await status(a)).toBe("IN_PROGRESS");
    const r = await confirmPlan(a);
    expect(r.ok).toBe(false);
    expect(await plans(a, "ACTIVE")).toBe(0);
    expect((await buildPlanForReview(a)).ok).toBe(true);
    expect(await status(a)).toBe("PLAN_REVIEW");
  });

  it("refuses to confirm when the plan differs from what was reviewed", async () => {
    // The answers change underneath a review that is still open (a second tab): the stored plan is rebuilt and the learner reviews it again.
    await db.learningPlan.updateMany({ where: { userId: a, status: "DRAFT" }, data: { sessionMinutes: 60 } });
    const r = await confirmPlan(a);
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toMatch(/changed while you were reviewing/);
    expect(await plans(a, "ACTIVE")).toBe(0);
    await db.learningPlan.updateMany({ where: { userId: a, status: "DRAFT" }, data: { sessionMinutes: 45 } });
    await db.profile.update({ where: { userId: a }, data: { onboardingStatus: "PLAN_REVIEW" } });
    expect((await buildPlanForReview(a)).ok).toBe(true);
  });
});

describe("confirmation", () => {
  it("does not let another learner confirm someone else's plan", async () => {
    expect((await confirmPlan(b)).ok).toBe(false);
    expect(await plans(a, "ACTIVE")).toBe(0);
    expect(await plans(b, "ACTIVE")).toBe(0);
  });

  it("activates the reviewed plan once, completes onboarding and starts reminders", async () => {
    const r = await confirmPlan(a);
    expect(r.ok).toBe(true);
    expect(await status(a)).toBe("COMPLETE");
    expect(await plans(a, "ACTIVE")).toBe(1);
    expect(await plans(a, "DRAFT")).toBe(0);
    expect(await db.reminderSettings.count({ where: { userId: a } })).toBe(1);
    expect(await onboardingRedirectFor(a)).toBeNull();
    expect(await db.learnerMission.count({ where: { userId: a, status: "PASSED" } })).toBe(0); // nothing is credited by planning
  });

  it("is idempotent: a repeat or double click never creates a second active plan", async () => {
    const [x, y] = await Promise.all([confirmPlan(a), confirmPlan(a)]);
    expect(x.ok && y.ok).toBe(true);
    expect(await plans(a, "ACTIVE")).toBe(1);
  });

  it("no longer accepts onboarding answers or a rebuild once the programme is set up", async () => {
    expect((await saveOnboarding(a, answers())).ok).toBe(false);
    expect((await buildPlanForReview(a)).ok).toBe(false);
    expect(await plans(a, "ACTIVE")).toBe(1);
  });
});

describe("existing learners", () => {
  it("are not pushed back through onboarding", async () => {
    const legacy = await db.user.create({ data: { email: mail("legacy"), passwordHash: "x", profile: { create: { displayName: "Old", learnerMode: "LEGACY", onboardingStatus: "COMPLETE" } } } });
    expect(await onboardingRedirectFor(legacy.id)).toBeNull();
    const done = await db.user.create({ data: { email: mail("done"), passwordHash: "x", profile: { create: { displayName: "Done", learnerMode: "PERSONALISED", onboardingStatus: "COMPLETE" } } } });
    expect(await onboardingRedirectFor(done.id)).toBeNull();
  });

  it("an unfinished learner resumes where they were after any interruption", async () => {
    for (const s of ["IN_PROGRESS", "PLAN_GENERATING", "PLAN_REVIEW"] as const) {
      await db.profile.update({ where: { userId: b }, data: { onboardingStatus: s } });
      expect(await onboardingRedirectFor(b)).toBe("/onboarding");
    }
  });
});
