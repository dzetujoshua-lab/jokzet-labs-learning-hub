import { db } from "@/lib/db";
import { dateToISO } from "@/lib/programme";
import { ensureLearnerSetup, listDepartments, listMissions } from "@/lib/missions/service";

/** Everything the department page shows, scoped to `userId`. Returns null for an unknown department code. */
export async function getDepartmentDetail(userId: string, code: string) {
  await ensureLearnerSetup(userId);
  const departments = await listDepartments(userId);
  const dept = departments.find((d) => d.code === code);
  if (!dept) return null;

  const [missions, files, assessments, portfolio] = await Promise.all([
    listMissions(userId).then((all) => all.filter((m) => m.departmentCode === code)),
    db.evidenceItem.findMany({
      where: { userId, departmentId: dept.id },
      orderBy: { capturedDate: "desc" },
      take: 5,
      select: { id: true, title: true, capturedDate: true },
    }),
    db.assessment.findMany({
      where: { userId, rubric: { mission: { departmentId: dept.id } } },
      orderBy: { assessedAt: "desc" },
      take: 5,
      select: { id: true, totalPoints: true, maxPoints: true, rubric: { select: { mission: { select: { title: true } } } } },
    }),
    db.portfolioProject.findMany({ where: { userId, departmentId: dept.id }, orderBy: { createdAt: "desc" } })
  ]);
  const [evidenceCount, assessmentCount] = await Promise.all([
    db.evidenceItem.count({ where: { userId, departmentId: dept.id } }),
    db.assessment.count({ where: { userId, rubric: { mission: { departmentId: dept.id } } } }),
  ]);

  return {
    dept,
    missions: missions.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    evidence: files.map((f) => ({ id: f.id, title: f.title, date: dateToISO(f.capturedDate) })),
    evidenceCount,
    assessments: assessments.map((a) => ({
      id: a.id,
      title: a.rubric.mission.title,
      score: a.totalPoints,
      max: a.maxPoints,
    })),
    assessmentCount,
    portfolio: portfolio.map((p) => ({ id: p.id, title: p.title, status: p.status.toLowerCase() })),
  };
}
