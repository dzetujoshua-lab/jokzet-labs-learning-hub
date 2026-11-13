import { describe, expect, it } from "vitest";
import { MAX_SESSIONS_PER_DAY, seatsFor, sessionInstant, sessionsPerDay } from "@/lib/plan/availability";
import { percentOf, slotDates } from "@/lib/plan/capacity";
import { generatePlan, inputHashOf, type CatalogMission, type GenerateInput } from "@/lib/plan/generate";
import { rebalance, type RebalanceItem } from "@/lib/plan/rebalance";
import { onboardingSchema } from "@/lib/plan/schema";
import { addDaysISO, localDateOf, localTimeOf } from "@/lib/schedule/time";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const mission = (dept: string, sortOrder: number): CatalogMission => ({
  id: `id-${dept}-${sortOrder}`, code: `${dept.toUpperCase()}-L0-${String(sortOrder).padStart(2, "0")}`, departmentCode: dept, level: 0, sortOrder, role: "LESSON", title: `${dept} ${sortOrder}`, objective: "Learn.", minutes: 90,
  steps: [{ position: 1, phase: "WATCH", minutes: null }, { position: 2, phase: "DO", minutes: null }, { position: 3, phase: "EXPERIMENT", minutes: null }, { position: 4, phase: "SHOW", minutes: null }],
});
const catalog = ["fswd", "sec"].flatMap((d) => Array.from({ length: 30 }, (_, i) => mission(d, i + 1)));
const input = (over: Partial<GenerateInput> = {}): GenerateInput => ({
  timezone: "Africa/Accra", startDate: "2026-12-07", durationDays: 30, experience: "BEGINNER", sessionMinutes: 45, dailyStudyMinutes: 0, breakMinutes: 0, weekdays: [1, 3, 5], startTime: "18:00",
  goals: [{ departmentCode: "fswd", weight: 2, targetLevel: 1 }, { departmentCode: "sec", weight: 1, targetLevel: 1 }], placement: {}, baselinePending: [], catalog, catalogVersion: "v1", passed: [], ...over,
});

describe("sessions per day", () => {
  it("is derived from the daily study time, session length and break", () => {
    expect(sessionsPerDay(0, 45, 0)).toBe(1); // 0 means one session a day
    expect(sessionsPerDay(30, 45, 0)).toBe(1); // less than one session still gives one
    expect(sessionsPerDay(90, 45, 0)).toBe(2);
    expect(sessionsPerDay(100, 45, 10)).toBe(2); // 45 + 10 + 45 = 100
    expect(sessionsPerDay(99, 45, 10)).toBe(1); // one minute short of two sessions with a break
    expect(sessionsPerDay(165, 45, 10)).toBe(3);
    expect(sessionsPerDay(900, 15, 0)).toBe(MAX_SESSIONS_PER_DAY); // capped
  });

  it("lists every seat in order", () => {
    expect(seatsFor(["2026-12-07", "2026-12-09"], 2)).toEqual([{ date: "2026-12-07", index: 0 }, { date: "2026-12-07", index: 1 }, { date: "2026-12-09", index: 0 }, { date: "2026-12-09", index: 1 }]);
  });
});

describe("session start times", () => {
  it("starts later sessions of a day after the session and break, on the learner's own clock", () => {
    const at = (i: number) => sessionInstant("2026-12-07", i, "18:00", 45, 10, "Africa/Accra");
    expect(at(0).toISOString()).toBe("2026-12-07T18:00:00.000Z");
    expect(at(1).toISOString()).toBe("2026-12-07T18:55:00.000Z");
    expect(at(2).toISOString()).toBe("2026-12-07T19:50:00.000Z");
  });

  it("lets a session cross midnight: it starts on the next calendar day but keeps its plan day", () => {
    const tz = "Africa/Accra";
    const third = sessionInstant("2026-12-07", 2, "22:30", 60, 0, tz); // 22:30, 23:30, 00:30
    expect(localDateOf(third, tz)).toBe("2026-12-08");
    expect(localTimeOf(third, tz)).toBe("00:30");
    const first = sessionInstant("2026-12-07", 0, "22:30", 60, 0, tz);
    expect(localDateOf(first, tz)).toBe("2026-12-07");
    // In another zone too.
    const ny = sessionInstant("2026-12-07", 1, "23:30", 45, 15, "America/New_York"); // 23:30 then 00:30 next day
    expect(localDateOf(ny, "America/New_York")).toBe("2026-12-08");
    expect(localTimeOf(ny, "America/New_York")).toBe("00:30");
  });

  it("handles daylight saving inside a day: a session landing in the gap resolves an hour earlier, an ambiguous one to its first occurrence", () => {
    const ny = "America/New_York";
    const gap = sessionInstant("2026-03-08", 2, "00:30", 60, 0, ny); // 00:30, 01:30, 02:30 (does not exist)
    expect(localDateOf(gap, ny)).toBe("2026-03-08");
    expect(localTimeOf(gap, ny)).toBe("01:30");
    const ambiguous = sessionInstant("2026-11-01", 1, "00:30", 60, 0, ny); // 00:30, 01:30 (happens twice)
    expect(ambiguous.toISOString()).toBe("2026-11-01T05:30:00.000Z"); // the first 01:30 (daylight time)
    // The learner's intent is kept for a normal day either side.
    for (const day of ["2026-03-07", "2026-03-09", "2026-10-31", "2026-11-02"]) {
      expect(localTimeOf(sessionInstant(day, 1, "18:00", 45, 15, ny), ny)).toBe("19:00");
    }
  });
});

