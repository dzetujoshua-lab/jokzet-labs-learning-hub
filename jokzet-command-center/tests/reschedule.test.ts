import { describe, expect, it } from "vitest";
import { availabilitySchema } from "@/lib/plan/schema";
import { canMove, moveOptions, validateMove, type MoveContext, type MoveItem } from "@/lib/plan/reschedule";
import { describeEvent } from "@/lib/plan/timetable";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const NOW = new Date("2026-12-09T12:00:00.000Z"); // Wednesday 9 December, noon
const instantOf = (date: string, slot: number) => new Date(Date.parse(`${date}T18:00:00.000Z`) + slot * 55 * 60_000);

const item = (id: string, date: string, slotIndex: number, over: Partial<MoveItem> = {}): MoveItem => ({
  id, date, slotIndex, kind: "TEACHING", status: "PLANNED", done: false, startsAt: instantOf(date, slotIndex), departmentCode: "fswd", missionOrder: 1, stepFrom: 1, ...over,
});

const ctx = (items: MoveItem[], over: Partial<MoveContext> = {}): MoveContext => ({
  items, weekdays: [1, 3, 5], perDay: 2, planStart: "2026-12-07", planEnd: "2027-01-08", today: "2026-12-09", now: NOW, instantOf, ...over,
});

// Mission A (order 1) steps 1, 3 and the submit unit; mission B (order 2) step 1.
const A1 = item("a1", "2026-12-09", 1, { stepFrom: 1 });
const A2 = item("a2", "2026-12-11", 0, { stepFrom: 3 });
const A3 = item("a3", "2026-12-14", 0, { stepFrom: null });
const B1 = item("b1", "2026-12-16", 0, { missionOrder: 2, stepFrom: 1 });
const base = () => [A1, A2, A3, B1];
const code = (c: MoveContext, id: string, date: string, slotIndex: number) => {
  const r = validateMove(c, id, { date, slotIndex });
  return r.ok ? "OK" : r.code;
};

describe("which sessions can move", () => {
  it("allows only upcoming, undone, not-yet-started sessions", () => {
    expect(canMove(A2, "2026-12-09", NOW)).toBe(true);
    expect(canMove({ ...A2, done: true }, "2026-12-09", NOW)).toBe(false);
    expect(canMove({ ...A2, status: "MISSED" }, "2026-12-09", NOW)).toBe(false);
    expect(canMove({ ...A2, status: "CANCELLED" }, "2026-12-09", NOW)).toBe(false);
    expect(canMove(item("early", "2026-12-09", 0, { startsAt: new Date("2026-12-09T10:00:00Z") }), "2026-12-09", NOW)).toBe(false); // already started today
    expect(canMove(item("old", "2026-12-07", 0), "2026-12-09", NOW)).toBe(false); // the past is never rewritten
  });
});

// An unrelated session (another subject, its own order) for the checks that are not about curriculum order, and a practice session.
const S1 = item("s1", "2026-12-18", 0, { departmentCode: "sec", missionOrder: 1, stepFrom: 1 });
const P1 = item("p1", "2026-12-21", 1, { kind: "PRACTICE", missionOrder: null });

