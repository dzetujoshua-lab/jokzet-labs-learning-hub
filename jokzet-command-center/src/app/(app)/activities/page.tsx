import type { Metadata } from "next";
import { ActivitiesView } from "@/components/activities/activities-view";
import { listActivities, listRecommendations, refreshRecommendations } from "@/lib/activities/service";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { ensureLearnerSetup, listDepartments } from "@/lib/missions/service";

export const metadata: Metadata = { title: "Personal activities" };

export default async function ActivitiesPage() {
  const user = await requireUser();
  await ensureLearnerSetup(user.id);
  await refreshRecommendations(user.id); // idempotent: derives offers from the learner's own assessments
  const [activities, recommendations, departments, skills] = await Promise.all([
    listActivities(user.id),
    listRecommendations(user.id),
    listDepartments(user.id),
    db.skill.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, department: { select: { code: true } } } }),
  ]);
  return (
    <ActivitiesView
      activities={activities}
      recommendations={recommendations}
      departments={departments.map((d) => ({ code: d.code, name: d.name }))}
      skills={skills.map((s) => ({ id: s.id, name: s.name, departmentCode: s.department.code }))}
    />
  );
}