describe("generating with several sessions a day", () => {
  it("fills every seat once, spaces sessions by session plus break, and stays within capacity", () => {
    const r = generatePlan(input({ dailyStudyMinutes: 120, breakMinutes: 10 }));
    if (!r.ok) throw new Error(r.error);
    const { items, summary } = r.draft;
    expect(summary.sessionsPerDay).toBe(2);
    expect(summary.slots).toBe(slotDates("2026-12-07", 30, [1, 3, 5]).length * 2);
    expect(new Set(items.map((i) => `${i.date}#${i.slotIndex}`)).size).toBe(items.length); // no seat used twice
    expect(items.every((i) => i.slotIndex === 0 || i.slotIndex === 1)).toBe(true);
    expect(items.some((i) => i.slotIndex === 1)).toBe(true);
    expect(items.every((i) => i.minutes <= 45)).toBe(true);
    expect(summary.scheduledMinutes).toBeLessThanOrEqual(summary.capacityMinutes);
    for (const second of items.filter((i) => i.slotIndex === 1)) {
      const first = items.find((i) => i.date === second.date && i.slotIndex === 0);
      if (first) expect(second.startAt.getTime() - first.startAt.getTime()).toBe(55 * 60_000);
    }
    const teaching = items.filter((i) => i.kind === "TEACHING").length;
    expect(teaching * 100).toBeGreaterThanOrEqual(55 * summary.slots);
    // Sessions stay in date-then-session order.
    const keys = items.map((i) => `${i.date}#${i.slotIndex}`);
    expect([...keys].sort()).toEqual(keys);
  });

  it("holds more work than a single-session plan for the same days, and reports capacity honestly", () => {
    const one = generatePlan(input());
    const two = generatePlan(input({ dailyStudyMinutes: 100, breakMinutes: 10 }));
    if (!one.ok || !two.ok) throw new Error("plan failed");
    expect(two.draft.items.length).toBeGreaterThan(one.draft.items.length);
    expect(two.draft.summary.capacityMinutes).toBe(2 * one.draft.summary.capacityMinutes);
    const tiny = generatePlan(input({ catalog: catalog.slice(0, 2), dailyStudyMinutes: 180, breakMinutes: 0 }));
    if (!tiny.ok) throw new Error(tiny.error);
    expect(tiny.draft.summary.shortfall.length).toBeGreaterThan(0); // not enough content: said plainly, not padded
  });

  it("changes the plan fingerprint when availability changes", () => {
    const base = inputHashOf(input());
    expect(inputHashOf(input({ dailyStudyMinutes: 90 }))).not.toBe(base);
    expect(inputHashOf(input({ breakMinutes: 10, dailyStudyMinutes: 120 }))).not.toBe(inputHashOf(input({ dailyStudyMinutes: 120 })));
  });

  it("gives sessions that cross midnight a later calendar day than their plan day", () => {
    const r = generatePlan(input({ startTime: "23:30", dailyStudyMinutes: 120, breakMinutes: 0 }));
    if (!r.ok) throw new Error(r.error);
    const second = r.draft.items.find((i) => i.slotIndex === 1)!;
    expect(localDateOf(second.startAt, "Africa/Accra")).not.toBe(second.date); // 00:00 the next day
    expect(localTimeOf(second.startAt, "Africa/Accra")).toBe("00:15"); // 23:30 + 45 minutes
    expect(localDateOf(second.startAt, "Africa/Accra")).toBe(addDaysISO(second.date, 1)); // exactly the next day
  });

  it("holds its invariants for random availability (property test)", () => {
    const rand = rng(8128);
    let ran = 0;
    for (let n = 0; n < 250; n += 1) {
      const session = 15 + 5 * Math.floor(rand() * 30);
      const daily = rand() < 0.3 ? 0 : session + Math.floor(rand() * 400);
      const brk = 5 * Math.floor(rand() * 7);
      const weekdays = [0, 1, 2, 3, 4, 5, 6].filter(() => rand() < 0.5);
      const r = generatePlan(input({ sessionMinutes: session, dailyStudyMinutes: daily, breakMinutes: brk, weekdays: weekdays.length ? weekdays : [2], durationDays: 7 + Math.floor(rand() * 120), startTime: `${String(Math.floor(rand() * 24)).padStart(2, "0")}:00` }));
      if (!r.ok) continue;
      ran += 1;
      const perDay = r.draft.summary.sessionsPerDay;
      expect(perDay).toBe(sessionsPerDay(daily, session, brk));
      const keys = r.draft.items.map((i) => `${i.date}#${i.slotIndex}`);
      expect(new Set(keys).size).toBe(keys.length);
      expect(r.draft.items.every((i) => i.slotIndex >= 0 && i.slotIndex < perDay && i.minutes <= session)).toBe(true);
      expect(r.draft.summary.scheduledMinutes).toBeLessThanOrEqual(r.draft.summary.capacityMinutes);
      expect(r.draft.summary.reserved.baseline + r.draft.summary.reserved.review + r.draft.summary.reserved.checkpoint).toBeLessThanOrEqual(percentOf(45, r.draft.summary.slots) + 1);
    }
    expect(ran).toBeGreaterThan(150);
  });
});