describe("validating a move", () => {
  const c = ctx([...base(), S1, P1]);

  it("accepts a free, valid slot", () => {
    expect(code(c, "s1", "2026-12-23", 0)).toBe("OK");
    expect(code(c, "s1", "2026-12-18", 1)).toBe("OK"); // same day, other session
    expect(code(c, "s1", "2026-12-09", 0)).toBe("OK"); // earlier is fine for work with no ordering constraint (today 18:00 is still ahead of noon)
  });

  it("refuses sessions that cannot move", () => {
    expect(code(c, "nope", "2026-12-23", 0)).toBe("NOT_FOUND");
    expect(code(ctx([{ ...S1, done: true }]), "s1", "2026-12-23", 0)).toBe("NOT_MOVABLE");
    expect(code(ctx([{ ...S1, status: "MISSED" }]), "s1", "2026-12-23", 0)).toBe("NOT_MOVABLE");
    expect(code(ctx([{ ...S1, status: "CANCELLED" }]), "s1", "2026-12-23", 0)).toBe("NOT_MOVABLE");
    expect(code(ctx([item("started", "2026-12-09", 0, { departmentCode: "sec", startsAt: new Date("2026-12-09T10:00:00Z") })]), "started", "2026-12-23", 0)).toBe("NOT_MOVABLE");
  });

  it("checks the target slot", () => {
    expect(code(c, "s1", "2026-12-18", 0)).toBe("SAME");
    expect(code(c, "s1", "2026-12-04", 0)).toBe("OUTSIDE_PLAN"); // before the plan
    expect(code(c, "s1", "2027-01-15", 0)).toBe("OUTSIDE_PLAN"); // after the plan
    expect(code(c, "s1", "2026-12-15", 0)).toBe("NOT_STUDY_DAY"); // a Tuesday
    expect(code(c, "s1", "2026-12-23", 2)).toBe("BAD_SLOT"); // only two sessions a day
    expect(code(c, "s1", "2026-12-23", -1)).toBe("BAD_SLOT");
    expect(code(c, "s1", "2026-12-23", 1.5)).toBe("BAD_SLOT");
    expect(code(c, "s1", "2026-12-07", 0)).toBe("PAST"); // inside the plan, but before today
  });

  it("keeps the rule about the past exact: a slot already started is refused, a later one today is fine", () => {
    const late = ctx([S1], { now: new Date("2026-12-09T18:30:00.000Z") }); // 18:30: the 18:00 session has started
    expect(code(late, "s1", "2026-12-09", 0)).toBe("PAST");
    expect(code(late, "s1", "2026-12-09", 1)).toBe("OK"); // 18:55 is still ahead
  });

  it("never double-books a seat, but a cancelled session does not block one", () => {
    expect(code(c, "s1", "2026-12-21", 1)).toBe("OCCUPIED"); // p1 is there
    const withCancelled = ctx([S1, item("x", "2026-12-23", 0, { status: "CANCELLED", missionOrder: null, departmentCode: null })]);
    expect(code(withCancelled, "s1", "2026-12-23", 0)).toBe("OK");
  });

  it("respects the curriculum order inside a subject", () => {
    expect(code(c, "a1", "2026-12-18", 1)).toBe("ORDER"); // step 1 may not move behind step 3 and the submit unit
    expect(code(c, "a2", "2026-12-18", 1)).toBe("ORDER"); // step 3 may not move behind the submit unit
    expect(code(c, "b1", "2026-12-11", 1)).toBe("ORDER"); // mission B may not jump ahead of mission A's remaining work
    expect(code(c, "a3", "2026-12-16", 1)).toBe("ORDER"); // the submit unit may not move behind mission B
    expect(code(c, "a2", "2026-12-11", 1)).toBe("OK"); // between a1 and a3 stays in order
    expect(code(c, "a3", "2026-12-14", 1)).toBe("OK"); // later the same day, still before mission B
    expect(code(c, "b1", "2026-12-23", 0)).toBe("OK"); // later is always in order
  });

  it("does not apply the order rule to practice, review or other subjects", () => {
    expect(code(c, "p1", "2026-12-11", 1)).toBe("OK");
    expect(code(c, "s1", "2026-12-09", 0)).toBe("OK");
  });

  it("tolerates a problem that already existed but never lets a move create a new one", () => {
    // b1 was already placed before a3 (for example by an earlier catch-up). Unrelated moves are still allowed.
    const crooked = ctx([A1, A2, item("a3", "2026-12-21", 0, { stepFrom: null }), B1, S1]);
    expect(code(crooked, "s1", "2026-12-28", 0)).toBe("OK");
    expect(code(crooked, "a2", "2026-12-11", 1)).toBe("OK"); // no new problem
    expect(code(crooked, "a2", "2026-12-28", 0)).toBe("ORDER"); // behind a3 (and b1): a NEW problem
  });
});

describe("move options", () => {
  const c = ctx([...base(), S1, P1]);
  it("lists only valid, free slots in date order, and stops at the limit", () => {
    const opts = moveOptions(c, "s1", 8);
    expect(opts).toHaveLength(8);
    for (const o of opts) expect(validateMove(c, "s1", o).ok).toBe(true);
    const keys = opts.map((o) => `${o.date}#${o.slotIndex}`);
    expect([...keys].sort()).toEqual(keys);
    expect(opts.every((o) => [1, 3, 5].includes(new Date(`${o.date}T00:00:00Z`).getUTCDay()))).toBe(true);
    expect(opts.every((o) => instantOf(o.date, o.slotIndex).getTime() > NOW.getTime())).toBe(true);
    const all = moveOptions(c, "s1", 500).map((o) => `${o.date}#${o.slotIndex}`);
    expect(all).not.toContain("2026-12-21#1"); // p1's seat
    expect(all).not.toContain("2026-12-18#0"); // where s1 already is
  });
  it("offers only the slots that keep the curriculum order for ordered work", () => {
    expect(moveOptions(c, "a2", 50)).toEqual([{ date: "2026-12-11", slotIndex: 1 }]); // between a1 and a3, and nowhere else
  });
  it("offers nothing for a session that cannot move", () => {
    expect(moveOptions(ctx([{ ...S1, done: true }]), "s1")).toEqual([]);
  });
  it("offers nothing when every seat is taken", () => {
    const o = (id: string, d: string, s: number) => item(id, d, s, { departmentCode: null, missionOrder: null });
    const full = ctx([o("x", "2026-12-11", 0), o("o1", "2026-12-09", 0), o("o2", "2026-12-09", 1), o("o3", "2026-12-11", 1)], { planStart: "2026-12-09", planEnd: "2026-12-11" });
    expect(moveOptions(full, "x")).toEqual([]);
  });
});

