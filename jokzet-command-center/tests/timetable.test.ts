import { describe, expect, it } from "vitest";
import { describeEvent, finishEstimate, firstOfMonth, mondayOf, monthGrid, parseDate, parseView, progressOf, shiftMonth, stateOf, stepDate, weekDates } from "@/lib/plan/timetable";

describe("view and date parsing", () => {
  it("falls back to the day view and to today for anything unusable", () => {
    expect(parseView(undefined)).toBe("day");
    expect(parseView("week")).toBe("week");
    expect(parseView("month")).toBe("month");
    expect(parseView("year")).toBe("day");
    expect(parseView("<script>")).toBe("day");
    expect(parseDate("2026-12-09", "2026-12-01")).toBe("2026-12-09");
    for (const bad of [undefined, "", "tomorrow", "2026-13-01", "2026-02-30", "2026-1-1", "20261209", "2026-12-09T00:00"]) expect(parseDate(bad, "2026-12-01")).toBe("2026-12-01");
  });
});

describe("weeks and months", () => {
  it("runs weeks Monday to Sunday", () => {
    expect(mondayOf("2026-12-07")).toBe("2026-12-07"); // a Monday
    expect(mondayOf("2026-12-13")).toBe("2026-12-07"); // the Sunday of that week
    expect(mondayOf("2026-12-14")).toBe("2026-12-14");
    expect(weekDates("2026-12-10")).toEqual(["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12", "2026-12-13"]);
    expect(mondayOf("2027-01-01")).toBe("2026-12-28"); // across the new year
  });

  it("builds a month grid of whole weeks that covers every day exactly once", () => {
    for (const month of ["2026-02-10", "2026-03-31", "2026-12-01", "2027-02-28", "2028-02-29", "2026-11-15"]) {
      const weeks = monthGrid(month);
      expect(weeks.every((w) => w.length === 7)).toBe(true);
      const cells = weeks.flat();
      const dates = cells.map((c) => c.date);
      expect(new Set(dates).size).toBe(dates.length);
      expect([...dates].sort()).toEqual(dates); // in order
      expect(new Date(`${dates[0]}T00:00:00Z`).getUTCDay()).toBe(1); // starts on a Monday
      const inMonth = cells.filter((c) => c.inMonth).map((c) => c.date);
      const [y, m] = month.split("-").map(Number);
      expect(inMonth).toHaveLength(new Date(Date.UTC(y, m, 0)).getUTCDate()); // every day of the month, once
      expect(inMonth.every((d) => d.startsWith(month.slice(0, 7)))).toBe(true);
      expect(weeks.length).toBeGreaterThanOrEqual(4);
      expect(weeks.length).toBeLessThanOrEqual(6);
      expect(weeks[weeks.length - 1].some((c) => c.inMonth)).toBe(true); // no empty trailing week
    }
    expect(monthGrid("2026-02-10")).toHaveLength(5); // 1 February 2026 is a Sunday, so its Monday-first weeks begin on 26 January
    expect(monthGrid("2027-02-10")).toHaveLength(4); // 1 February 2027 is a Monday and the month has 28 days: exactly four weeks
  });

  it("moves to the previous and next screen of each view, across month and year ends", () => {
    expect(shiftMonth("2026-12-15", 1)).toBe("2027-01-01");
    expect(shiftMonth("2027-01-20", -1)).toBe("2026-12-01");
    expect(shiftMonth("2026-03-31", -1)).toBe("2026-02-01");
    expect(firstOfMonth("2026-12-15")).toBe("2026-12-01");
    expect(stepDate("day", "2026-12-31", 1)).toBe("2027-01-01");
    expect(stepDate("day", "2026-03-01", -1)).toBe("2026-02-28");
    expect(stepDate("week", "2026-12-10", 1)).toBe("2026-12-14");
    expect(stepDate("week", "2026-12-10", -1)).toBe("2026-11-30");
    expect(stepDate("month", "2026-12-15", -1)).toBe("2026-11-01");
  });
});

describe("how a session looks", () => {
  const s = (over: Partial<Parameters<typeof stateOf>[0]> = {}) => ({ status: "PLANNED", kind: "TEACHING", done: false, practised: false, ...over });
  it("derives the state from the learner's work and the plan's status", () => {
    expect(stateOf(s())).toBe("planned");
    expect(stateOf(s({ done: true }))).toBe("done");
    expect(stateOf(s({ status: "MISSED" }))).toBe("missed");
    expect(stateOf(s({ status: "MISSED", done: true }))).toBe("missed"); // a missed record is never rewritten by later work
    expect(stateOf(s({ kind: "CATCH_UP" }))).toBe("catch-up");
    expect(stateOf(s({ kind: "CATCH_UP", done: true }))).toBe("done");
    expect(stateOf(s({ kind: "PRACTICE", practised: true }))).toBe("practised");
    expect(stateOf(s({ status: "CANCELLED" }))).toBe("cancelled");
  });

  it("counts planned against completed, leaving cancelled sessions out and missed ones visible", () => {
    const item = (status: string, done = false, practised = false) => ({ status, kind: "TEACHING", date: "2026-12-07", done, practised });
    expect(progressOf([])).toEqual({ total: 0, completed: 0, missed: 0, percent: 0 });
    expect(progressOf([item("PLANNED", true), item("PLANNED"), item("MISSED"), item("CANCELLED"), item("PLANNED", false, true)])).toEqual({ total: 4, completed: 2, missed: 1, percent: 50 });
  });

  it("estimates the finish from the last session still to do, and says whether the plan is on track", () => {
    const it = (id: string, date: string, status: string, kind = "TEACHING", done = false, from: string | null = null) => ({ id, date, status, kind, done, rescheduledFromId: from });
    const items = [it("a", "2026-12-07", "MISSED"), it("b", "2026-12-09", "PLANNED", "TEACHING", true), it("c", "2026-12-14", "PLANNED"), it("d", "2026-12-16", "PLANNED", "CATCH_UP", false, "a"), it("e", "2026-12-18", "CANCELLED")];
    expect(finishEstimate(items, "2026-12-30")).toEqual({ date: "2026-12-16", onTrack: true }); // the miss has its catch-up
    expect(finishEstimate(items.filter((i) => i.id !== "d"), "2026-12-30")).toEqual({ date: "2026-12-14", onTrack: false }); // missed without a catch-up
    expect(finishEstimate(items.map((i) => ({ ...i, done: true, status: i.status === "MISSED" ? "MISSED" : i.status })).filter((i) => i.status !== "PLANNED" || i.done), "2026-12-30").date).toBe("2026-12-30"); // nothing left: the plan's end
  });

  it("describes history in plain words", () => {
    expect(describeEvent({ type: "CATCH_UP_CREATED", fromDate: "2026-12-07", toDate: "2026-12-11", note: null })).toEqual({ title: "Catch-up added", detail: "2026-12-07 → 2026-12-11" });
    expect(describeEvent({ type: "GENERATED", fromDate: null, toDate: null, note: "24 sessions" })).toEqual({ title: "Plan created", detail: "24 sessions" });
    expect(describeEvent({ type: "PAUSED", fromDate: null, toDate: null, note: null }).title).toBe("Plan paused");
    expect(describeEvent({ type: "SOMETHING_NEW", fromDate: null, toDate: null, note: null }).title).toBe("SOMETHING_NEW"); // never crashes on an unknown type
  });
});
