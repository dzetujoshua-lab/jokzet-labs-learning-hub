import { z } from "zod";
import { detectSecrets, secretMessage } from "@/lib/evidence/secrets";

export const EXPERIENCE = ["BEGINNER", "IMPROVER", "INTERMEDIATE", "ADVANCED"] as const;
export const DURATIONS = ["TWO_WEEKS", "ONE_MONTH", "THREE_MONTHS", "SIX_MONTHS", "ONE_YEAR", "CUSTOM"] as const;
export type DurationKind = (typeof DURATIONS)[number];

/** Fixed durations in days; CUSTOM carries its own. */
export const DURATION_DAYS: Record<Exclude<DurationKind, "CUSTOM">, number> = {
  TWO_WEEKS: 14,
  ONE_MONTH: 30,
  THREE_MONTHS: 90,
  SIX_MONTHS: 180,
  ONE_YEAR: 365,
};

export const MAX_GOALS = 5;
const NOTE_MAX = 300;

function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v, "Not a real date.");

const goal = z.object({
  departmentCode: z.string().trim().min(1).max(32),
  weight: z.number().int().min(1).max(5),
  targetLevel: z.number().int().min(0).max(5),
  note: z.string().trim().max(NOTE_MAX).optional().default(""),
});

/** What the onboarding wizard collects. The server validates all of it again; nothing from the client is trusted. */
export const onboardingSchema = z
  .object({
    experience: z.enum(EXPERIENCE),
    goals: z.array(goal).min(1, "Choose at least one subject.").max(MAX_GOALS, `Choose at most ${MAX_GOALS} subjects.`),
    sessionMinutes: z.number().int().min(15).max(240),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Choose at least one day.").max(7),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the form HH:MM."),
    timezone: z.string().trim().min(1).max(64).refine(validTimezone, "Unknown time zone."),
    durationKind: z.enum(DURATIONS),
    customDays: z.number().int().min(7).max(365).optional(),
    startDate: isoDate,
  })
  .superRefine((v, ctx) => {
    if (new Set(v.weekdays).size !== v.weekdays.length) ctx.addIssue({ code: "custom", path: ["weekdays"], message: "Each day can be chosen once." });
    if (new Set(v.goals.map((g) => g.departmentCode)).size !== v.goals.length) ctx.addIssue({ code: "custom", path: ["goals"], message: "Each subject can be chosen once." });
    if (v.durationKind === "CUSTOM" && v.customDays === undefined) ctx.addIssue({ code: "custom", path: ["customDays"], message: "Enter the number of days (7 to 365)." });
    const noteText = v.goals.map((g) => g.note ?? "").join("\n");
    const secrets = detectSecrets(noteText);
    if (secrets.length) ctx.addIssue({ code: "custom", path: ["goals"], message: secretMessage(secrets) });
  });

export type OnboardingInput = z.input<typeof onboardingSchema>;
export type OnboardingData = z.output<typeof onboardingSchema>;

export function durationDaysFor(kind: DurationKind, customDays?: number): number {
  return kind === "CUSTOM" ? (customDays ?? 0) : DURATION_DAYS[kind];
}