describe("a valid move can never break the plan (property test)", () => {
  it("never double-books a seat and never adds an ordering problem, for hundreds of random plans and moves", () => {
    const rand = rng(8300);
    const dates = ["2026-12-09", "2026-12-11", "2026-12-14", "2026-12-16", "2026-12-18", "2026-12-21", "2026-12-23", "2026-12-28", "2026-12-30", "2027-01-04"];
    let moves = 0;
    for (let n = 0; n < 300; n += 1) {
      const seats = dates.flatMap((d) => [0, 1].map((s) => ({ d, s }))).filter(() => rand() < 0.6);
      const items = seats.map((x, k) => item(`i${k}`, x.d, x.s, { kind: rand() < 0.15 ? "PRACTICE" : "TEACHING", missionOrder: Math.floor(rand() * 3) + 1, stepFrom: Math.floor(rand() * 4), departmentCode: rand() < 0.7 ? "fswd" : "sec", status: rand() < 0.1 ? "CANCELLED" : "PLANNED", done: rand() < 0.1 }));
      const c = ctx(items, { planEnd: "2027-01-08" });
      for (const it of items) {
        for (const o of moveOptions(c, it.id, 5)) {
          moves += 1;
          const moved = items.map((i) => (i.id === it.id ? { ...i, date: o.date, slotIndex: o.slotIndex, startsAt: instantOf(o.date, o.slotIndex) } : i));
          const live = moved.filter((i) => i.status !== "CANCELLED").map((i) => `${i.date}#${i.slotIndex}`);
          expect(new Set(live).size).toBe(live.length); // no seat holds two live sessions
          expect(items.find((i) => i.id === it.id)!.done).toBe(false);
          expect(items.find((i) => i.id === it.id)!.status).toBe("PLANNED");
        }
      }
    }
    expect(moves).toBeGreaterThan(500);
  });
});

describe("history wording and availability answers", () => {
  it("describes the new kinds of history", () => {
    expect(describeEvent({ type: "RESCHEDULED", fromDate: "2026-12-09", toDate: "2026-12-11", note: null })).toEqual({ title: "Session moved", detail: "2026-12-09 → 2026-12-11" });
    expect(describeEvent({ type: "PREFERENCES_CHANGED", fromDate: null, toDate: null, note: "Flexibility strict" })).toEqual({ title: "Preferences changed", detail: "Flexibility strict" });
    expect(describeEvent({ type: "AVAILABILITY_CHANGED", fromDate: null, toDate: null, note: null })).toEqual({ title: "Study times changed", detail: "A new timetable was built from that day" });
    expect(describeEvent({ type: "RESCHEDULED", fromDate: "2026-12-11", toDate: "2026-12-09", note: null }, (d) => `<${d.slice(8)}>`).detail).toBe("<11> → <09>"); // dates go through the formatter
  });
  it("validates changed availability like onboarding does", () => {
    const ok = { weekdays: [1, 3], startTime: "07:30", sessionMinutes: 45, dailyStudyMinutes: 0, breakMinutes: 0, flexibility: "BALANCED", autoReschedule: true };
    expect(availabilitySchema.safeParse(ok).success).toBe(true);
    for (const bad of [{ weekdays: [] }, { weekdays: [1, 1] }, { weekdays: [9] }, { startTime: "7:30" }, { sessionMinutes: 10 }, { dailyStudyMinutes: 30 }, { breakMinutes: 90 }, { flexibility: "ANY" }, { autoReschedule: "yes" }]) {
      expect(availabilitySchema.safeParse({ ...ok, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
