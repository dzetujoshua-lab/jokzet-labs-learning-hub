import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { getTotalXp } from "@/lib/missions/service";
import { planNotifications } from "@/lib/notifications/engine";
import { finishOnboarding } from "@/lib/plan/finish";
import { saveOnboarding } from "@/lib/plan/onboarding";
import { getMoveOptions, moveSession } from "@/lib/plan/reschedule-service";
import type { OnboardingInput } from "@/lib/plan/schema";
import { changeAvailability, pausePlan, resumePlan } from "@/lib/plan/service";
import { getMissionSchedule, getTimetable } from "@/lib/plan/timetable-service";
import { localTimeOf } from "@/lib/schedule/time";

const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `rs-test-${n}@example.test`;
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
const at = (iso: string, hhmm = "12:00") => new Date(`${iso}T${hhmm}:00.000Z`);
const day = (d: Date) => d.toISOString().slice(0, 10);
const NOW = at("2026-12-08", "08:00"); // Tuesday: the plan began Monday 7 December

const answers = (over: Partial<OnboardingInput> = {}): OnboardingInput => ({
  experience: "BEGINNER", goals: [{ departmentCode: "fswd", weight: 2, targetLevel: 1, note: "" }, { departmentCode: "sec", weight: 1, targetLevel: 1, note: "" }],
  sessionMinutes: 45, dailyStudyMinutes: 100, breakMinutes: 10, weekdays: [1, 3, 5], startTime: "18:00", timezone: "Africa/Accra", durationKind: "THREE_MONTHS", startDate: "2026-12-07", ...over,
});

async function learner(name: string, over: Partial<OnboardingInput> = {}) {
  const before = process.env.PERSONALISED_LEARNING;
  process.env.PERSONALISED_LEARNING = "on";
  try {
    const r = await registerUser({ displayName: name, email: mail(name.toLowerCase()), password: PASSWORD });
    if (!r.ok) throw new Error("registration failed");
    expect(await saveOnboarding(r.userId, answers(over))).toEqual({ ok: true });
    const f = await finishOnboarding(r.userId);
    if (!f.ok) throw new Error(f.error);
    return r.userId;
  } finally {
    if (before === undefined) delete process.env.PERSONALISED_LEARNING;
    else process.env.PERSONALISED_LEARNING = before;
  }
}
const activePlan = (userId: string) => db.learningPlan.findFirstOrThrow({ where: { userId, status: "ACTIVE" } });
const items = (planId: string) => db.learningPlanItem.findMany({ where: { planId }, orderBy: [{ date: "asc" }, { slotIndex: "asc" }, { position: "asc" }] });
const seat = (i: { date: Date; slotIndex: number }) => `${day(i.date)}#${i.slotIndex}`;

/** The first upcoming session of a given kind that has somewhere to go. */
async function movable(userId: string, filter: (i: Awaited<ReturnType<typeof items>>[number]) => boolean = () => true) {
  const rows = (await items((await activePlan(userId)).id)).filter((i) => i.status === "PLANNED" && i.date >= at("2026-12-09") && filter(i));
  const options = await getMoveOptions(userId, rows.map((r) => r.id), NOW);
  const found = rows.find((r) => options[r.id]?.length);
  if (!found) throw new Error("no movable session in the fixture");
  return { item: found, options: options[found.id] };
}

let a = "";
let b = "";

beforeAll(async () => {
  await cleanup();
  seed();
  a = await learner("A");
  b = await learner("B", { goals: [{ departmentCode: "photo", weight: 1, targetLevel: 1, note: "" }] });
}, 300_000);

