import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { deleteMission, getTotalXp, setMissionDone } from "@/lib/missions/service";
import { planNotifications } from "@/lib/notifications/engine";
import { runSchedulerOnce } from "@/lib/notifications/scheduler";
import { saveOnboarding } from "@/lib/plan/onboarding";
import type { OnboardingInput } from "@/lib/plan/schema";
import { activatePlan, changeSubjects, ensureReminderSettings, extendPlan, generateDraft, getPlanView, markPractised, pausePlan, reconcilePlan, resumePlan } from "@/lib/plan/service";
import { updateSettings } from "@/lib/schedule/settings";

const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `plan-test-${n}@example.test`;
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
const at = (iso: string, hhmm = "12:00") => new Date(`${iso}T${hhmm}:00.000Z`);

const answers = (over: Partial<OnboardingInput> = {}): OnboardingInput => ({
  experience: "BEGINNER", goals: [{ departmentCode: "fswd", weight: 2, targetLevel: 1, note: "" }, { departmentCode: "sec", weight: 1, targetLevel: 1, note: "" }],
  sessionMinutes: 45, weekdays: [1, 3, 5], startTime: "18:00", timezone: "Africa/Accra", durationKind: "ONE_MONTH", startDate: "2026-12-07", ...over,
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

/** An onboarded learner with a generated draft. */
async function ready(name: string, over: Partial<OnboardingInput> = {}) {
  const id = await account(name);
  expect(await saveOnboarding(id, answers(over))).toEqual({ ok: true });
  const g = await generateDraft(id);
  if (!g.ok) throw new Error(g.error);
  return id;
}

const planOf = (userId: string, status: "DRAFT" | "ACTIVE" | "PAUSED" | "SUPERSEDED") => db.learningPlan.findFirstOrThrow({ where: { userId, status } });
const items = (planId: string) => db.learningPlanItem.findMany({ where: { planId }, orderBy: [{ date: "asc" }, { position: "asc" }] });
const snapshot = (rows: Awaited<ReturnType<typeof items>>) => rows.map((r) => JSON.stringify({ ...r, status: undefined }));

let a = "";
let b = "";
let legacy = "";

beforeAll(async () => {
  await cleanup();
  seed();
  legacy = await account("Legacy", false);
  a = await ready("A");
  b = await ready("B", { goals: [{ departmentCode: "photo", weight: 1, targetLevel: 1, note: "" }] });
}, 300_000);

async function cleanup() {
  await db.user.deleteMany({ where: { email: { startsWith: "plan-test" } } });
}
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("generating a plan", () => {
  it("stores phases and sessions on the draft, inside the plan's own slots", async () => {
    const plan = await planOf(a, "DRAFT");
    expect(plan.draftKey).toBe(a);
    expect(plan.inputHash).toHaveLength(64);
    expect(plan.generatorVersion).toBe(1);
    const rows = await items(plan.id);
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.every((i) => i.userId === a && i.minutes <= 45 && [1, 3, 5].includes(i.date.getUTCDay()))).toBe(true);
    expect(new Set(rows.map((i) => i.date.toISOString())).size).toBe(rows.length);
    expect(await db.learningPlanPhase.count({ where: { planId: plan.id } })).toBeGreaterThanOrEqual(1);
    expect(await db.learningPlanEvent.count({ where: { planId: plan.id, type: "GENERATED" } })).toBe(1);
    // The learner's own subjects are what got scheduled.
    const depts = await db.department.findMany({ where: { id: { in: rows.map((r) => r.departmentId).filter((x): x is string => !!x) } }, select: { code: true } });
    expect(new Set(depts.map((d) => d.code))).toEqual(new Set(["fswd", "sec"]));
  });

  it("is idempotent: generating again changes nothing, and a different answer regenerates", async () => {
    const before = await items((await planOf(a, "DRAFT")).id);
    const again = await generateDraft(a);
    expect(again).toMatchObject({ ok: true, unchanged: true });
    expect(snapshot(await items((await planOf(a, "DRAFT")).id))).toEqual(snapshot(before));

    await saveOnboarding(a, answers({ sessionMinutes: 60 }));
    const changed = await generateDraft(a);
    expect(changed).toMatchObject({ ok: true, unchanged: false });
    expect((await items((await planOf(a, "DRAFT")).id)).every((i) => i.minutes <= 60)).toBe(true);
    expect(await db.learningPlan.count({ where: { userId: a } })).toBe(1); // still one plan
    await saveOnboarding(a, answers());
    expect(await generateDraft(a)).toMatchObject({ ok: true, unchanged: false });
  });

  it("refuses accounts without a draft or on the original programme, and keeps plans private", async () => {
    expect((await generateDraft(legacy)).ok).toBe(false);
    expect(await db.learningPlan.count({ where: { userId: legacy } })).toBe(0);
    const mine = await db.learningPlanItem.count({ where: { userId: a } });
    const theirs = await db.learningPlanItem.count({ where: { userId: b } });
    expect(mine).toBeGreaterThan(0);
    expect(theirs).toBeGreaterThan(0);
    expect(await db.learningPlanItem.count({ where: { userId: a, planId: (await planOf(b, "DRAFT")).id } })).toBe(0);
    expect(await getPlanView(legacy)).toBeNull();
  });

  it("reports honestly that the stage minutes are estimates and what the real catalogue cannot fill", async () => {
    const view = await getPlanView(a, at("2026-12-01"));
    expect(view!.summary!.stageMinutesSource).toBe("estimated");
    expect(view!.summary!.capacityMinutes).toBeGreaterThanOrEqual(view!.summary!.scheduledMinutes);
    expect(view!.status).toBe("DRAFT");
    expect(view!.catalogOutdated).toBe(false);
  });
});

describe("activating a plan", () => {
  it("needs a generated draft and starts reminders without granting anything", async () => {
    const xpBefore = await getTotalXp(a);
    // A schedule the learner imported earlier is switched off: one reminder source at a time.
    await db.scheduleConfig.create({ data: { userId: a, packageId: "t", name: "t", schemaVersion: "1", startDate: new Date("2026-11-16"), timezone: "Africa/Accra", defaultStartTime: "09:00", defaultDurationMinutes: 30, contentHash: "x", rawConfig: {}, isActive: true } });

    expect((await activatePlan(a)).ok).toBe(true);
    const plan = await planOf(a, "ACTIVE");
    expect(plan).toMatchObject({ draftKey: null, activeKey: a });
    expect(plan.activatedAt).not.toBeNull();
    expect(await db.reminderSettings.count({ where: { userId: a } })).toBe(1);
    expect(await db.scheduleConfig.count({ where: { userId: a, isActive: true } })).toBe(0);
    expect(await db.learningPlanEvent.count({ where: { planId: plan.id, type: "ACTIVATED" } })).toBe(1);

    // Missions the plan teaches now exist as NOT_STARTED learner missions, linked to their sessions. No credit.
    const rows = await items(plan.id);
    const taught = rows.filter((i) => i.kind === "TEACHING");
    expect(taught.every((i) => i.learnerMissionId)).toBe(true);
    const lms = await db.learnerMission.findMany({ where: { id: { in: taught.map((t) => t.learnerMissionId!) } } });
    expect(lms.length).toBeGreaterThan(0);
    expect(lms.every((l) => l.status === "NOT_STARTED" && l.xpAwarded === 0 && l.userId === a)).toBe(true);
    expect(await getTotalXp(a)).toBe(xpBefore);
    expect(await db.userSkill.count({ where: { userId: a } })).toBe(0);
  });

  it("allows only one active plan, in the service and in the database", async () => {
    expect((await activatePlan(a)).ok).toBe(false);
    const active = await planOf(a, "ACTIVE");
    await expect(
      db.learningPlan.create({ data: { userId: a, status: "ACTIVE", activeKey: a, durationKind: "ONE_MONTH", durationDays: 30, startDate: new Date("2026-12-07"), endDate: new Date("2027-01-05"), timezone: "UTC", experience: "BEGINNER", sessionMinutes: 30, weekdays: [1], startTime: "09:00" } }),
    ).rejects.toThrow();
    expect(await db.learningPlan.count({ where: { userId: a, status: "ACTIVE" } })).toBe(1);
    expect(active.id).toBeTruthy();
  });

  it("keeps plan-linked missions off the board's delete and tick-off controls", async () => {
    const plan = await planOf(a, "ACTIVE");
    const linked = (await items(plan.id)).find((i) => i.learnerMissionId)!.learnerMissionId!;
    expect(await deleteMission(a, linked)).toBe(false);
    expect(await setMissionDone(a, linked, true)).toBe(false);
    expect((await db.learnerMission.findUniqueOrThrow({ where: { id: linked } })).status).toBe("NOT_STARTED");
  });

  it("shows today's sessions and derives 'done' from the learner's own progress", async () => {
    const plan = await planOf(a, "ACTIVE");
    const first = (await items(plan.id))[0];
    const day = first.date.toISOString().slice(0, 10);
    let view = (await getPlanView(a, at(day)))!;
    expect(view.today.map((t) => t.id)).toContain(first.id);
    expect(view.items.find((i) => i.id === first.id)!.done).toBe(false);

    const steps = await db.missionStep.findMany({ where: { missionId: first.missionId! }, orderBy: { position: "asc" } });
    await db.learnerMission.update({ where: { id: first.learnerMissionId! }, data: { completedSteps: steps.filter((s) => s.position >= (first.stepFrom ?? 0) && s.position <= (first.stepTo ?? 0)).map((s) => s.id) } });
    view = (await getPlanView(a, at(day)))!;
    expect(view.items.find((i) => i.id === first.id)!.done).toBe(true);
    await db.learnerMission.update({ where: { id: first.learnerMissionId! }, data: { completedSteps: [] } });
  });
});

describe("reminders from plan sessions", () => {
  it("creates one reminder per due session, never twice, and none outside the due window", async () => {
    const plan = await planOf(a, "ACTIVE");
    const first = (await items(plan.id))[0];
    expect(await planNotifications(a, new Date(first.startAt.getTime() - 3 * 60 * 60 * 1000))).toBe(0); // not due yet
    const due = new Date(first.startAt.getTime() + 60_000);
    expect(await planNotifications(a, due)).toBe(1);
    expect(await planNotifications(a, due)).toBe(0); // idempotent
    const n = await db.notification.findFirstOrThrow({ where: { userId: a, planItemId: first.id } });
    expect(n.dedupeKey).toBe(`due:item:${first.id}`);
    expect(n.instanceId).toBeNull();
    expect(await planNotifications(a, new Date(first.startAt.getTime() + 3 * 24 * 60 * 60 * 1000))).toBe(0); // older than a day is history
  });

  it("sends an advance reminder when asked for, once", async () => {
    await db.reminderSettings.update({ where: { userId: a }, data: { advanceEnabled: true, advanceMinutes: 15 } });
    const plan = await planOf(a, "ACTIVE");
    const second = (await items(plan.id))[1];
    const soon = new Date(second.startAt.getTime() - 10 * 60_000);
    expect(await planNotifications(a, soon)).toBe(1);
    expect(await planNotifications(a, soon)).toBe(0);
    expect((await db.notification.findFirstOrThrow({ where: { userId: a, planItemId: second.id, kind: "ADVANCE" } })).dedupeKey).toBe(`adv:item:${second.id}:15`);
    await db.reminderSettings.update({ where: { userId: a }, data: { advanceEnabled: false } });
  });

  it("is picked up by the server-side scheduler for learners who only have a plan", async () => {
    const plan = await planOf(a, "ACTIVE");
    const third = (await items(plan.id))[2];
    const before = await db.notification.count({ where: { userId: a } });
    const stats = await runSchedulerOnce(new Date(third.startAt.getTime() + 60_000));
    expect(stats).not.toBeNull();
    expect(stats!.users).toBeGreaterThanOrEqual(1);
    expect(await db.notification.count({ where: { userId: a, planItemId: third.id } })).toBe(1);
    expect(await db.notification.count({ where: { userId: a } })).toBeGreaterThan(before);
  });

  it("moves reminders with the learner's time zone, for future sessions only", async () => {
    const plan = await planOf(a, "ACTIVE");
    const rows = await items(plan.id);
    const last = rows[rows.length - 1];
    const past = rows[0];
    const pastBefore = past.startAt.toISOString();
    const res = await updateSettings(a, { enabled: true, reminderTime: "", timezone: "America/New_York", advanceEnabled: false, advanceMinutes: 15, inAppEnabled: true, browserEnabled: false, pushEnabled: false }, at("2026-12-20"));
    expect(res.ok).toBe(true);
    const moved = await db.learningPlanItem.findUniqueOrThrow({ where: { id: last.id } });
    expect(moved.startAt.toISOString()).not.toBe(last.startAt.toISOString());
    expect(moved.startAt.getUTCHours()).toBe(23); // 18:00 in New York in winter
    expect((await db.learningPlanItem.findUniqueOrThrow({ where: { id: past.id } })).startAt.toISOString()).toBe(pastBefore); // earlier sessions are history
    expect((await planOf(a, "ACTIVE")).timezone).toBe("America/New_York");
    await updateSettings(a, { enabled: true, reminderTime: "", timezone: "Africa/Accra", advanceEnabled: false, advanceMinutes: 15, inAppEnabled: true, browserEnabled: false, pushEnabled: false }, at("2026-12-20"));
  });
});

describe("missed sessions", () => {
  it("does nothing before the plan starts or while sessions are on time", async () => {
    expect(await reconcilePlan(a, at("2026-12-01"))).toMatchObject({ ok: true, missed: 0, catchUps: 0 });
    expect(await reconcilePlan(a, at("2026-12-07", "08:00"))).toMatchObject({ ok: true, missed: 0 }); // the first session is today
  });

  it("marks undone sessions missed, adds catch-ups in order, never edits the past, and is idempotent", async () => {
    const plan = await planOf(a, "ACTIVE");
    const before = await items(plan.id);
    const when = at(before[3].date.toISOString().slice(0, 10), "08:00"); // the 4th session is today: three are behind us
    // (The scheduler test above already reconciled the first sessions, which is exactly what it should do.)
    const TEACHING_LIKE = ["TEACHING", "BASELINE", "CHECKPOINT", "CATCH_UP"];
    const expected = before.filter((i) => i.status === "PLANNED" && i.date < before[3].date && TEACHING_LIKE.includes(i.kind));
    const alreadyMissed = before.filter((i) => i.status === "MISSED").length;
    const first = await reconcilePlan(a, when);
    expect(first).toMatchObject({ ok: true });
    expect((first as { missed: number }).missed).toBe(expected.length);

    const after = await items(plan.id);
    const missed = after.filter((i) => i.status === "MISSED");
    expect(missed.length).toBe(alreadyMissed + expected.length);
    expect(missed.every((m) => m.date < before[3].date)).toBe(true);
    // Nothing about a past session changed except its status.
    for (const m of missed) expect(snapshot([m])).toEqual(snapshot(before.filter((b0) => b0.id === m.id)));
    for (const p of before.filter((i) => i.date < before[3].date)) expect(snapshot(after.filter((x) => x.id === p.id))).toEqual(snapshot([p])); // every past session is unchanged except its status
    const catchUps = after.filter((i) => i.kind === "CATCH_UP");
    expect(catchUps.length).toBeGreaterThan(0);
    expect(catchUps.every((c) => c.date >= before[3].date && c.rescheduledFromId && missed.some((m) => m.id === c.rescheduledFromId))).toBe(true);
    const byDate = [...catchUps].sort((x, y) => x.date.getTime() - y.date.getTime() || x.position - y.position);
    const originals = byDate.map((c) => missed.find((m) => m.id === c.rescheduledFromId)!);
    expect(originals.map((o) => o.date.getTime())).toEqual([...originals.map((o) => o.date.getTime())].sort((x, y) => x - y)); // catch-ups keep the original order
    expect(await db.learningPlanEvent.count({ where: { planId: plan.id, type: "MISSED" } })).toBe(missed.length);
    expect(await db.learningPlanEvent.count({ where: { planId: plan.id, type: "CATCH_UP_CREATED" } })).toBe(catchUps.length);

    // Teaching work is never dropped to make room.
    const teachingBefore = before.filter((i) => i.kind === "TEACHING" && i.date >= before[3].date).map((i) => i.id);
    expect(after.filter((i) => teachingBefore.includes(i.id)).every((i) => i.status === "PLANNED")).toBe(true);

    const second = await reconcilePlan(a, when);
    expect(second).toMatchObject({ ok: true, missed: 0, catchUps: 0 });
    expect((await items(plan.id)).length).toBe(after.length);
  });

  it("does not count work the learner did as missed", async () => {
    const plan = await planOf(a, "ACTIVE");
    const rows = await items(plan.id);
    const upcoming = rows.find((i) => i.status === "PLANNED" && i.kind === "TEACHING" && i.stepFrom !== null)!;
    const steps = await db.missionStep.findMany({ where: { missionId: upcoming.missionId! } });
    await db.learnerMission.update({ where: { id: upcoming.learnerMissionId! }, data: { completedSteps: steps.filter((s) => s.position >= upcoming.stepFrom! && s.position <= upcoming.stepTo!).map((s) => s.id) } });
    const dayAfter = new Date(upcoming.date.getTime() + 24 * 60 * 60 * 1000);
    await reconcilePlan(a, dayAfter);
    expect((await db.learningPlanItem.findUniqueOrThrow({ where: { id: upcoming.id } })).status).toBe("PLANNED");
    await db.learnerMission.update({ where: { id: upcoming.learnerMissionId! }, data: { completedSteps: [] } });
  });

  it("lets a learner tick only practice, only on its day", async () => {
    const plan = await planOf(a, "ACTIVE");
    const teaching = (await items(plan.id)).find((i) => i.kind === "TEACHING")!;
    expect((await markPractised(a, teaching.id)).ok).toBe(false);
    expect((await markPractised(b, teaching.id)).ok).toBe(false); // someone else's session
    await expect(db.learningPlanItem.update({ where: { id: teaching.id }, data: { practisedAt: new Date() } })).rejects.toThrow(); // database rule: only practice
  });
});

describe("pausing and resuming", () => {
  it("stops reminders and reconciling while paused, and resumes in the same order on the next study days", async () => {
    const plan = await planOf(a, "ACTIVE");
    const rows = await items(plan.id);
    const planned = rows.filter((i) => i.status === "PLANNED");
    const pauseDay = planned[1].date.toISOString().slice(0, 10);
    expect((await pausePlan(a, at(pauseDay, "08:00"))).ok).toBe(true);
    const paused = await planOf(a, "PAUSED");
    expect(paused.activeKey).toBeNull();
    expect(await planNotifications(a, new Date(planned[2].startAt.getTime() + 60_000))).toBe(0);
    expect(await reconcilePlan(a, at("2027-01-20"))).toMatchObject({ ok: true, missed: 0, catchUps: 0 });
    expect((await pausePlan(a)).ok).toBe(false);

    const untouched = rows.filter((i) => i.date < planned[1].date).map((i) => JSON.stringify(i));
    const resumeDay = "2027-01-18"; // a Monday
    const res = await resumePlan(a, at(resumeDay, "08:00"));
    expect(res.ok).toBe(true);
    const active = await planOf(a, "ACTIVE");
    expect(active.pausedAt).toBeNull();
    const after = await items(plan.id);
    expect(after.filter((i) => i.date < planned[1].date).map((i) => JSON.stringify(i))).toEqual(untouched); // earlier sessions never move
    const stillPlanned = after.filter((i) => i.status === "PLANNED" && i.date >= new Date(`${pauseDay}T00:00:00Z`));
    expect(stillPlanned.every((i) => [1, 3, 5].includes(i.date.getUTCDay()) && i.date >= new Date(`${resumeDay}T00:00:00Z`))).toBe(true);
    // Same relative order as before.
    const order = (list: typeof rows) => list.filter((i) => i.status === "PLANNED" && i.date >= planned[1].date).sort((x, y) => x.position - y.position).map((i) => i.id);
    expect(stillPlanned.sort((x, y) => x.date.getTime() - y.date.getTime()).map((i) => i.id)).toEqual(order(planned.filter((i) => i.date >= planned[1].date)).filter((id) => stillPlanned.some((s) => s.id === id)).sort((p, q) => {
      const pi = planned.find((i) => i.id === p)!, qi = planned.find((i) => i.id === q)!;
      return pi.date.getTime() - qi.date.getTime() || pi.position - qi.position;
    }));
    expect(active.endDate >= stillPlanned[stillPlanned.length - 1].date).toBe(true);
    expect(await db.learningPlanEvent.count({ where: { planId: plan.id, type: "PAUSED" } })).toBe(1);
    expect(await db.learningPlanEvent.count({ where: { planId: plan.id, type: "RESUMED" } })).toBe(1);
  });
});

describe("extending and changing subjects", () => {
  it("extends into a new version: the old plan is history, its future sessions are cancelled, progress is untouched", async () => {
    const old = await planOf(a, "ACTIVE");
    const lmBefore = await db.learnerMission.count({ where: { userId: a } });
    const xp = await getTotalXp(a);
    const today = "2027-01-25";
    const res = await extendPlan(a, 14, at(today, "08:00"));
    expect(res.ok).toBe(true);

    const superseded = await db.learningPlan.findUniqueOrThrow({ where: { id: old.id } });
    expect(superseded).toMatchObject({ status: "SUPERSEDED", activeKey: null });
    expect(superseded.supersededAt).not.toBeNull();
    const fresh = await planOf(a, "ACTIVE");
    expect(fresh.parentPlanId).toBe(old.id);
    expect(fresh.startDate.toISOString().slice(0, 10)).toBe(today);
    expect(await db.learningPlan.count({ where: { userId: a, status: "ACTIVE" } })).toBe(1);
    const oldRows = await items(old.id);
    expect(oldRows.filter((i) => i.date >= new Date(`${today}T00:00:00Z`)).every((i) => i.status !== "PLANNED")).toBe(true);
    expect((await items(fresh.id)).every((i) => i.date >= new Date(`${today}T00:00:00Z`))).toBe(true);
    expect(await db.learnerMission.count({ where: { userId: a } })).toBe(lmBefore); // missions are reused, never duplicated
    expect(await getTotalXp(a)).toBe(xp);
    expect(await db.learningPlanEvent.count({ where: { planId: fresh.id, type: "EXTENDED" } })).toBe(1);
    expect((await extendPlan(a, 3)).ok).toBe(false); // out of range
  });

  it("releases untouched work from dropped subjects, keeps anything the learner touched, and refuses bad subjects", async () => {
    const plan = await planOf(a, "ACTIVE");
    const rows = await items(plan.id);
    const dropDept = await db.department.findUniqueOrThrow({ where: { code: "sec" } });
    const secLms = [...new Set(rows.filter((i) => i.departmentId === dropDept.id && i.learnerMissionId).map((i) => i.learnerMissionId!))];
    expect(secLms.length).toBeGreaterThan(0);
    // The learner has started one of them: it must survive.
    const kept = secLms[0];
    await db.learnerMission.update({ where: { id: kept }, data: { status: "IN_PROGRESS", minutesSpent: 20 } });

    expect((await changeSubjects(a, [])).ok).toBe(false);
    expect((await changeSubjects(a, [{ departmentCode: "nope", weight: 1, targetLevel: 1 }])).ok).toBe(false);
    expect((await changeSubjects(a, [{ departmentCode: "fswd", weight: 1, targetLevel: 1, note: "api_key=abcdef1234567890" }])).ok).toBe(false);

    const res = await changeSubjects(a, [{ departmentCode: "fswd", weight: 3, targetLevel: 1 }], at("2027-01-27", "08:00"));
    expect(res.ok).toBe(true);
    const released = (res as { released: number }).released;
    expect(released).toBe(secLms.length - 1);
    expect(await db.learnerMission.findUnique({ where: { id: kept } })).not.toBeNull();
    for (const lm of secLms.filter((id) => id !== kept)) expect(await db.learnerMission.findUnique({ where: { id: lm } })).toBeNull();
    const fresh = await planOf(a, "ACTIVE");
    const goals = await db.learningGoal.findMany({ where: { planId: fresh.id }, include: { department: true } });
    expect(goals.map((g) => g.department.code)).toEqual(["fswd"]);
    expect((await items(fresh.id)).every((i) => i.departmentId === null || i.departmentId !== dropDept.id)).toBe(true);
    expect(await db.learningPlanEvent.count({ where: { userId: a, type: "SUBJECTS_CHANGED" } })).toBe(1);
    expect(await db.learningPlanEvent.count({ where: { userId: a, type: "ITEMS_RELEASED" } })).toBe(released > 0 ? 1 : 0);
  });

  it("releases only what the learner never touched, on a plan long enough to schedule both missions", async () => {
    const c = await ready("C", { durationKind: "THREE_MONTHS", weekdays: [1, 2, 3, 4, 5], sessionMinutes: 60 });
    expect((await activatePlan(c)).ok).toBe(true);
    const plan = await planOf(c, "ACTIVE");
    const sec = await db.department.findUniqueOrThrow({ where: { code: "sec" } });
    const secLms = [...new Set((await items(plan.id)).filter((i) => i.departmentId === sec.id && i.learnerMissionId).map((i) => i.learnerMissionId!))];
    expect(secLms.length).toBe(2);
    await db.learnerMission.update({ where: { id: secLms[0] }, data: { status: "IN_PROGRESS", minutesSpent: 15 } }); // touched: must stay
    const res = await changeSubjects(c, [{ departmentCode: "fswd", weight: 2, targetLevel: 1 }], at("2026-12-10", "08:00"));
    expect(res).toMatchObject({ ok: true, released: 1 });
    expect(await db.learnerMission.findUnique({ where: { id: secLms[0] } })).not.toBeNull();
    expect(await db.learnerMission.findUnique({ where: { id: secLms[1] } })).toBeNull();
    expect(await db.learningPlanEvent.count({ where: { userId: c, type: "ITEMS_RELEASED" } })).toBe(1);
    // The kept mission keeps its history: its old sessions are still on the superseded plan.
    expect(await db.learningPlanItem.count({ where: { planId: plan.id, learnerMissionId: secLms[0] } })).toBeGreaterThan(0);
    expect(await getTotalXp(c)).toBe(0);
  });

  it("never lets one learner touch another's plan", async () => {
    expect(await db.learningPlan.count({ where: { userId: b, status: "ACTIVE" } })).toBe(0); // B only has a draft
    expect((await pausePlan(b)).ok).toBe(false);
    expect((await extendPlan(b, 14)).ok).toBe(false);
    expect((await activatePlan(legacy)).ok).toBe(false);
  });
});

describe("cleanup and credit", () => {
  it("awarded nothing at any point: plans never create XP, skills or passed missions", async () => {
    expect(await getTotalXp(a)).toBe(0);
    expect(await db.userSkill.count({ where: { userId: a } })).toBe(0);
    expect(await db.learnerMission.count({ where: { userId: a, status: { in: ["PASSED", "COMPLETED"] } } })).toBe(0);
  });

  it("deletes cleanly with the learner: plans, sessions, reminders and history all go", async () => {
    const id = await ready("Temp");
    await activatePlan(id);
    const plan = await planOf(id, "ACTIVE");
    const first = (await items(plan.id))[0];
    await planNotifications(id, new Date(first.startAt.getTime() + 60_000));
    expect(await db.notification.count({ where: { userId: id, planItemId: { not: null } } })).toBe(1);
    await db.user.delete({ where: { id } });
    expect(await db.learningPlan.count({ where: { userId: id } })).toBe(0);
    expect(await db.learningPlanItem.count({ where: { userId: id } })).toBe(0);
    expect(await db.learningPlanEvent.count({ where: { userId: id } })).toBe(0);
    expect(await db.notification.count({ where: { userId: id } })).toBe(0);
    expect(await db.reminderSettings.count({ where: { userId: id } })).toBe(0);
  });

  it("creates reminder settings once", async () => {
    await db.$transaction(async (tx) => {
      const x = await ensureReminderSettings(tx, b, "Africa/Accra");
      const y = await ensureReminderSettings(tx, b, "Asia/Kolkata");
      expect(y.id).toBe(x.id);
      expect(y.timezone).toBe("Africa/Accra");
    });
  });
});
