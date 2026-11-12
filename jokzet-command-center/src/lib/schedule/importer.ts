import { db } from "@/lib/db";
import { isoToDate } from "@/lib/programme";
import { generateInstances, getSettings, recomputeFutureDueTimes } from "./daily";
import { DAY_CODES, parseScheduleFile, type ScheduleImport } from "./schema";
import { DAY_LABELS } from "./time";

export type ImportStatus = "new" | "unchanged" | "update";

export type MissionPreview = {
  key: string;
  dayOfWeek: number;
  dayLabel: string;
  title: string;
  department: string;
  startTime: string;
  durationMinutes: number;
  objective: string;
  stages: string[];
};

export type ImportPreview =
  | { ok: false; errors: string[] }
  | {
      ok: true;
      status: ImportStatus;
      package: { id: string; name: string; description: string | null };
      schedule: { startDate: string; timezone: string; defaultStartTime: string; defaultDurationMinutes: number };
      notification: { enabled: boolean; minutesBefore: number; channels: string[] };
      missions: MissionPreview[];
    };

function toMissions(data: ScheduleImport): MissionPreview[] {
  return data.weeklyMissions
    .map((m) => {
      const dayOfWeek = DAY_CODES[m.dayOfWeek];
      return {
        key: m.id,
        dayOfWeek,
        dayLabel: DAY_LABELS[dayOfWeek],
        title: m.title,
        department: m.department,
        startTime: m.startTime ?? data.schedule.defaultStartTime,
        durationMinutes: m.durationMinutes ?? data.schedule.defaultDurationMinutes,
        objective: m.objective,
        stages: m.agenda.map((a) => a.stage),
      };
    })
    .sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7)); // Monday first, Sunday last
}

async function statusFor(userId: string, packageId: string, hash: string): Promise<ImportStatus> {
  const existing = await db.scheduleConfig.findUnique({ where: { userId_packageId: { userId, packageId } } });
  if (!existing) return "new";
  return existing.contentHash === hash ? "unchanged" : "update";
}

/** Validates the file and describes what an import would do. Writes nothing. */
export async function previewImport(userId: string, raw: string): Promise<ImportPreview> {
  const parsed = parseScheduleFile(raw);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const { data, hash } = parsed;
  return {
    ok: true,
    status: await statusFor(userId, data.package.id, hash),
    package: { id: data.package.id, name: data.package.name, description: data.package.description ?? null },
    schedule: {
      startDate: data.schedule.startDate,
      timezone: data.schedule.timezone,
      defaultStartTime: data.schedule.defaultStartTime,
      defaultDurationMinutes: data.schedule.defaultDurationMinutes,
    },
    notification: {
      enabled: data.schedule.notification.enabled,
      minutesBefore: data.schedule.notification.minutesBefore,
      channels: data.schedule.notification.channels,
    },
    missions: toMissions(data),
  };
}

export type ImportResult =
  | { ok: false; errors: string[] }
  | { ok: true; status: ImportStatus; scheduleId: string; instancesCreated: number };

/**
 * Imports (or updates) the schedule. The file is re-validated here: the preview is never trusted. One schedule per
 * (user, package id): re-importing identical content changes nothing, and changed content updates templates in place,
 * so mission history is preserved and duplicates cannot occur.
 */
export async function confirmImport(userId: string, raw: string, now: Date = new Date()): Promise<ImportResult> {
  const parsed = parseScheduleFile(raw);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const { data, hash } = parsed;

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.scheduleConfig.findUnique({ where: { userId_packageId: { userId, packageId: data.package.id } } });
    if (existing && existing.contentHash === hash) {
      return { status: "unchanged" as const, scheduleId: existing.id };
    }

    const fields = {
      name: data.package.name,
      description: data.package.description ?? null,
      schemaVersion: data.schemaVersion,
      startDate: isoToDate(data.schedule.startDate),
      timezone: data.schedule.timezone,
      defaultStartTime: data.schedule.defaultStartTime,
      defaultDurationMinutes: data.schedule.defaultDurationMinutes,
      contentHash: hash,
      rawConfig: JSON.parse(JSON.stringify(data)),
      isActive: true,
    };
    const schedule = existing
      ? await tx.scheduleConfig.update({ where: { id: existing.id }, data: fields })
      : await tx.scheduleConfig.create({ data: { userId, packageId: data.package.id, ...fields } });

    // Park other schedules: exactly one active schedule per user.
    await tx.scheduleConfig.updateMany({ where: { userId, id: { not: schedule.id } }, data: { isActive: false } });

    const keys = data.weeklyMissions.map((m) => m.id);
    // Free the (scheduleId, dayOfWeek) slots first so a template that moved day cannot collide.
    await tx.weeklyMissionTemplate.deleteMany({ where: { scheduleId: schedule.id, key: { notIn: keys } } });
    for (const m of data.weeklyMissions) {
      const template = {
        dayOfWeek: DAY_CODES[m.dayOfWeek],
        title: m.title,
        department: m.department,
        startTime: m.startTime ?? data.schedule.defaultStartTime,
        durationMinutes: m.durationMinutes ?? data.schedule.defaultDurationMinutes,
        objective: m.objective,
        agenda: m.agenda,
        evidenceTypes: m.evidenceTypes,
        notificationTitle: m.notificationTitle,
      };
      await tx.weeklyMissionTemplate.upsert({
        where: { scheduleId_key: { scheduleId: schedule.id, key: m.id } },
        update: template,
        create: { scheduleId: schedule.id, key: m.id, ...template },
      });
    }

    // Reminder settings are created once from the file; a re-import never overwrites the user's own choices.
    if (!(await getSettings(userId, tx))) {
      const n = data.schedule.notification;
      await tx.reminderSettings.create({
        data: {
          userId,
          enabled: n.enabled,
          timezone: data.schedule.timezone,
          advanceEnabled: n.minutesBefore > 0,
          advanceMinutes: n.minutesBefore > 0 ? n.minutesBefore : 15,
          inAppEnabled: n.channels.includes("in_app"),
          browserEnabled: false, // browser notifications require an explicit permission grant by the user
        },
      });
    }
    return { status: existing ? ("update" as const) : ("new" as const), scheduleId: schedule.id };
  });

  if (result.status === "unchanged") return { ok: true, status: "unchanged", scheduleId: result.scheduleId, instancesCreated: 0 };

  const instancesCreated = await generateInstances(userId, now);
  if (result.status === "update") await recomputeFutureDueTimes(userId, now);
  return { ok: true, status: result.status, scheduleId: result.scheduleId, instancesCreated };
}
