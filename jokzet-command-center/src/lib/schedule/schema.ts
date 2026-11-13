import { createHash } from "node:crypto";
import { z } from "zod";
import { secretIssue } from "@/lib/evidence/secrets";
import { MAX_IMPORT_BYTES } from "./constants";
import { isValidTimezone } from "./time";

export const DAY_CODES = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 } as const;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm (24-hour time)");
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd")
  .refine((v) => new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v, "Not a real calendar date");
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,59}$/, "Use 2–60 lowercase letters, digits or hyphens");
const text = (max: number) => z.string().trim().min(1, "Required").max(max, `At most ${max} characters`);

const templateSchema = z.object({
  id: slug,
  dayOfWeek: z.enum(["SU", "MO", "TU", "WE", "TH", "FR", "SA"], { error: "Use MO, TU, WE, TH, FR, SA or SU" }),
  title: text(120),
  department: text(120),
  startTime: hhmm.optional(),
  durationMinutes: z.number().int().min(5).max(600).optional(),
  objective: text(600),
  agenda: z.array(z.object({ stage: text(40), task: text(500) })).min(1).max(12),
  evidenceTypes: z.array(text(40)).max(20).default([]),
  notificationTitle: text(200),
});

export const scheduleImportSchema = z
  .object({
    schemaVersion: z.literal("1.0", { error: 'Unsupported schemaVersion (expected "1.0")' }),
    package: z.object({
      id: slug,
      name: text(120),
      description: z.string().trim().max(500).optional(),
      brand: z.string().trim().max(60).optional(),
      tagline: z.string().trim().max(120).optional(),
    }),
    schedule: z.object({
      startDate: isoDate,
      timezone: z.string().refine(isValidTimezone, "Unknown timezone (use an IANA name such as Africa/Accra)"),
      defaultStartTime: hhmm,
      defaultDurationMinutes: z.number().int().min(5).max(600),
      recurrence: z.literal("weekly", { error: 'Only "weekly" recurrence is supported' }),
      notification: z.object({
        enabled: z.boolean(),
        trigger: z.literal("at_start", { error: 'Only the "at_start" trigger is supported' }),
        minutesBefore: z.number().int().min(0).max(1440),
        channels: z.array(z.enum(["in_app", "browser"])).max(4),
      }),
    }),
    weeklyMissions: z.array(templateSchema).length(7, "Exactly seven weekly missions are required (one for each day)"),
  })
  .superRefine((value, ctx) => {
    const days = new Set<string>();
    const ids = new Set<string>();
    value.weeklyMissions.forEach((m, i) => {
      if (days.has(m.dayOfWeek)) ctx.addIssue({ code: "custom", path: ["weeklyMissions", i, "dayOfWeek"], message: `Duplicate day ${m.dayOfWeek}` });
      if (ids.has(m.id)) ctx.addIssue({ code: "custom", path: ["weeklyMissions", i, "id"], message: `Duplicate mission id ${m.id}` });
      days.add(m.dayOfWeek);
      ids.add(m.id);
    });
  });

export type ScheduleImport = z.output<typeof scheduleImportSchema>;

export type ParseResult = { ok: true; data: ScheduleImport; hash: string } | { ok: false; errors: string[] };

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((acc, part) => (typeof part === "number" ? `${acc}[${part}]` : acc ? `${acc}.${String(part)}` : String(part)), "");
}

/** Stable JSON (sorted keys) so the same content always yields the same hash. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Scans every string value (not the JSON syntax) and returns the first secret warning, if any. */
function firstSecretIn(value: unknown, depth = 0): string | null {
  if (depth > 8) return null;
  if (typeof value === "string") return secretIssue(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstSecretIn(item, depth + 1);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const found = firstSecretIn(item, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function parseScheduleFile(raw: string): ParseResult {
  if (typeof raw !== "string" || raw.length === 0) return { ok: false, errors: ["The file is empty."] };
  if (Buffer.byteLength(raw, "utf8") > MAX_IMPORT_BYTES) return { ok: false, errors: ["The file is larger than 200 KB."] };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ["The file is not valid JSON."] };
  }

  const parsed = scheduleImportSchema.safeParse(json);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 25).map((i) => `${formatPath(i.path) || "file"}: ${i.message}`);
    return { ok: false, errors };
  }
  // Imported text is stored and shown back: no passwords, keys or tokens (same rule as every other free-text field).
  const secret = firstSecretIn(parsed.data);
  if (secret) return { ok: false, errors: [secret] };
  return { ok: true, data: parsed.data, hash: createHash("sha256").update(canonical(parsed.data)).digest("hex") };
}
