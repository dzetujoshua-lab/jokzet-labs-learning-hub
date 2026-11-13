import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { planNotifications } from "@/lib/notifications/engine";
import { completeOnboarding, getOnboardingState, saveOnboarding } from "@/lib/plan/onboarding";
import type { OnboardingInput } from "@/lib/plan/schema";
import { activatePlan, extendPlan, generateDraft, pausePlan, reconcilePlan, resumePlan } from "@/lib/plan/service";
import { updateSettings } from "@/lib/schedule/settings";
import { localDateOf, localTimeOf } from "@/lib/schedule/time";

const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `avail-test-${n}@example.test`;
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
const at = (iso: string, hhmm = "12:00") => new Date(`${iso}T${hhmm}:00.000Z`);
const day = (d: Date) => d.toISOString().slice(0, 10);

const answers = (over: Partial<OnboardingInput> = {}): OnboardingInput => ({
  experience: "BEGINNER", goals: [{ departmentCode: "fswd", weight: 2, targetLevel: 1, note: "" }, { departmentCode: "sec", weight: 1, targetLevel: 1, note: "" }],
  sessionMinutes: 45, dailyStudyMinutes: 120, breakMinutes: 10, weekdays: [1, 3, 5], startTime: "18:00", timezone: "Africa/Accra", durationKind: "ONE_MONTH", startDate: "2026-12-07", ...over,
});

async function account(name: string) {
  const before = process.env.PERSONALISED_LEARNING;
  process.env.PERSONALISED_LEARNING = "on";
  try {
    const r = await registerUser({ displayName: name, email: mail(name.toLowerCase()), password: PASSWORD });
    if (!r.ok) throw new Error("registration failed");
    return r.userId;
  } finally {
    if (before === undefined) delete process.env.PERSONALISED_LEARNING;
    else process.env.PERSONALISED_LEARNING = before;
  }
}
async function ready(name: string, over: Partial<OnboardingInput> = {}) {
  const id = await account(name);
  expect(await saveOnboarding(id, answers(over))).toEqual({ ok: true });
  const g = await generateDraft(id);
  if (!g.ok) throw new Error(g.error);
  return id;
}
const planOf = (userId: string, status: "DRAFT" | "ACTIVE" | "PAUSED" | "SUPERSEDED") => db.learningPlan.findFirstOrThrow({ where: { userId, status } });
const items = (planId: string) => db.learningPlanItem.findMany({ where: { planId }, orderBy: [{ date: "asc" }, { slotIndex: "asc" }, { position: "asc" }] });
const seatKey = (i: { date: Date; slotIndex: number }) => `${day(i.date)}#${i.slotIndex}`;

let multi = "";
let strict = "";

beforeAll(async () => {
  await cleanup();
  seed();
  multi = await ready("Multi");
  strict = await ready("Strict", { dailyStudyMinutes: 0, breakMinutes: 0, flexibility: "STRICT", autoReschedule: false });
}, 300_000);

async function cleanup() {
  await db.user.deleteMany({ where: { email: { startsWith: "avail-test" } } });
}
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("availability on the learner's plan", () => {
  it("round-trips through onboarding and is stored on the plan", async () => {
    const state = (await getOnboardingState(multi))!;
    expect(state.draft).toMatchObject({ dailyStudyMinutes: 120, breakMinutes: 10, flexibility: "BALANCED", autoReschedule: true, sessionMinutes: 45 });
    const s = (await getOnboardingState(strict))!;
    expect(s.draft).toMatchObject({ dailyStudyMinutes: 0, flexibility: "STRICT", autoReschedule: false });
    // Impossible combinations are refused before anything is saved.
    expect((await saveOnboarding(multi, answers({ dailyStudyMinutes: 30 }))).ok).toBe(false);
    expect((await saveOnboarding(multi, answers({ breakMinutes: 90 }))).ok).toBe(false);
    expect((await getOnboardingState(multi))!.draft!.dailyStudyMinutes).toBe(120); // unchanged by the refusals
  });

  it("is enforced by the database as well", async () => {
    const plan = await planOf(multi, "DRAFT");
    await expect(db.learningPlan.update({ where: { id: plan.id }, data: { dailyStudyMinutes: 20 } })).rejects.toThrow(); // less than one session
    await expect(db.learningPlan.update({ where: { id: plan.id }, data: { dailyStudyMinutes: 900 } })).rejects.toThrow();
    await expect(db.learningPlan.update({ where: { id: plan.id }, data: { breakMinutes: 61 } })).rejects.toThrow();
    const first = (await items(plan.id))[0];
    await expect(db.learningPlanItem.update({ where: { id: first.id }, data: { slotIndex: 8 } })).rejects.toThrow();
    await expect(db.learningPlanItem.update({ where: { id: first.id }, data: { slotIndex: -1 } })).rejects.toThrow();
  });

  it("generates two sessions on each study day, in order, with the break between them", async () => {
    const plan = await planOf(multi, "DRAFT");
    const rows = await items(plan.id);
    expect(new Set(rows.map(seatKey)).size).toBe(rows.length);
    expect(rows.some((r) => r.slotIndex === 1)).toBe(true);
    expect(rows.every((r) => r.slotIndex <= 1 && r.minutes <= 45)).toBe(true);
    for (const second of rows.filter((r) => r.slotIndex === 1)) {
      const first = rows.find((r) => day(r.date) === day(second.date) && r.slotIndex === 0);
      if (first) expect(second.startAt.getTime() - first.startAt.getTime()).toBe(55 * 60_000); // 45 minutes + a 10-minute break
    }
    expect((plan.summary as { sessionsPerDay: number }).sessionsPerDay).toBe(2);
  });
});