describe("missed sessions with several sessions a day", () => {
  const item = (id: string, date: string, slotIndex: number, position: number, kind: RebalanceItem["kind"], over: Partial<RebalanceItem> = {}): RebalanceItem => ({ id, date, slotIndex, position, kind, status: "PLANNED", rescheduledFromId: null, done: false, ...over });
  const seats = seatsFor(["2026-12-07", "2026-12-09", "2026-12-11"], 2);

  it("uses a free seat on a later day before displacing anything", () => {
    const items = [item("a", "2026-12-07", 0, 1, "TEACHING"), item("b", "2026-12-07", 1, 2, "TEACHING"), item("c", "2026-12-09", 0, 3, "TEACHING"), item("d", "2026-12-11", 0, 4, "PRACTICE"), item("e", "2026-12-11", 1, 5, "TEACHING")];
    const r = rebalance({ items, today: "2026-12-08", seats });
    expect(r.markMissed).toEqual(["a", "b"]);
    expect(r.catchUps).toEqual([
      { rescheduledFromId: "a", date: "2026-12-09", slotIndex: 1, displaces: null }, // the only empty seat
      { rescheduledFromId: "b", date: "2026-12-11", slotIndex: 0, displaces: "d" }, // practice gives way next
    ]);
    expect(r.cancel).toEqual(["d"]);
  });

  it("never puts a catch-up in a seat that is already taken (random check)", () => {
    const rand = rng(77);
    for (let n = 0; n < 200; n += 1) {
      const dates = ["2026-12-07", "2026-12-09", "2026-12-11", "2026-12-14", "2026-12-16"];
      const seatsN = seatsFor(dates, 1 + Math.floor(rand() * 3));
      const kinds: RebalanceItem["kind"][] = ["TEACHING", "TEACHING", "TEACHING", "PRACTICE", "REVIEW"];
      const items = seatsN.filter(() => rand() < 0.8).map((s, k) => item(`i${k}`, s.date, s.index, k + 1, kinds[Math.floor(rand() * kinds.length)]));
      const r = rebalance({ items, today: "2026-12-10", seats: seatsN });
      const taken = new Set(items.filter((i) => i.date >= "2026-12-10" && !r.cancel.includes(i.id)).map((i) => `${i.date}#${i.slotIndex}`));
      const placed = r.catchUps.map((c) => `${c.date}#${c.slotIndex}`);
      expect(new Set(placed).size).toBe(placed.length); // no two catch-ups share a seat
      for (const p of placed) expect(taken.has(p)).toBe(false); // and none lands on a seat that stays occupied
      for (const id of r.cancel) expect(items.find((i) => i.id === id)!.kind).not.toBe("TEACHING"); // teaching is never displaced
    }
  });

  it("only records what happened when the learner has not allowed automatic rescheduling", () => {
    const items = [item("a", "2026-12-07", 0, 1, "TEACHING"), item("b", "2026-12-09", 0, 2, "PRACTICE")];
    const r = rebalance({ items, today: "2026-12-08", seats, autoCatchUp: false });
    expect(r).toEqual({ markMissed: ["a"], catchUps: [], cancel: [], shortfall: [] });
  });
});

describe("availability answers", () => {
  const answers = (over: Record<string, unknown> = {}) => ({
    experience: "BEGINNER", goals: [{ departmentCode: "fswd", weight: 3, targetLevel: 1, note: "" }], sessionMinutes: 45, weekdays: [1, 3, 5], startTime: "18:00", timezone: "Africa/Accra", durationKind: "ONE_MONTH", startDate: "2026-12-01", ...over,
  });
  it("accepts the new fields with safe defaults, and rejects impossible ones", () => {
    const ok = onboardingSchema.safeParse(answers());
    expect(ok.success && ok.data).toMatchObject({ dailyStudyMinutes: 0, breakMinutes: 0, flexibility: "BALANCED", autoReschedule: true });
    expect(onboardingSchema.safeParse(answers({ dailyStudyMinutes: 120, breakMinutes: 10, flexibility: "STRICT", autoReschedule: false })).success).toBe(true);
    for (const bad of [{ dailyStudyMinutes: 30 }, { dailyStudyMinutes: 800 }, { breakMinutes: 90 }, { breakMinutes: -5 }, { flexibility: "WHENEVER" }, { autoReschedule: "yes" }]) {
      expect(onboardingSchema.safeParse(answers(bad)).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
