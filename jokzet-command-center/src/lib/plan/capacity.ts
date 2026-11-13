import { addDaysISO, weekdayOf } from "@/lib/schedule/time";

/**
 * Capacity arithmetic for the plan generator. Pure and INTEGER ONLY: floating point (`0.55 * S`) gives false violations of
 * the reserve rules, so every share is `floor(percent * S / 100)`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `fromISO` to `toISO` (calendar dates, independent of any time zone). */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / DAY_MS);
}

/** Study slots: the local dates from `startDate` for `durationDays` days whose weekday is one the learner chose. */
export function slotDates(startDate: string, durationDays: number, weekdays: number[]): string[] {
  const days = new Set(weekdays);
  const out: string[] = [];
  for (let i = 0; i < durationDays; i += 1) {
    const iso = addDaysISO(startDate, i);
    if (days.has(weekdayOf(iso))) out.push(iso);
  }
  return out;
}

/** 1-based week of the plan that a date falls in (week 1 starts on the plan's start date). */
export const weekNumberOf = (date: string, startDate: string): number => Math.floor(daysBetween(startDate, date) / 7) + 1;

export const percentOf = (percent: number, slots: number): number => Math.floor((percent * slots) / 100);

/** Number of phases for a plan: fixed for the named durations, derived for a custom one, one for a very small plan. */
export function phaseCount(durationDays: number, slots: number): number {
  if (slots < 4) return 1;
  const fixed: Record<number, number> = { 14: 2, 30: 3, 90: 4, 180: 6, 365: 8 };
  if (fixed[durationDays]) return fixed[durationDays];
  const weeks = durationDays / 7;
  return Math.min(8, Math.max(2, Math.round(weeks / 4)));
}

export type Reserves = { baselineCap: number; reviewCap: number; checkpointCap: number };

/**
 * How many slots may be set aside. baseline <= 20% of S, review <= 15%, checkpoint <= 10% (a checkpoint may share a review
 * slot, so review + checkpoint never exceeds 25%): teaching keeps at least 55%.
 */
export function reserves(slots: number, phases: number): Reserves {
  return {
    baselineCap: percentOf(20, slots),
    reviewCap: slots < 4 ? 0 : percentOf(15, slots),
    checkpointCap: slots < 4 ? (slots >= 3 ? 1 : 0) : Math.min(phases, percentOf(10, slots)),
  };
}

/** Splits `total` across weights with the largest-remainder method; ties go to the earlier entry. Integers only. */
export function allocateByWeight(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum || total <= 0) return weights.map(() => 0);
  const base = weights.map((w) => Math.floor((total * w) / sum));
  const rem = weights.map((w, i) => ({ i, r: (total * w) % sum }));
  let left = total - base.reduce((a, b) => a + b, 0);
  rem.sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of rem) {
    if (left <= 0) break;
    base[i] += 1;
    left -= 1;
  }
  return base;
}
