import type { CapstoneView } from "@/components/dashboard/capstone-strip";
import type { ReminderView } from "@/components/dashboard/reminder-rail";
import { db } from "@/lib/db";
import { formatInTimeZone } from "date-fns-tz";
import { PROGRAMME_TIMEZONE } from "@/lib/departments";
import { ensureLearnerSetup, listDepartments, listMissions } from "@/lib/missions/service";
import { generateInstances, listToday, listUpcoming, reconcileMissed } from "@/lib/schedule/daily";

/** Everything the Command page needs, always scoped to `userId`. */
export async function getDashboardData(userId: string) {
  await ensureLearnerSetup(userId);
  await generateInstances(userId); // idempotent: keeps the rolling window of daily missions topped up
  await reconcileMissed(userId);
  const [departments, missions, evidenceCount, assessmentsPassed, reminderRows, capstoneRow, daily, upcoming] = await Promise.all([
    listDepartments(userId),
    listMissions(userId),
    db.evidenceItem.count({ where: { userId } }),
    db.assessment.count({ where: { userId, outcome: "PASS", rubric: { mission: { category: "CURRICULUM_MISSION" } } } }), // curriculum only: practice activities are listed separately
    db.reminder.findMany({ where: { userId, status: "SCHEDULED" }, orderBy: { remindAt: "asc" }, take: 20 }),
    db.capstoneProject.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { milestones: { select: { status: true } } },
    }),
    listToday(userId),
    listUpcoming(userId),
  ]);

  const reminders: ReminderView[] = reminderRows.map((r) => ({
    id: r.id,
    title: r.title,
    date: formatInTimeZone(r.remindAt, PROGRAMME_TIMEZONE, "yyyy-MM-dd"),
    status: "open",
  }));

  const capstone: CapstoneView = capstoneRow
    ? {
        title: capstoneRow.name,
        stage: capstoneRow.milestones.filter((m) => m.status === "DONE").length,
        stages: capstoneRow.milestones.length || 8,
      }
    : null;

  return { departments, missions, evidenceCount, assessmentsPassed, reminders, capstone, daily, upcoming };
}
