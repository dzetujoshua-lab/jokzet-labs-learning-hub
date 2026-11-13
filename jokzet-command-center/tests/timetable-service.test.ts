import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { finishOnboarding } from "@/lib/plan/finish";
import { saveOnboarding } from "@/lib/plan/onboarding";
import type { OnboardingInput } from "@/lib/plan/schema";
import { pausePlan, reconcilePlan } from "@/lib/plan/service";
import { getTimetable, timetableAccess } from "@/lib/plan/timetable-service";

const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `tt-test-${n}@example.test`;
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
const at = (iso: string, hhmm = "12:00") => new Date(`${iso}T${hhmm}:00.000Z`);
const day = (d: Date) => d.toISOString().slice(0, 10);

const answers = (over: Partial<OnboardingInput> = {}): OnboardingInput => ({
  experience: "BEGINNER", goals: [{ departmentCode: "fswd", weight: 2, targetLevel: 1, note: "" }, { departmentCode: "sec", weight: 1, targetLevel: 1, note: "" }],
  sessionMinutes: 45, dailyStudyMinutes: 100, breakMinutes: 10, weekdays: [1, 3, 5], startTime: "18:00", timezone: "Africa/Accra", durationKind: "ONE_MONTH", startDate: "2026-12-07", ...over,
});