describe("reminders for later sessions of a day", () => {
  it("sends one reminder per session, each at its own time, never twice", async () => {
    expect((await activatePlan(multi)).ok).toBe(true);
    const plan = await planOf(multi, "ACTIVE");
    const rows = await items(plan.id);
    const secondIdx = rows.findIndex((r) => r.slotIndex === 1);
    const second = rows[secondIdx];
    const first = rows.find((r) => day(r.date) === day(second.date) && r.slotIndex === 0)!;
    // Just after the first session starts, only the first is due.
    expect(await planNotifications(multi, new Date(first.startAt.getTime() + 60_000))).toBe(1);
    expect(await db.notification.count({ where: { userId: multi, planItemId: second.id } })).toBe(0);
    // Just after the second starts, exactly one more is due.
    expect(await planNotifications(multi, new Date(second.startAt.getTime() + 60_000))).toBe(1);
    expect(await planNotifications(multi, new Date(second.startAt.getTime() + 60_000))).toBe(0);
    expect((await db.notification.findFirstOrThrow({ where: { userId: multi, planItemId: second.id } })).dedupeKey).toBe(`due:item:${second.id}`);
  });

  it("moves every session of a day with the learner's time zone, keeping the gap between them", async () => {
    const plan = await planOf(multi, "ACTIVE");
    const rows = await items(plan.id);
    const last = rows[rows.length - 1];
    const lastDay = rows.filter((r) => day(r.date) === day(last.date));
    const res = await updateSettings(multi, { enabled: true, reminderTime: "", timezone: "America/New_York", advanceEnabled: false, advanceMinutes: 15, inAppEnabled: true, browserEnabled: false, pushEnabled: false }, at("2026-12-20"));
    expect(res.ok).toBe(true);
    const after = await db.learningPlanItem.findMany({ where: { id: { in: lastDay.map((r) => r.id) } }, orderBy: { slotIndex: "asc" } });
    expect(after.length).toBeGreaterThan(0);
    for (const a of after) expect(localTimeOf(a.startAt, "America/New_York")).toBe(a.slotIndex === 0 ? "18:00" : "18:55"); // each session keeps its own place in the day
    await updateSettings(multi, { enabled: true, reminderTime: "", timezone: "Africa/Accra", advanceEnabled: false, advanceMinutes: 15, inAppEnabled: true, browserEnabled: false, pushEnabled: false }, at("2026-12-20"));
  });
});