async function cleanup() {
  await db.user.deleteMany({ where: { email: { startsWith: "rs-test" } } });
}
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("moving one session", () => {
  it("moves it, keeps the original slot in history with who and why, and changes nothing else", async () => {
    const plan = await activePlan(a);
    const before = await items(plan.id);
    const xp = await getTotalXp(a);
    const { item, options } = await movable(a, (i) => i.kind === "TEACHING");
    const target = options[0];

    const r = await moveSession(a, item.id, { date: target.date, slotIndex: target.slotIndex, reason: "Power cut that evening" }, NOW);
    expect(r).toMatchObject({ ok: true, from: { date: day(item.date), slotIndex: item.slotIndex }, to: { date: target.date, slotIndex: target.slotIndex } });

    const moved = await db.learningPlanItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(day(moved.date)).toBe(target.date);
    expect(moved.slotIndex).toBe(target.slotIndex);
    expect(localTimeOf(moved.startAt, "Africa/Accra")).toBe(target.time);
    expect(moved).toMatchObject({ id: item.id, status: "PLANNED", missionId: item.missionId, learnerMissionId: item.learnerMissionId, kind: item.kind, stepFrom: item.stepFrom, stepTo: item.stepTo, title: item.title });

    // The history row keeps the original, says who and why.
    const ev = await db.learningPlanEvent.findFirstOrThrow({ where: { planId: plan.id, type: "RESCHEDULED", itemId: item.id } });
    expect(ev).toMatchObject({ actor: "LEARNER", reason: "Power cut that evening", fromSlotIndex: item.slotIndex, toSlotIndex: target.slotIndex });
    expect(day(ev.fromDate!)).toBe(day(item.date));
    expect(day(ev.toDate!)).toBe(target.date);
    expect(ev.fromStartAt!.toISOString()).toBe(item.startAt.toISOString()); // the original start instant is never lost
    expect(ev.toStartAt!.toISOString()).toBe(moved.startAt.toISOString());

    // Every other session is exactly as it was, nothing was created or removed, and nothing was earned.
    const after = await items(plan.id);
    expect(after).toHaveLength(before.length);
    for (const row of before.filter((x) => x.id !== item.id)) expect(JSON.stringify(after.find((x) => x.id === row.id))).toBe(JSON.stringify(row));
    expect(await getTotalXp(a)).toBe(xp);
    expect(await db.userSkill.count({ where: { userId: a } })).toBe(0);
    expect(new Set(after.filter((i) => i.status !== "CANCELLED").map(seat)).size).toBe(after.filter((i) => i.status !== "CANCELLED").length); // still no shared seat
  });

  it("shows the move on the timetable, by you, with the reason", async () => {
    const t = (await getTimetable(a, { view: "month", date: "2026-12-10" }, NOW))!;
    const h = t.history.find((x) => x.title === "Session moved")!;
    expect(h).toMatchObject({ by: "You", reason: "Power cut that evening" });
    expect(t.history.find((x) => x.title === "Plan started")!.by).toBe("You");
  });

  it("withdraws reminders queued for the old time, and creates the right one for the new time", async () => {
    const { item, options } = await movable(a, (i) => i.kind === "TEACHING");
    await db.notification.create({ data: { userId: a, planItemId: item.id, kind: "ADVANCE", type: "ADVANCE", dedupeKey: `adv:item:${item.id}:15`, title: "Starts soon", scheduledFor: new Date() } });
    expect(await db.notification.count({ where: { planItemId: item.id } })).toBe(1);

    const r = await moveSession(a, item.id, { date: options[0].date, slotIndex: options[0].slotIndex }, NOW);
    expect(r.ok).toBe(true);
    expect(await db.notification.count({ where: { planItemId: item.id } })).toBe(0); // the stale reminder is gone
    const moved = await db.learningPlanItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(await planNotifications(a, new Date(moved.startAt.getTime() + 60_000))).toBeGreaterThanOrEqual(1);
    expect((await db.notification.findFirstOrThrow({ where: { planItemId: item.id } })).dedupeKey).toBe(`due:item:${item.id}`);
    expect(await planNotifications(a, new Date(moved.startAt.getTime() + 60_000))).toBe(0); // never twice
  });

  it("refuses moves that break the rules, with a reason, and changes nothing", async () => {
    const plan = await activePlan(a);
    const rows = await items(plan.id);
    const snap = JSON.stringify(rows);
    const { item, options } = await movable(a, (i) => i.kind === "TEACHING");
    const free = options[0];

    const bad = async (id: string, date: string, slotIndex: number, reason = "") => (await moveSession(a, id, { date, slotIndex, reason }, NOW)) as { ok: boolean; error?: string };
    expect((await bad(item.id, day(item.date), item.slotIndex)).ok).toBe(false); // same seat
    expect((await bad(item.id, "2026-12-15", 0)).error).toMatch(/study days/); // a Tuesday
    expect((await bad(item.id, free.date, 5)).ok).toBe(false); // not a seat of the timetable
    expect((await bad(item.id, "2026-12-07", 0)).ok).toBe(false); // before today
    expect((await bad(item.id, "2030-01-01", 0)).error).toMatch(/inside your plan/); // outside the plan
    expect((await bad(item.id, "next week", 0)).ok).toBe(false); // not a date
    expect((await bad(item.id, free.date, free.slotIndex, "api_key=abcdef1234567890")).ok).toBe(false); // a secret in the reason
    const taken = rows.find((r) => r.status === "PLANNED" && r.id !== item.id && r.date >= at("2026-12-09"))!;
    expect((await bad(item.id, day(taken.date), taken.slotIndex)).error).toMatch(/already in that slot/);
    expect((await bad("not-a-session", free.date, free.slotIndex)).ok).toBe(false);
    const past = rows.find((r) => day(r.date) === "2026-12-07")!;
    expect((await bad(past.id, free.date, free.slotIndex)).error).toMatch(/started or passed|upcoming/); // the past is never rewritten

    expect(JSON.stringify(await items(plan.id))).toBe(snap); // not a single row changed
  });

  it("refuses a session the learner has already done", async () => {
    const { item, options } = await movable(a, (i) => i.kind === "TEACHING" && i.stepFrom !== null && i.learnerMissionId !== null);
    const steps = await db.missionStep.findMany({ where: { missionId: item.missionId! } });
    await db.learnerMission.update({ where: { id: item.learnerMissionId! }, data: { completedSteps: steps.filter((s) => s.position >= item.stepFrom! && s.position <= item.stepTo!).map((s) => s.id) } });
    const r = await moveSession(a, item.id, { date: options[0].date, slotIndex: options[0].slotIndex }, NOW);
    expect(r).toMatchObject({ ok: false });
    expect(JSON.stringify(r)).toMatch(/already done/);
    await db.learnerMission.update({ where: { id: item.learnerMissionId! }, data: { completedSteps: [] } });
  });

  it("keeps curriculum order: a later step may not jump ahead of an earlier one", async () => {
    const rows = (await items((await activePlan(a)).id)).filter((i) => i.status === "PLANNED" && i.kind === "TEACHING" && i.missionId && i.date >= at("2026-12-09"));
    const byMission = new Map<string, typeof rows>();
    for (const r of rows) byMission.set(r.missionId!, [...(byMission.get(r.missionId!) ?? []), r]);
    const mission = [...byMission.values()].find((list) => list.length >= 3 && new Set(list.map((x) => x.stepFrom)).size >= 3)!;
    expect(mission).toBeDefined();
    const sorted = [...mission].sort((x, y) => x.date.getTime() - y.date.getTime() || x.slotIndex - y.slotIndex);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    // Moving the FIRST session behind the LAST one would reorder the mission's steps.
    const farOptions = await getMoveOptions(a, [first.id], NOW);
    expect((farOptions[first.id] ?? []).every((o) => `${o.date}#${o.slotIndex}` < seat(last))).toBe(true); // never offered a slot after the last step
    const r = await moveSession(a, first.id, { date: day(last.date), slotIndex: last.slotIndex === 0 ? 1 : 0 }, NOW);
    expect(r.ok).toBe(false);
  });

  it("never lets another learner move your session", async () => {
    const mine = (await items((await activePlan(a)).id)).find((i) => i.status === "PLANNED")!;
    const theirs = await movable(b);
    expect((await moveSession(b, mine.id, { date: theirs.options[0].date, slotIndex: theirs.options[0].slotIndex }, NOW)).ok).toBe(false);
    expect(await getMoveOptions(b, [mine.id], NOW)).toEqual({});
  });

  it("serialises moves: two moves into one seat cannot both succeed", async () => {
    const rows = (await items((await activePlan(a)).id)).filter((i) => i.status === "PLANNED" && i.date >= at("2026-12-09"));
    const optionsFor = await getMoveOptions(a, rows.map((r) => r.id), NOW);
    let pair: [typeof rows[number], typeof rows[number], string] | null = null;
    outer: for (const x of rows) for (const y of rows) {
      if (x.id >= y.id || x.departmentId === y.departmentId) continue;
      const common = (optionsFor[x.id] ?? []).filter((o) => (optionsFor[y.id] ?? []).some((p) => p.date === o.date && p.slotIndex === o.slotIndex));
      if (common.length) { pair = [x, y, `${common[0].date}#${common[0].slotIndex}`]; break outer; }
    }
    expect(pair).not.toBeNull();
    const [x, y, key] = pair!;
    const [date, slot] = key.split("#");
    const results = await Promise.all([
      moveSession(a, x.id, { date, slotIndex: Number(slot) }, NOW),
      moveSession(a, y.id, { date, slotIndex: Number(slot) }, NOW),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const live = (await items((await activePlan(a)).id)).filter((i) => i.status !== "CANCELLED");
    expect(live.filter((i) => seat(i) === key)).toHaveLength(1); // exactly one session holds the seat
    expect(new Set(live.map(seat)).size).toBe(live.length);
  });

  it("will not move sessions while the plan is paused, and works again after resuming", async () => {
    const { item, options } = await movable(a, (i) => i.kind === "TEACHING");
    expect((await pausePlan(a, NOW)).ok).toBe(true);
    const refused = await moveSession(a, item.id, { date: options[0].date, slotIndex: options[0].slotIndex }, NOW);
    expect(refused.ok).toBe(false);
    expect(await getMoveOptions(a, [item.id], NOW)).toEqual({});
    expect((await resumePlan(a, at("2026-12-09", "08:00"))).ok).toBe(true);
  });
});

describe("the mission schedule", () => {
  it("lists a mission's sessions for its owner only", async () => {
    const plan = await activePlan(a);
    const row = (await items(plan.id)).find((i) => i.missionId && i.kind === "TEACHING" && i.status === "PLANNED")!;
    const code = (await db.mission.findUniqueOrThrow({ where: { id: row.missionId! } })).code!;
    const s = (await getMissionSchedule(a, code, NOW))!;
    expect(s.planStatus).toBe("ACTIVE");
    expect(s.sessions.some((x) => x.id === row.id)).toBe(true);
    expect(s.sessions.every((x) => x.status !== "CANCELLED" && x.kind !== "PRACTICE" && x.kind !== "REVIEW")).toBe(true);
    expect(await getMissionSchedule(b, code, NOW)).toBeNull(); // B's plan does not teach it
    expect(await getMissionSchedule(a, "ZZZ-L0-99", NOW)).toBeNull();
  });
});

describe("changing availability", () => {
  it("records a preference-only change in place", async () => {
    const c = await learner("C");
    const plan = await activePlan(c);
    const r = await changeAvailability(c, { weekdays: plan.weekdays, startTime: plan.startTime, sessionMinutes: plan.sessionMinutes, dailyStudyMinutes: plan.dailyStudyMinutes, breakMinutes: plan.breakMinutes, flexibility: "STRICT", autoReschedule: false }, NOW);
    expect(r).toMatchObject({ ok: true, planId: plan.id, newVersion: false });
    expect(await activePlan(c)).toMatchObject({ id: plan.id, flexibility: "STRICT", autoReschedule: false });
    const ev = await db.learningPlanEvent.findFirstOrThrow({ where: { planId: plan.id, type: "PREFERENCES_CHANGED" } });
    expect(ev.actor).toBe("LEARNER");
    // Nothing changed at all: no new version and no history row.
    const same = await changeAvailability(c, { weekdays: plan.weekdays, startTime: plan.startTime, sessionMinutes: plan.sessionMinutes, dailyStudyMinutes: plan.dailyStudyMinutes, breakMinutes: plan.breakMinutes, flexibility: "STRICT", autoReschedule: false }, NOW);
    expect(same).toMatchObject({ ok: true, newVersion: false });
    expect(await db.learningPlanEvent.count({ where: { planId: plan.id, type: "PREFERENCES_CHANGED" } })).toBe(1);
  });

  it("builds a new version from today when study times change, keeping the old plan as history", async () => {
    const d = await learner("D");
    const old = await activePlan(d);
    const lmBefore = await db.learnerMission.count({ where: { userId: d } });
    const r = await changeAvailability(d, { weekdays: [2, 4], startTime: "07:30", sessionMinutes: 30, dailyStudyMinutes: 0, breakMinutes: 0, flexibility: "BALANCED", autoReschedule: true }, NOW);
    expect(r).toMatchObject({ ok: true, newVersion: true });

    const fresh = await activePlan(d);
    expect(fresh.parentPlanId).toBe(old.id);
    expect(fresh).toMatchObject({ weekdays: [2, 4], startTime: "07:30", sessionMinutes: 30, dailyStudyMinutes: 0 });
    expect(day(fresh.startDate)).toBe("2026-12-08");
    expect((await db.learningPlan.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("SUPERSEDED");
    const rows = await items(fresh.id);
    expect(rows.every((i) => [2, 4].includes(i.date.getUTCDay()) && i.slotIndex === 0 && i.minutes <= 30)).toBe(true);
    expect(rows.every((i) => day(i.startAt) >= "2026-12-08")).toBe(true);
    expect((await items(old.id)).filter((i) => i.date >= at("2026-12-08")).every((i) => i.status !== "PLANNED")).toBe(true); // future sessions of the old plan are cancelled
    expect(await db.learnerMission.count({ where: { userId: d } })).toBe(lmBefore); // missions reused
    const ev = await db.learningPlanEvent.findFirstOrThrow({ where: { planId: fresh.id, type: "AVAILABILITY_CHANGED" } });
    expect(ev.actor).toBe("LEARNER");
    expect(await getTotalXp(d)).toBe(0);
  });

  it("refuses impossible changes and a missing or paused plan, and keeps learners apart", async () => {
    const ok = { weekdays: [1, 3], startTime: "18:00", sessionMinutes: 45, dailyStudyMinutes: 0, breakMinutes: 0, flexibility: "BALANCED" as const, autoReschedule: true };
    expect((await changeAvailability(a, { ...ok, weekdays: [] }, NOW)).ok).toBe(false);
    expect((await changeAvailability(a, { ...ok, dailyStudyMinutes: 30 }, NOW)).ok).toBe(false);
    expect((await changeAvailability(a, { ...ok, startTime: "25:00" }, NOW)).ok).toBe(false);
    const e = await learner("E");
    expect((await pausePlan(e, NOW)).ok).toBe(true);
    expect((await changeAvailability(e, ok, NOW)).ok).toBe(false); // paused: resume first
    expect(await db.learningPlan.count({ where: { userId: e, status: "ACTIVE" } })).toBe(0);
  });
});

describe("the audit trail itself", () => {
  it("is enforced by the database", async () => {
    const plan = await activePlan(b);
    const base = { planId: plan.id, userId: b, type: "RESCHEDULED" as const };
    await expect(db.learningPlanEvent.create({ data: { ...base, actor: "ROBOT" } })).rejects.toThrow(); // only LEARNER or SYSTEM
    await expect(db.learningPlanEvent.create({ data: { ...base, fromSlotIndex: 9 } })).rejects.toThrow();
    await expect(db.learningPlanEvent.create({ data: { ...base, reason: "x".repeat(501) } })).rejects.toThrow();
    await expect(db.learningPlanEvent.create({ data: { ...base, actor: "LEARNER", reason: "fine", fromSlotIndex: 0, toSlotIndex: 1 } })).resolves.toBeTruthy();
  });
});
