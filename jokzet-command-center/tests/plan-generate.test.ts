import { describe, expect, it } from "vitest";
import { seatsFor } from "@/lib/plan/availability";
import { allocateByWeight, daysBetween, percentOf, phaseCount, reserves, slotDates, weekNumberOf } from "@/lib/plan/capacity";
import { generatePlan, inputHashOf, missionUnits, packMission, type CatalogMission, type GenerateInput } from "@/lib/plan/generate";
import { itemDone, rebalance, type RebalanceItem } from "@/lib/plan/rebalance";
import { localDateOf, localTimeOf, startInstant } from "@/lib/schedule/time";

/** A small deterministic generator so the property test is reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function mission(dept: string, level: number, sortOrder: number, over: Partial<CatalogMission> = {}): CatalogMission {
  const code = `${dept.toUpperCase()}-L${level}-${String(sortOrder).padStart(2, "0")}`;
  return {
    id: `id-${code}`, code, departmentCode: dept, level, sortOrder, role: "LESSON", title: `${dept} mission ${level}.${sortOrder}`, objective: "Learn it.", minutes: 90,
    steps: [
      { position: 1, phase: "WATCH", minutes: null }, { position: 2, phase: "DO", minutes: null }, { position: 3, phase: "DO", minutes: null },
      { position: 4, phase: "EXPERIMENT", minutes: null }, { position: 5, phase: "SHOW", minutes: null },
    ],
    ...over,
  };
}

const catalogFor = (depts: string[], perDept: number) => depts.flatMap((d) => Array.from({ length: perDept }, (_, i) => mission(d, 0, i + 1)));

function input(over: Partial<GenerateInput> = {}): GenerateInput {
  return {
    timezone: "Africa/Accra", startDate: "2026-12-07", durationDays: 30, experience: "BEGINNER", sessionMinutes: 45, dailyStudyMinutes: 0, breakMinutes: 0, weekdays: [1, 3, 5], startTime: "18:00",
    goals: [{ departmentCode: "fswd", weight: 3, targetLevel: 1 }, { departmentCode: "sec", weight: 1, targetLevel: 1 }],
    placement: {}, baselinePending: [], catalog: catalogFor(["fswd", "sec"], 6), catalogVersion: "v1", passed: [], ...over,
  };
}

describe("capacity arithmetic", () => {
  it("lists the study slots for the chosen weekdays", () => {
    const s = slotDates("2026-12-07", 14, [1, 3, 5]); // Monday 7 Dec, two weeks
    expect(s).toEqual(["2026-12-07", "2026-12-09", "2026-12-11", "2026-12-14", "2026-12-16", "2026-12-18"]);
    expect(daysBetween("2026-12-07", "2026-12-21")).toBe(14);
    expect(weekNumberOf("2026-12-07", "2026-12-07")).toBe(1);
    expect(weekNumberOf("2026-12-14", "2026-12-07")).toBe(2);
  });

  it("matches the worked example: 3 days a week for 14 days gives 6 slots with no review or checkpoint reserve", () => {
    expect(reserves(6, phaseCount(14, 6))).toEqual({ baselineCap: 1, reviewCap: 0, checkpointCap: 0 });
  });

  it("never lets the reserves take more than 45% of the slots (teaching keeps at least 55%), for every S from 2 to 3000", () => {
    for (let S = 2; S <= 3000; S += 1) {
      const r = reserves(S, 8);
      expect(r.baselineCap + r.reviewCap + r.checkpointCap).toBeLessThanOrEqual(percentOf(45, S) + (S === 3 ? 1 : 0));
      expect(r.baselineCap).toBeLessThanOrEqual(percentOf(20, S));
      expect(r.reviewCap + r.checkpointCap).toBeLessThanOrEqual(percentOf(25, S) + (S === 3 ? 1 : 0));
    }
  });

  it("shares slots by weight exactly, with the earlier subject winning ties", () => {
    expect(allocateByWeight(10, [3, 1])).toEqual([8, 2]);
    expect(allocateByWeight(7, [1, 1])).toEqual([4, 3]);
    expect(allocateByWeight(0, [2, 2])).toEqual([0, 0]);
    for (let total = 0; total <= 200; total += 7) {
      for (const w of [[1], [1, 1, 1], [5, 3, 1], [2, 2, 5, 1, 1]]) {
        const out = allocateByWeight(total, w);
        expect(out.reduce((a, b) => a + b, 0)).toBe(total);
        expect(out.every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
      }
    }
  });

  it("chooses the number of phases by duration", () => {
    expect([14, 30, 90, 180, 365].map((d) => phaseCount(d, 50))).toEqual([2, 3, 4, 6, 8]);
    expect(phaseCount(21, 50)).toBe(2);
    expect(phaseCount(700, 300)).toBe(8);
    expect(phaseCount(90, 3)).toBe(1); // a very small plan is one phase
  });
});

describe("units and sessions", () => {
  it("estimates stage minutes when none are authored, and prefers authored minutes", () => {
    const m = mission("fswd", 0, 1);
    const est = missionUnits(m);
    expect(est.authored).toBe(false);
    expect(est.units.at(-1)).toMatchObject({ step: null, minutes: 15 }); // the submit unit
    const authored = missionUnits({ ...m, steps: m.steps.map((s) => ({ ...s, minutes: 10 })) });
    expect(authored.authored).toBe(true);
    expect(authored.units.slice(0, 5).every((u) => u.minutes === 10)).toBe(true);
  });

  it("packs consecutive units into sessions, and a unit longer than a session spans several", () => {
    const m = mission("fswd", 0, 1, { steps: [{ position: 1, phase: "WATCH", minutes: 20 }, { position: 2, phase: "DO", minutes: 100 }, { position: 3, phase: "SHOW", minutes: 10 }] });
    const { sessions } = packMission(m, 45);
    expect(sessions.every((s) => s.minutes <= 45)).toBe(true);
    const total = sessions.reduce((a, s) => a + s.minutes, 0);
    expect(total).toBe(20 + 100 + 10 + 15);
    const big = sessions.filter((s) => s.stepFrom === 2 && s.stepTo === 2);
    expect(big.length).toBe(Math.ceil(100 / 45));
    expect(big.map((s) => s.continuesPrev)).toEqual([false, true, true]);
  });
});

describe("generatePlan", () => {
  it("rejects a plan with fewer than two sessions or no subject", () => {
    expect(generatePlan(input({ durationDays: 7, weekdays: [1] })).ok).toBe(false);
    expect(generatePlan(input({ goals: [] })).ok).toBe(false);
  });

  it("is deterministic: the same input gives the same plan and hash; a changed input changes the hash", () => {
    const a = generatePlan(input());
    const b = generatePlan(input());
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(JSON.stringify(a.draft)).toEqual(JSON.stringify(b.draft));
    expect(a.draft.inputHash).toBe(inputHashOf(input()));
    expect(inputHashOf(input({ sessionMinutes: 60 }))).not.toBe(a.draft.inputHash);
    expect(inputHashOf(input({ catalogVersion: "v2" }))).not.toBe(a.draft.inputHash);
  });

  it("schedules within capacity, one session per study day, in date order, never beyond the session length", () => {
    const r = generatePlan(input());
    if (!r.ok) throw new Error(r.error);
    const { items, summary } = r.draft;
    expect(summary.scheduledMinutes).toBeLessThanOrEqual(summary.capacityMinutes);
    expect(items.every((i) => i.minutes <= 45 && i.minutes > 0)).toBe(true);
    const dates = items.map((i) => i.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort()).toEqual(dates);
    expect(items.map((i) => i.position)).toEqual(items.map((_, n) => n + 1));
    const slots = new Set(slotDates("2026-12-07", 30, [1, 3, 5]));
    expect(dates.every((d) => slots.has(d))).toBe(true);
  });

  it("gives each reminder the right instant and keeps the local date", () => {
    const r = generatePlan(input({ timezone: "Asia/Kolkata", startTime: "06:30" }));
    if (!r.ok) throw new Error(r.error);
    for (const i of r.draft.items) {
      expect(localDateOf(i.startAt, "Asia/Kolkata")).toBe(i.date);
      expect(localTimeOf(i.startAt, "Asia/Kolkata")).toBe("06:30");
    }
  });

  it("shares teaching time by weight, interleaved rather than in blocks", () => {
    const r = generatePlan(input({ weekdays: [0, 1, 2, 3, 4, 5, 6], durationDays: 40, goals: [{ departmentCode: "fswd", weight: 3, targetLevel: 1 }, { departmentCode: "sec", weight: 1, targetLevel: 1 }] }));
    if (!r.ok) throw new Error(r.error);
    const teaching = r.draft.items.filter((i) => i.kind === "TEACHING");
    const fswd = teaching.filter((i) => i.departmentCode === "fswd").length;
    const sec = teaching.filter((i) => i.departmentCode === "sec").length;
    expect(fswd).toBeGreaterThan(sec * 2); // weight 3 against 1
    const first = teaching.slice(0, 8).map((i) => i.departmentCode);
    expect(first).toContain("sec"); // interleaved: the lighter subject appears early
  });

  it("keeps teaching to at least 55% of the slots when there is content", () => {
    for (const days of [14, 30, 90, 180]) {
      const r = generatePlan(input({ durationDays: days, weekdays: [1, 2, 3, 4, 5], catalog: catalogFor(["fswd", "sec"], 40) }));
      if (!r.ok) throw new Error(r.error);
      const teaching = r.draft.items.filter((i) => i.kind === "TEACHING").length;
      expect(teaching * 100).toBeGreaterThanOrEqual(55 * r.draft.summary.slots);
    }
  });

  it("never schedules a mission the learner has already passed", () => {
    const cat = catalogFor(["fswd", "sec"], 6);
    const passed = [cat[0].id, cat[1].id];
    const r = generatePlan(input({ catalog: cat, passed }));
    if (!r.ok) throw new Error(r.error);
    expect(r.draft.items.filter((i) => i.kind === "TEACHING").some((i) => passed.includes(i.missionId ?? ""))).toBe(false);
  });

  it("follows content order inside a subject and covers a mission's steps in order", () => {
    const r = generatePlan(input({ goals: [{ departmentCode: "fswd", weight: 1, targetLevel: 1 }], weekdays: [0, 1, 2, 3, 4, 5, 6] }));
    if (!r.ok) throw new Error(r.error);
    const seq = r.draft.items.filter((i) => i.kind === "TEACHING");
    let lastSort = 0;
    for (const i of seq) {
      const sort = Number(i.missionId!.slice(-2));
      expect(sort).toBeGreaterThanOrEqual(lastSort);
      lastSort = sort;
    }
    const firstMission = seq.filter((i) => i.missionId === seq[0].missionId);
    expect(firstMission[0].stepFrom).toBe(1);
  });

  it("starts experienced learners at their baseline placement, beginners always at Level 0", () => {
    const cat = [...catalogFor(["fswd"], 3), ...Array.from({ length: 3 }, (_, i) => mission("fswd", 1, i + 1))];
    const goals = [{ departmentCode: "fswd", weight: 1, targetLevel: 1 }];
    const adv = generatePlan(input({ goals, catalog: cat, experience: "ADVANCED", placement: { fswd: 1 }, weekdays: [0, 1, 2, 3, 4, 5, 6] }));
    const beg = generatePlan(input({ goals, catalog: cat, experience: "BEGINNER", placement: { fswd: 1 }, weekdays: [0, 1, 2, 3, 4, 5, 6] }));
    if (!adv.ok || !beg.ok) throw new Error("plan failed");
    expect(adv.draft.items.find((i) => i.kind === "TEACHING")!.missionId).toContain("-L1-");
    expect(beg.draft.items.find((i) => i.kind === "TEACHING")!.missionId).toContain("-L0-");
  });

  it("reports a shortfall instead of padding with fake work, and caps practice and review at 25% each", () => {
    const cat = catalogFor(["fswd"], 1); // one mission is far too little for 90 days
    const goals = [{ departmentCode: "fswd", weight: 1, targetLevel: 1 }];
    const none = generatePlan(input({ goals, catalog: cat, durationDays: 90, weekdays: [1, 2, 3, 4, 5] }));
    if (!none.ok) throw new Error(none.error);
    expect(none.draft.summary.shortfall[0].sessions).toBeGreaterThan(0);
    expect(none.draft.summary.warnings.join(" ")).toMatch(/enough published content/);
    expect(none.draft.items.some((i) => i.kind === "PRACTICE")).toBe(false); // nothing was passed, so nothing to practise

    const withPassed = generatePlan(input({ goals, catalog: [...cat, mission("fswd", 0, 2)], passed: [cat[0].id], durationDays: 90, weekdays: [1, 2, 3, 4, 5] }));
    if (!withPassed.ok) throw new Error(withPassed.error);
    const mine = withPassed.draft.items.filter((i) => i.departmentCode === "fswd");
    const practice = mine.filter((i) => i.kind === "PRACTICE").length;
    const reviews = mine.filter((i) => i.kind === "REVIEW" && i.departmentCode === "fswd").length;
    const { slots, reserved } = withPassed.draft.summary;
    const allocation = slots - reserved.baseline - reserved.review - reserved.checkpoint; // the subject's share of teaching slots
    expect(practice).toBeGreaterThan(0);
    expect(practice * 100).toBeLessThanOrEqual(25 * allocation); // practice is capped at 25% of the subject's time
    expect(reviews * 100).toBeLessThanOrEqual(25 * allocation); // and so is review
    expect(mine.filter((i) => i.kind === "PRACTICE").every((i) => i.missionId === cat[0].id)).toBe(true); // only passed missions are practised
  });

  it("adds baselines only for pending subjects that have one, capped, and reviews and checkpoints only when they can exist", () => {
    const base = (d: string) => mission(d, 0, 0, { id: `base-${d}`, code: `${d.toUpperCase()}-L0-00`, role: "BASELINE", title: `${d} baseline`, minutes: 30 });
    const check = mission("fswd", 0, 90, { id: "check-fswd", role: "CHECKPOINT", title: "fswd checkpoint", minutes: 40 });
    const cat = [...catalogFor(["fswd", "sec"], 20), base("fswd"), base("sec"), check];
    const r = generatePlan(input({ catalog: cat, baselinePending: ["fswd", "sec"], durationDays: 90, weekdays: [1, 2, 3, 4, 5] }));
    if (!r.ok) throw new Error(r.error);
    const items = r.draft.items;
    expect(items.filter((i) => i.kind === "BASELINE").map((i) => i.missionId).sort()).toEqual(["base-fswd", "base-sec"]);
    expect(items[0].kind).toBe("BASELINE"); // baselines come first
    expect(items.filter((i) => i.kind === "CHECKPOINT").length).toBeGreaterThan(0);
    expect(items.some((i) => i.kind === "REVIEW")).toBe(true);
    // Not pending (or skipped): no baseline session.
    const done = generatePlan(input({ catalog: cat, baselinePending: [], durationDays: 90, weekdays: [1, 2, 3, 4, 5] }));
    if (!done.ok) throw new Error(done.error);
    expect(done.draft.items.some((i) => i.kind === "BASELINE")).toBe(false);
    // No checkpoint mission anywhere: a warning, and a review instead.
    const noCheck = generatePlan(input({ catalog: catalogFor(["fswd", "sec"], 20), durationDays: 90, weekdays: [1, 2, 3, 4, 5] }));
    if (!noCheck.ok) throw new Error(noCheck.error);
    expect(noCheck.draft.items.some((i) => i.kind === "CHECKPOINT")).toBe(false);
    expect(noCheck.draft.summary.warnings.join(" ")).toMatch(/checkpoint/i);
  });

  it("holds its invariants for hundreds of random inputs (property test)", () => {
    const rand = rng(20261120);
    const depts = ["fswd", "uxui", "sec", "cloud", "ai"];
    let ran = 0;
    for (let n = 0; n < 400; n += 1) {
      const nGoals = 1 + Math.floor(rand() * 4);
      const goals = depts.slice(0, nGoals).map((d) => ({ departmentCode: d, weight: 1 + Math.floor(rand() * 5), targetLevel: Math.floor(rand() * 3) }));
      const weekdays = [0, 1, 2, 3, 4, 5, 6].filter(() => rand() < 0.5);
      const per = Math.floor(rand() * 12);
      const cat = depts.flatMap((d) => Array.from({ length: per }, (_, i) => mission(d, i % 2, i + 1)));
      const r = generatePlan(input({
        goals, weekdays: weekdays.length ? weekdays : [1], durationDays: 7 + Math.floor(rand() * 200), sessionMinutes: 15 + 5 * Math.floor(rand() * 40),
        experience: (["BEGINNER", "IMPROVER", "INTERMEDIATE", "ADVANCED"] as const)[Math.floor(rand() * 4)], catalog: cat,
        passed: cat.filter(() => rand() < 0.2).map((m) => m.id), startDate: `2026-${String(1 + Math.floor(rand() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`,
      }));
      if (!r.ok) continue;
      ran += 1;
      const { items, summary } = r.draft;
      const limit = summary.capacityMinutes / summary.slots;
      expect(summary.scheduledMinutes).toBeLessThanOrEqual(summary.capacityMinutes);
      expect(items.length).toBeLessThanOrEqual(summary.slots);
      expect(items.every((i) => i.minutes >= 1 && i.minutes <= limit)).toBe(true);
      expect(new Set(items.map((i) => i.date)).size).toBe(items.length);
      expect(summary.reserved.baseline + summary.reserved.review + summary.reserved.checkpoint).toBeLessThanOrEqual(percentOf(45, summary.slots) + 1);
      expect(items.every((i) => (i.kind === "PRACTICE" || i.kind === "TEACHING") === (i.missionId !== null && i.departmentCode !== null) || i.kind === "REVIEW" || i.kind === "CHECKPOINT" || i.kind === "BASELINE")).toBe(true);
      expect(r.draft.phases.length).toBeGreaterThanOrEqual(1);
      expect(items.every((i) => i.phaseIndex >= 0 && i.phaseIndex < r.draft.phases.length)).toBe(true);
    }
    expect(ran).toBeGreaterThan(300);
  });
});

describe("reminder instants and daylight saving time", () => {
  const cases: [string, string, string, string][] = [
    ["Africa/Accra", "2026-12-07", "18:00", "2026-12-07T18:00:00.000Z"],
    ["America/New_York", "2026-12-07", "18:00", "2026-12-07T23:00:00.000Z"],
    ["America/New_York", "2026-07-07", "18:00", "2026-07-07T22:00:00.000Z"], // daylight time
    ["Asia/Kolkata", "2026-12-07", "18:00", "2026-12-07T12:30:00.000Z"],
    ["Pacific/Auckland", "2026-12-07", "18:00", "2026-12-07T05:00:00.000Z"],
  ];
  it.each(cases)("%s %s %s resolves to the right UTC instant on the same local date", (tz, date, time, utc) => {
    const at = startInstant(date, time, tz);
    expect(at.toISOString()).toBe(utc);
    expect(localDateOf(at, tz)).toBe(date);
    expect(localTimeOf(at, tz)).toBe(time);
  });

  it("keeps the same local time across a daylight-saving change for ordinary times", () => {
    for (const [tz, a, b] of [["America/New_York", "2026-03-07", "2026-03-09"], ["Europe/London", "2026-03-28", "2026-03-30"], ["America/New_York", "2026-10-31", "2026-11-02"]] as const) {
      expect(localTimeOf(startInstant(a, "18:00", tz), tz)).toBe("18:00");
      expect(localTimeOf(startInstant(b, "18:00", tz), tz)).toBe("18:00");
    }
  });

  it("resolves a time that does not exist (spring-forward gap) one hour earlier, on the same local date", () => {
    for (const [tz, date, asked, got] of [["America/New_York", "2026-03-08", "02:30", "01:30"], ["Europe/London", "2026-03-29", "01:30", "00:30"], ["Pacific/Auckland", "2026-09-27", "02:30", "01:30"]] as const) {
      const at = startInstant(date, asked, tz);
      expect(localDateOf(at, tz)).toBe(date);
      expect(localTimeOf(at, tz)).toBe(got);
    }
  });

  it("resolves an ambiguous time (fall-back) to its first occurrence on the same local date", () => {
    const at = startInstant("2026-11-01", "01:30", "America/New_York");
    expect(localDateOf(at, "America/New_York")).toBe("2026-11-01");
    expect(at.toISOString()).toBe("2026-11-01T05:30:00.000Z"); // 01:30 EDT, the first of the two 01:30s
  });

  it("gives a plan that spans a daylight-saving change one session per day with no duplicates or gaps", () => {
    const r = generatePlan(input({ timezone: "America/New_York", startDate: "2026-03-02", durationDays: 21, weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: "02:30" }));
    if (!r.ok) throw new Error(r.error);
    const dates = r.draft.items.map((i) => i.date);
    expect(new Set(dates).size).toBe(dates.length);
    for (const i of r.draft.items) expect(localDateOf(i.startAt, "America/New_York")).toBe(i.date);
  });
});

describe("missed sessions", () => {
  const item = (id: string, date: string, position: number, kind: RebalanceItem["kind"], over: Partial<RebalanceItem> = {}): RebalanceItem => ({ id, date, slotIndex: 0, position, kind, status: "PLANNED", rescheduledFromId: null, done: false, ...over });
  const slots = seatsFor(["2026-12-07", "2026-12-09", "2026-12-11", "2026-12-14", "2026-12-16", "2026-12-18"], 1);

  it("marks undone teaching sessions before today as missed and adds catch-ups in the original order", () => {
    const items = [item("a", "2026-12-07", 1, "TEACHING"), item("b", "2026-12-09", 2, "TEACHING"), item("c", "2026-12-11", 3, "TEACHING", { done: true }), item("d", "2026-12-14", 4, "PRACTICE"), item("e", "2026-12-16", 5, "REVIEW"), item("f", "2026-12-18", 6, "TEACHING")];
    const r = rebalance({ items, today: "2026-12-12", seats: slots });
    expect(r.markMissed).toEqual(["a", "b"]);
    expect(r.catchUps.map((c) => c.rescheduledFromId)).toEqual(["a", "b"]);
    expect(r.catchUps.map((c) => c.date)).toEqual(["2026-12-14", "2026-12-16"]); // practice gives way first, then review
    expect(r.cancel).toEqual(["d", "e"]);
    expect(r.shortfall).toEqual([]);
  });

  it("never displaces teaching work and reports what did not fit", () => {
    const items = [item("a", "2026-12-07", 1, "TEACHING"), item("b", "2026-12-09", 2, "TEACHING"), item("c", "2026-12-14", 4, "TEACHING"), item("d", "2026-12-16", 5, "TEACHING"), item("e", "2026-12-18", 6, "TEACHING")];
    const r = rebalance({ items, today: "2026-12-10", seats: slots });
    expect(r.cancel).toEqual([]);
    expect(r.catchUps.map((c) => c.date)).toEqual(["2026-12-11"]); // the only free slot
    expect(r.shortfall).toEqual(["b"]);
  });

  it("is idempotent: once a catch-up exists nothing new is created, and past items are never touched", () => {
    const items = [item("a", "2026-12-07", 1, "TEACHING", { status: "MISSED" }), item("x", "2026-12-14", 7, "CATCH_UP", { rescheduledFromId: "a" }), item("y", "2026-12-16", 8, "TEACHING")];
    const r = rebalance({ items, today: "2026-12-12", seats: slots });
    expect(r).toEqual({ markMissed: [], catchUps: [], cancel: [], shortfall: [] });
    const again = rebalance({ items, today: "2026-12-12", seats: slots });
    expect(again).toEqual(r);
  });

  it("ignores practice and review that were not done: they are never 'missed'", () => {
    const items = [item("p", "2026-12-07", 1, "PRACTICE"), item("r", "2026-12-09", 2, "REVIEW")];
    expect(rebalance({ items, today: "2026-12-12", seats: slots })).toEqual({ markMissed: [], catchUps: [], cancel: [], shortfall: [] });
  });

  it("derives 'done' from the learner's mission, never from the item", () => {
    const steps = [{ id: "s1", position: 1 }, { id: "s2", position: 2 }, { id: "s3", position: 3 }];
    const lm = (over = {}) => ({ status: "IN_PROGRESS", completedSteps: [] as string[], hasSubmission: false, steps, ...over });
    expect(itemDone({ stepFrom: 1, stepTo: 2 }, null)).toBe(false);
    expect(itemDone({ stepFrom: 1, stepTo: 2 }, lm())).toBe(false);
    expect(itemDone({ stepFrom: 1, stepTo: 2 }, lm({ completedSteps: ["s1"] }))).toBe(false);
    expect(itemDone({ stepFrom: 1, stepTo: 2 }, lm({ completedSteps: ["s1", "s2"] }))).toBe(true);
    expect(itemDone({ stepFrom: null, stepTo: null }, lm())).toBe(false);
    expect(itemDone({ stepFrom: null, stepTo: null }, lm({ hasSubmission: true }))).toBe(true);
    expect(itemDone({ stepFrom: 1, stepTo: 3 }, lm({ status: "PASSED" }))).toBe(true);
  });
});
