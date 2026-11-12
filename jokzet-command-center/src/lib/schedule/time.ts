import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { dateToISO, isoToDate } from "@/lib/programme";

export const DEFAULT_TIMEZONE = "Africa/Accra";

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The local calendar date (yyyy-MM-dd) of an instant in a timezone. */
export const localDateOf = (instant: Date, tz: string) => formatInTimeZone(instant, tz, "yyyy-MM-dd");

/** Local wall-clock HH:mm of an instant in a timezone. */
export const localTimeOf = (instant: Date, tz: string) => formatInTimeZone(instant, tz, "HH:mm");

/** 0 = Sunday … 6 = Saturday for a calendar date (independent of any timezone). */
export const weekdayOf = (iso: string) => isoToDate(iso).getUTCDay();

export const addDaysISO = (iso: string, days: number) => dateToISO(addDays(isoToDate(iso), days));

/** The UTC instant at which `hhmm` occurs on calendar date `iso` in `tz` (DST-safe). */
export const startInstant = (iso: string, hhmm: string, tz: string) => fromZonedTime(`${iso}T${hhmm}:00`, tz);

export const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
