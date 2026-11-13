import { addDaysISO, weekdayOf } from "@/lib/schedule/time";

/**
 * Pure helpers for the timetable screens (day, week, month). Dates are local calendar dates (yyyy-MM-dd) in the learner's time
 * zone; nothing here reads the clock or the database.
 */
export type TimetableView = "day" | "week" | "month";

export const parseView = (v: string | undefined): TimetableView => (v === "week" || v === "month" ? v : "day");

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** A usable date from the address bar, otherwise today. */
export function parseDate(v: string | undefined, today: string): string {
  if (!v || !ISO.test(v)) return today;
  const t = Date.parse(`${v}T00:00:00Z`);
  if (Number.isNaN(t)) return today; // e.g. month 13: never let a bad address throw
  return new Date(t).toISOString().slice(0, 10) === v ? v : today; // and reject impossible days such as 30 February
}

/** The Monday of the calendar week a date falls in (weeks run Monday to Sunday). */
export function mondayOf(iso: string): string {
  const back = (weekdayOf(iso) + 6) % 7; // Monday = 0 … Sunday = 6
  return addDaysISO(iso, -back);
}

export const weekDates = (iso: string): string[] => Array.from({ length: 7 }, (_, i) => addDaysISO(mondayOf(iso), i));

export type MonthCell = { date: string; inMonth: boolean };

/** The weeks (Monday first) that cover a month, each as seven cells. */
export function monthGrid(iso: string): MonthCell[][] {
  const first = `${iso.slice(0, 7)}-01`;
  const month = iso.slice(0, 7);
  const start = mondayOf(first);
  const weeks: MonthCell[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const row = Array.from({ length: 7 }, (_, d) => {
      const date = addDaysISO(start, w * 7 + d);
      return { date, inMonth: date.slice(0, 7) === month };
    });
    if (w > 0 && !row.some((c) => c.inMonth)) break;
    weeks.push(row);
  }
  return weeks;
}

export const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;
export function shiftMonth(iso: string, delta: number): string {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** Where the previous / next screen of a view starts. */
export function stepDate(view: TimetableView, iso: string, delta: 1 | -1): string {
  return view === "day" ? addDaysISO(iso, delta) : view === "week" ? addDaysISO(mondayOf(iso), 7 * delta) : shiftMonth(iso, delta);
}

export type SessionState = "done" | "missed" | "catch-up" | "practised" | "planned" | "cancelled";

/** How a session looks on screen. "Done" is derived from the learner's own work, never from the clock. */
export function stateOf(i: { status: string; kind: string; done: boolean; practised: boolean }): SessionState {
  if (i.status === "CANCELLED") return "cancelled";
  if (i.status === "MISSED") return "missed";
  if (i.done) return "done";
  if (i.practised) return "practised";
  if (i.kind === "CATCH_UP") return "catch-up";
  return "planned";
}

export type ProgressItem = { status: string; kind: string; date: string; done: boolean; practised: boolean };

/** Planned versus completed. Cancelled sessions are not part of the plan; missed ones are counted and stay visible. */
export function progressOf(items: ProgressItem[]): { total: number; completed: number; missed: number; percent: number } {
  const live = items.filter((i) => i.status !== "CANCELLED");
  const completed = live.filter((i) => i.done || i.practised).length;
  const missed = live.filter((i) => i.status === "MISSED").length;
  return { total: live.length, completed, missed, percent: live.length ? Math.round((completed / live.length) * 100) : 0 };
}

/**
 * When the programme should finish: the date of the last session still to do, or the plan's end when nothing is left.
 * "On track" means no session was missed without a catch-up to replace it.
 */
export function finishEstimate(
  items: { id: string; date: string; status: string; kind: string; done: boolean; rescheduledFromId: string | null }[],
  planEnd: string,
): { date: string; onTrack: boolean } {
  const live = items.filter((i) => i.status !== "CANCELLED");
  const remaining = live.filter((i) => i.status === "PLANNED" && !i.done).map((i) => i.date).sort();
  const covered = new Set(live.filter((i) => i.kind === "CATCH_UP" && i.rescheduledFromId).map((i) => i.rescheduledFromId as string));
  const onTrack = live.filter((i) => i.status === "MISSED").every((i) => covered.has(i.id));
  return { date: remaining.length ? remaining[remaining.length - 1] : planEnd, onTrack };
}

/** A sentence for one history row (what happened, in plain words). */
export function describeEvent(e: { type: string; fromDate: string | null; toDate: string | null; note: string | null }, fmt: (iso: string) => string = (x) => x): { title: string; detail: string } {
  const d = (x: string | null) => (x ? fmt(x) : "");
  switch (e.type) {
    case "GENERATED": return { title: "Plan created", detail: e.note ?? "" };
    case "ACTIVATED": return { title: "Plan started", detail: "" };
    case "MISSED": return { title: "Session missed", detail: d(e.fromDate) };
    case "CATCH_UP_CREATED": return { title: "Catch-up added", detail: `${d(e.fromDate)} → ${d(e.toDate)}` };
    case "PAUSED": return { title: "Plan paused", detail: "" };
    case "RESUMED": return { title: "Plan resumed", detail: e.note ?? "" };
    case "EXTENDED": return { title: "Plan extended", detail: `${d(e.fromDate)} → ${d(e.toDate)}` };
    case "SUBJECTS_CHANGED": return { title: "Subjects changed", detail: "" };
    case "ITEMS_RELEASED": return { title: "Unstarted work released", detail: e.note ?? "" };
    case "RESCHEDULED": return { title: "Session moved", detail: `${d(e.fromDate)} → ${d(e.toDate)}` };
    case "AVAILABILITY_CHANGED": return { title: "Study times changed", detail: e.note ?? "A new timetable was built from that day" };
    case "PREFERENCES_CHANGED": return { title: "Preferences changed", detail: e.note ?? "" };
    case "COMPLETED": return { title: "Plan completed", detail: "" };
    default: return { title: e.type, detail: "" };
  }
}
