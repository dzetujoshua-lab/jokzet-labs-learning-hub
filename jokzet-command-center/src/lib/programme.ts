import { addDays, differenceInCalendarDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { DEPARTMENTS, PROGRAMME_TIMEZONE } from "./departments";

// Ported from the Base44 export (src/lib/programme.js). Rules are unchanged.
export const XP_PER_LEVEL = 300;
export const PROGRAMME_XP_PER_LEVEL = 900;

/** Department presentation: same icon names and chart colours as Base44. */
export const DEPT_META: Record<string, { icon: string; color: string }> = {
  fswd: { icon: "Code2", color: "hsl(var(--chart-1))" },
  uxui: { icon: "PenTool", color: "hsl(var(--chart-2))" },
  sec: { icon: "ShieldAlert", color: "hsl(var(--chart-3))" },
  cloud: { icon: "Cloud", color: "hsl(var(--chart-4))" },
  sysadmin: { icon: "Server", color: "hsl(var(--chart-5))" },
  ai: { icon: "BrainCircuit", color: "hsl(var(--chart-6))" },
  photo: { icon: "Camera", color: "hsl(var(--chart-7))" },
  video: { icon: "Clapperboard", color: "hsl(var(--chart-8))" },
  biz: { icon: "Briefcase", color: "hsl(var(--chart-9))" },
};
export const metaFor = (code: string) => DEPT_META[code] ?? DEPT_META.fswd;

export const MISSION_KINDS = ["Build", "Design", "Drill", "Study", "Shoot", "Edit", "Write", "Ship"] as const;
export const EVIDENCE_TYPES = ["Screenshot", "Photo", "Video", "Code", "Document", "Link"] as const;
export type MissionKindLabel = (typeof MISSION_KINDS)[number];
export type EvidenceTypeLabel = (typeof EVIDENCE_TYPES)[number];

export const toEnum = (label: string) => label.toUpperCase();
export const toLabel = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

export const levelFromXp = (xp = 0) => Math.floor(xp / XP_PER_LEVEL);

export function levelProgress(xp = 0) {
  const level = levelFromXp(xp);
  const inLevel = xp - level * XP_PER_LEVEL;
  return { level, inLevel, target: XP_PER_LEVEL, pct: Math.round((inLevel / XP_PER_LEVEL) * 100) };
}

// ── Dates: the programme runs in Africa/Accra, never the server's or browser's timezone ──
export const todayISO = (now: Date = new Date()) => formatInTimeZone(now, PROGRAMME_TIMEZONE, "yyyy-MM-dd");
export const isoToDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`); // @db.Date columns
export const dateToISO = (date: Date) => date.toISOString().slice(0, 10);

/** "Mon 16 Nov": same format as Base44 (moment 'ddd D MMM'). */
export const fmtDate = (iso?: string | null) =>
  iso ? formatInTimeZone(isoToDate(iso), "UTC", "EEE d MMM") : "—";
export const fmtLongToday = (now: Date = new Date()) => formatInTimeZone(now, PROGRAMME_TIMEZONE, "EEEE · d MMM yyyy");

export const isPast = (iso?: string | null) => !!iso && iso < todayISO();

/** ISO Monday of the week containing `iso`. */
export function isoWeekStart(iso: string): string {
  const d = isoToDate(iso);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return dateToISO(addDays(d, -dow));
}
export const sameIsoWeek = (a: string, b: string) => isoWeekStart(a) === isoWeekStart(b);
export const fmtWeekOf = (iso: string) => `Week of ${formatInTimeZone(isoToDate(isoWeekStart(iso)), "UTC", "d MMM")}`;

/** Consecutive days (ending today, or yesterday if today has none) with a completed mission. */
export function computeStreak(dateStrings: (string | null | undefined)[], today = todayISO()): number {
  const done = new Set(dateStrings.filter(Boolean) as string[]);
  let cursor = isoToDate(today);
  if (!done.has(dateToISO(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (done.has(dateToISO(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export const daysBetween = (a: string, b: string) => differenceInCalendarDays(isoToDate(a), isoToDate(b));

export const DEPARTMENT_ORDER = DEPARTMENTS.map((d) => d.code);

/** Maps a free-text department name (e.g. from an imported schedule) to one of the nine department codes. */
export function deptCodeFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("full-stack") || n.includes("fullstack")) return "fswd";
  if (n.includes("ui/ux") || n.includes("design")) return "uxui";
  if (n.includes("ethical") || n.includes("cyber") || n.includes("security")) return "sec";
  if (n.includes("cloud")) return "cloud";
  if (n.includes("server") || n.includes("system")) return "sysadmin";
  if (n.includes("photo")) return "photo";
  if (n.includes("video")) return "video";
  if (n.includes("ai ") || n.includes("ai,") || n.startsWith("ai") || n.includes("automation")) return "ai";
  if (n.includes("business") || n.includes("career")) return "biz";
  return "fswd";
}
