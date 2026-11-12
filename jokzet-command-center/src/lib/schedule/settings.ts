import { z } from "zod";
import { db } from "@/lib/db";
import { ADVANCE_CHOICES } from "./constants";
import { generateInstances, recomputeFutureDueTimes } from "./daily";
import { isValidTimezone } from "./time";


export const settingsSchema = z.object({
  enabled: z.boolean(),
  reminderTime: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm (24-hour time)")]).transform((v) => (v === "" ? null : v)),
  timezone: z.string().refine(isValidTimezone, "Unknown timezone"),
  advanceEnabled: z.boolean(),
  advanceMinutes: z.number().int().refine((n) => (ADVANCE_CHOICES as readonly number[]).includes(n), "Pick one of the listed lead times"),
  inAppEnabled: z.boolean(),
  browserEnabled: z.boolean(),
  pushEnabled: z.boolean(),
});
export type SettingsInput = z.input<typeof settingsSchema>;

export type SettingsResult = { ok: true } | { ok: false; error: string };

export async function updateSettings(userId: string, input: SettingsInput, now: Date = new Date()): Promise<SettingsResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  const data = parsed.data;

  const before = await db.reminderSettings.findUnique({ where: { userId } });
  await db.reminderSettings.upsert({ where: { userId }, update: data, create: { userId, ...data } });

  if (!before || before.timezone !== data.timezone || before.reminderTime !== data.reminderTime) {
    await generateInstances(userId, now); // new timezone can change "today"
    await recomputeFutureDueTimes(userId, now);
  }
  return { ok: true };
}

export async function setChannelFlag(userId: string, flag: "browserEnabled" | "pushEnabled", value: boolean): Promise<void> {
  await db.reminderSettings.updateMany({ where: { userId }, data: { [flag]: value } });
}
