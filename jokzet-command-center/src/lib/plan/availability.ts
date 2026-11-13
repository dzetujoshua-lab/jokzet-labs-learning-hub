import { addDaysISO, startInstant } from "@/lib/schedule/time";

/**
 * Learner availability. Pure. A learner chooses study DAYS, a daily start time, how long one session lasts, how much study
 * time they have on a day and how long a break should be between sessions. From that the number of sessions per day is
 * derived (never stored, so it can never disagree with the inputs).
 */
export const MAX_SESSIONS_PER_DAY = 4;

export function sessionsPerDay(dailyStudyMinutes: number, sessionMinutes: number, breakMinutes: number): number {
  if (dailyStudyMinutes <= 0) return 1; // 0 = "one session a day"
  const n = Math.floor((dailyStudyMinutes + breakMinutes) / (sessionMinutes + breakMinutes));
  return Math.max(1, Math.min(MAX_SESSIONS_PER_DAY, n));
}

/** One place where a session can go: a study day and which session of that day (0 = first). */
export type Seat = { date: string; index: number };

/** Every seat for the given study days, in order: all of day one, then all of day two, and so on. */
export function seatsFor(dates: string[], perDay: number): Seat[] {
  const out: Seat[] = [];
  for (const date of dates) for (let index = 0; index < perDay; index += 1) out.push({ date, index });
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The UTC instant a session starts. The learner's intent is wall-clock: session k of a day starts `k * (session + break)`
 * minutes after the daily start time ON THEIR CLOCK. When that passes midnight the session starts on the next calendar day
 * but still belongs to the plan day it was scheduled for. A local time that does not exist (spring-forward gap) resolves one
 * hour earlier and an ambiguous one to its first occurrence (see `startInstant`).
 */
export function sessionInstant(date: string, index: number, startTime: string, sessionMinutes: number, breakMinutes: number, timezone: string): Date {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + index * (sessionMinutes + breakMinutes);
  const dayShift = Math.floor(total / 1440);
  const minutes = total % 1440;
  const day = dayShift ? addDaysISO(date, dayShift) : date;
  return startInstant(day, `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`, timezone);
}