async function account(name: string, flag = true) {
  const before = process.env.PERSONALISED_LEARNING;
  if (flag) process.env.PERSONALISED_LEARNING = "on";
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
async function withFlag<T>(on: boolean, fn: () => Promise<T>): Promise<T> {
  const before = process.env.PERSONALISED_LEARNING;
  if (on) process.env.PERSONALISED_LEARNING = "on";
  else delete process.env.PERSONALISED_LEARNING;
  try {
    return await fn();
  } finally {
    if (before === undefined) delete process.env.PERSONALISED_LEARNING;
    else process.env.PERSONALISED_LEARNING = before;
  }
}
const activePlanId = async (userId: string) => (await db.learningPlan.findFirstOrThrow({ where: { userId, status: "ACTIVE" } })).id;

let legacy = "";
let a = "";
let b = "";
let fresh = "";

beforeAll(async () => {
  await cleanup();
  seed();
  legacy = await account("Legacy", false);
  fresh = await account("Fresh");
  a = await account("A");
  b = await account("B");
  await saveOnboarding(a, answers());
  await saveOnboarding(b, answers({ goals: [{ departmentCode: "photo", weight: 1, targetLevel: 1, note: "" }] }));
  expect((await finishOnboarding(a)).ok).toBe(true);
  expect((await finishOnboarding(b)).ok).toBe(true);
}, 300_000);

async function cleanup() {
  await db.user.deleteMany({ where: { email: { startsWith: "tt-test" } } });
}
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("who can see the timetable", () => {
  it("needs the rollout flag and the personalised programme", async () => {
    expect(await withFlag(false, () => timetableAccess(a))).toBe(false); // flag off: nobody
    expect(await withFlag(true, () => timetableAccess(a))).toBe(true);
    expect(await withFlag(true, () => timetableAccess(legacy))).toBe(false); // original-programme learners never
    expect(await withFlag(true, () => timetableAccess("no-such-user"))).toBe(false);
  });
});

describe("finishing onboarding builds and starts the plan", () => {
  it("leaves a learner with an active plan, completed onboarding and reminder settings", async () => {
    const plan = await db.learningPlan.findFirstOrThrow({ where: { userId: a, status: "ACTIVE" } });
    expect(plan).toMatchObject({ activeKey: a, draftKey: null });
    expect(await db.learningPlanItem.count({ where: { planId: plan.id } })).toBeGreaterThan(5);
    expect((await db.profile.findUniqueOrThrow({ where: { userId: a } })).onboardingStatus).toBe("COMPLETE");
    expect(await db.reminderSettings.count({ where: { userId: a } })).toBe(1);
    expect(await db.learningPlanEvent.count({ where: { planId: plan.id, type: "ACTIVATED" } })).toBe(1);
  });

  it("is safe to repeat: the same plan comes back and nothing is duplicated", async () => {
    const before = await activePlanId(a);
    const items = await db.learningPlanItem.count({ where: { userId: a } });
    const again = await finishOnboarding(a);
    expect(again).toMatchObject({ ok: true, planId: before });
    expect(await db.learningPlan.count({ where: { userId: a } })).toBe(1);
    expect(await db.learningPlanItem.count({ where: { userId: a } })).toBe(items);
  });

  it("keeps a learner in onboarding, with the reason, when a plan cannot be built; and works once fixed", async () => {
    // One study day for seven days is a single session: not enough for a plan.
    expect(await saveOnboarding(fresh, answers({ durationKind: "CUSTOM", customDays: 7, weekdays: [1], dailyStudyMinutes: 0, breakMinutes: 0 }))).toEqual({ ok: true });
    const bad = await finishOnboarding(fresh);
    expect(bad.ok).toBe(false);
    expect(JSON.stringify(bad)).toMatch(/fewer than two|more days|longer duration/i);
    expect((await db.profile.findUniqueOrThrow({ where: { userId: fresh } })).onboardingStatus).toBe("IN_PROGRESS");
    expect(await db.learningPlan.count({ where: { userId: fresh, status: "ACTIVE" } })).toBe(0);
    expect(await db.learningPlanItem.count({ where: { userId: fresh } })).toBe(0);

    expect(await saveOnboarding(fresh, answers({ dailyStudyMinutes: 0, breakMinutes: 0 }))).toEqual({ ok: true });
    expect((await finishOnboarding(fresh)).ok).toBe(true);
    expect((await db.profile.findUniqueOrThrow({ where: { userId: fresh } })).onboardingStatus).toBe("COMPLETE");
    expect(await db.learningPlan.count({ where: { userId: fresh, status: "ACTIVE" } })).toBe(1);
  });

  it("refuses the original programme", async () => {
    expect((await finishOnboarding(legacy)).ok).toBe(false);
    expect(await db.learningPlan.count({ where: { userId: legacy } })).toBe(0);
  });
});

describe("the timetable data", () => {
  it("shows nothing before a plan exists", async () => {
    const lone = await account("Lone");
    expect(await getTimetable(lone, {})).toBeNull();
    expect(await getTimetable(legacy, {})).toBeNull();
  });

  it("returns exactly the sessions of the chosen day, week or month, in order, with the right times", async () => {
    const plan = await db.learningPlanItem.findMany({ where: { planId: await activePlanId(a), status: { not: "CANCELLED" } }, orderBy: [{ date: "asc" }, { slotIndex: "asc" }] });
    const firstDay = day(plan[0].date);

    const d = (await getTimetable(a, { view: "day", date: firstDay }, at(firstDay, "08:00")))!;
    expect(d.view).toBe("day");
    expect(d.today).toBe(firstDay);
    expect(d.items.every((i) => i.date === firstDay)).toBe(true);
    expect(d.items.length).toBe(plan.filter((p) => day(p.date) === firstDay).length);
    expect(d.items.map((i) => i.slotIndex)).toEqual([...d.items.map((i) => i.slotIndex)].sort());
    expect(d.items[0].time).toBe("18:00");
    if (d.items[1]) expect(d.items[1].time).toBe("18:55"); // 45 minutes + a 10-minute break

    const w = (await getTimetable(a, { view: "week", date: firstDay }, at(firstDay)))!;
    expect(w.range).toEqual({ from: firstDay, to: "2026-12-13" }); // Monday to Sunday
    expect(w.items.every((i) => i.date >= w.range.from && i.date <= w.range.to)).toBe(true);
    expect(w.items.length).toBe(plan.filter((p) => day(p.date) >= w.range.from && day(p.date) <= w.range.to).length);

    const m = (await getTimetable(a, { view: "month", date: firstDay }, at(firstDay)))!;
    expect(m.range.from <= firstDay && m.range.to >= "2026-12-31").toBe(true);
    expect(m.items.length).toBe(plan.filter((p) => day(p.date) >= m.range.from && day(p.date) <= m.range.to).length);
    expect(m.progress.total).toBe(plan.length);
    expect(m.milestones.length).toBeGreaterThan(0);
    expect(m.plan).toMatchObject({ status: "ACTIVE", sessionsPerDay: 2, autoReschedule: true, timezone: "Africa/Accra" });
  });

  it("never shows another learner's sessions", async () => {
    const mine = new Set((await db.learningPlanItem.findMany({ where: { userId: a }, select: { id: true } })).map((i) => i.id));
    const theirs = (await getTimetable(b, { view: "month", date: "2026-12-10" }, at("2026-12-10")))!;
    expect(theirs.items.length).toBeGreaterThan(0);
    expect(theirs.items.some((i) => mine.has(i.id))).toBe(false);
    expect(theirs.history.length).toBeGreaterThan(0);
    const bPlan = await activePlanId(b);
    const bIds = new Set((await db.learningPlanItem.findMany({ where: { planId: bPlan }, select: { id: true } })).map((i) => i.id));
    expect(theirs.items.every((i) => bIds.has(i.id))).toBe(true);
  });

  it("falls back safely for a bad view or date instead of failing", async () => {
    const now = at("2026-12-09");
    for (const opts of [{ view: "year" }, { date: "tomorrow" }, { date: "2026-13-01" }, { date: "2026-02-30" }, { view: "<script>", date: "'; drop table" }]) {
      const t = await getTimetable(a, opts, now);
      expect(t).not.toBeNull();
      expect(t!.view).toBe("day");
      expect(t!.date).toBe("2026-12-09"); // today
    }
  });

  it("only reads: opening any view changes nothing in the database", async () => {
    const snap = async () => ({
      items: await db.learningPlanItem.count({ where: { userId: a } }),
      events: await db.learningPlanEvent.count({ where: { userId: a } }),
      notifications: await db.notification.count({ where: { userId: a } }),
      plans: await db.learningPlan.count({ where: { userId: a } }),
      statuses: JSON.stringify((await db.learningPlanItem.findMany({ where: { userId: a }, select: { id: true, status: true, date: true, startAt: true }, orderBy: { id: "asc" } }))),
    });
    const before = await snap();
    for (const view of ["day", "week", "month"]) for (const date of ["2026-12-07", "2026-12-20", "2027-01-15"]) await getTimetable(a, { view, date }, at("2027-01-15"));
    expect(await snap()).toEqual(before); // even with "today" long after the plan began, viewing does not mark anything missed
  });
});

describe("missed sessions, catch-ups and pausing show up on the timetable", () => {
  it("shows missed sessions and the catch-ups that replace them, linked to the original date", async () => {
    const plan = await activePlanId(a);
    const rows = await db.learningPlanItem.findMany({ where: { planId: plan }, orderBy: [{ date: "asc" }, { slotIndex: "asc" }] });
    const later = at(day(rows[5].date), "08:00");
    expect((await reconcilePlan(a, later)).ok).toBe(true);

    const t = (await getTimetable(a, { view: "month", date: day(rows[5].date) }, later))!;
    const missed = t.items.filter((i) => i.status === "MISSED");
    const catchUps = t.items.filter((i) => i.kind === "CATCH_UP");
    expect(missed.length).toBeGreaterThan(0);
    expect(catchUps.length).toBeGreaterThan(0);
    for (const c of catchUps) {
      expect(t.catchUpOf[c.id]).toBeDefined();
      expect(missed.some((m) => m.date === t.catchUpOf[c.id])).toBe(true);
    }
    expect(t.progress.missed).toBe(missed.length);
    expect(t.history.map((h) => h.title)).toContain("Session missed");
    expect(t.history.map((h) => h.title)).toContain("Catch-up added");
    expect(t.history[0].at >= t.history[t.history.length - 1].at).toBe(true); // newest first
    expect(t.finish.onTrack).toBe(true); // every miss has its catch-up
  });

  it("still shows a paused plan, flagged as paused", async () => {
    expect((await pausePlan(b, at("2026-12-09", "08:00"))).ok).toBe(true);
    const t = (await getTimetable(b, { view: "week", date: "2026-12-09" }, at("2026-12-20")))!;
    expect(t.plan.status).toBe("PAUSED");
    expect(t.items.length).toBeGreaterThan(0);
    expect(t.history.map((h) => h.title)).toContain("Plan paused");
  });
});