describe("catch-ups, pause and extension with several sessions a day", () => {
  it("never puts two live sessions in one seat after catch-ups", async () => {
    const plan = await planOf(multi, "ACTIVE");
    const before = await items(plan.id);
    const when = at(day(before[6].date), "08:00");
    const r = await reconcilePlan(multi, when);
    expect(r.ok).toBe(true);
    expect((r as { missed: number }).missed).toBeGreaterThan(0);
    const after = await items(plan.id);
    const live = after.filter((i) => i.status === "PLANNED" && i.date >= before[6].date);
    expect(new Set(live.map(seatKey)).size).toBe(live.length);
    const catchUps = after.filter((i) => i.kind === "CATCH_UP");
    expect(catchUps.length).toBeGreaterThan(0);
    for (const c of catchUps) {
      expect(c.date >= before[6].date).toBe(true);
      expect(c.slotIndex).toBeLessThanOrEqual(1);
      expect(localDateOf(c.startAt, "Africa/Accra") >= day(c.date)).toBe(true);
    }
    expect(await reconcilePlan(multi, when)).toMatchObject({ ok: true, missed: 0, catchUps: 0 }); // idempotent
  });

  it("resumes into free seats, in the same order, with no two sessions in one seat", async () => {
    const plan = await planOf(multi, "ACTIVE");
    const rows = await items(plan.id);
    const planned = rows.filter((i) => i.status === "PLANNED");
    const pauseDay = day(planned[0].date);
    expect((await pausePlan(multi, at(pauseDay, "08:00"))).ok).toBe(true);
    const untouched = rows.filter((i) => day(i.date) < pauseDay).map((i) => JSON.stringify(i));
    expect((await resumePlan(multi, at("2027-02-01", "08:00"))).ok).toBe(true); // a Monday
    const after = await items(plan.id);
    expect(after.filter((i) => day(i.date) < pauseDay).map((i) => JSON.stringify(i))).toEqual(untouched);
    const moved = after.filter((i) => i.status === "PLANNED" && day(i.date) >= "2027-02-01");
    expect(new Set(moved.map(seatKey)).size).toBe(moved.length);
    expect(moved.every((i) => [1, 3, 5].includes(i.date.getUTCDay()) && i.slotIndex <= 1)).toBe(true);
    const order = (list: typeof planned) => list.filter((i) => day(i.date) >= pauseDay).sort((a, b) => a.date.getTime() - b.date.getTime() || a.slotIndex - b.slotIndex || a.position - b.position).map((i) => i.id);
    const movedIds = new Set(moved.map((m) => m.id));
    expect(order(moved)).toEqual(order(planned).filter((id) => movedIds.has(id)));
  });

  it("carries the learner's availability and choices into the next version of the plan", async () => {
    const old = await planOf(multi, "ACTIVE");
    expect((await extendPlan(multi, 14, at("2027-02-08", "08:00"))).ok).toBe(true);
    const fresh = await planOf(multi, "ACTIVE");
    expect(fresh.parentPlanId).toBe(old.id);
    expect(fresh).toMatchObject({ dailyStudyMinutes: 120, breakMinutes: 10, flexibility: "BALANCED", autoReschedule: true, sessionMinutes: 45 });
    const rows = await items(fresh.id);
    expect(rows.some((r) => r.slotIndex === 1)).toBe(true);
    expect(new Set(rows.map(seatKey)).size).toBe(rows.length);
  });
});

describe("automatic rescheduling is the learner's choice", () => {
  it("records missed sessions but adds no catch-ups when it is off", async () => {
    expect((await activatePlan(strict)).ok).toBe(true);
    const plan = await planOf(strict, "ACTIVE");
    expect(plan).toMatchObject({ autoReschedule: false, flexibility: "STRICT" });
    const rows = await items(plan.id);
    const r = await reconcilePlan(strict, at(day(rows[4].date), "08:00"));
    expect(r.ok).toBe(true);
    expect((r as { missed: number }).missed).toBeGreaterThan(0);
    expect((r as { catchUps: number }).catchUps).toBe(0);
    const after = await items(plan.id);
    expect(after.some((i) => i.status === "MISSED")).toBe(true);
    expect(after.some((i) => i.kind === "CATCH_UP")).toBe(false);
    expect(after.filter((i) => i.status === "CANCELLED")).toHaveLength(0); // nothing was displaced
    expect(await db.learningPlanEvent.count({ where: { planId: plan.id, type: "MISSED" } })).toBeGreaterThan(0);
    expect(await db.learningPlanEvent.count({ where: { planId: plan.id, type: "CATCH_UP_CREATED" } })).toBe(0);
  });
});

describe("reminder settings at the end of onboarding", () => {
  it("creates them for the learner's time zone, once, and never overwrites existing ones", async () => {
    const id = await account("Settings");
    await saveOnboarding(id, answers({ timezone: "Asia/Kolkata", dailyStudyMinutes: 0 }));
    expect(await db.reminderSettings.count({ where: { userId: id } })).toBe(0);
    expect((await completeOnboarding(id)).ok).toBe(true);
    const row = await db.reminderSettings.findUniqueOrThrow({ where: { userId: id } });
    expect(row.timezone).toBe("Asia/Kolkata");
    expect(row.enabled).toBe(true);
    expect((await db.profile.findUniqueOrThrow({ where: { userId: id } })).onboardingStatus).toBe("COMPLETE");

    // A learner who already has settings keeps them.
    const other = await account("Settings2");
    await db.reminderSettings.create({ data: { userId: other, timezone: "Pacific/Auckland", advanceEnabled: true, advanceMinutes: 30 } });
    await saveOnboarding(other, answers({ timezone: "Africa/Accra", dailyStudyMinutes: 0 }));
    expect((await completeOnboarding(other)).ok).toBe(true);
    expect(await db.reminderSettings.findUniqueOrThrow({ where: { userId: other } })).toMatchObject({ timezone: "Pacific/Auckland", advanceEnabled: true, advanceMinutes: 30 });
    expect(await db.reminderSettings.count({ where: { userId: other } })).toBe(1);
  });
});
