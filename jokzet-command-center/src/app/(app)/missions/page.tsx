import type { Metadata } from "next";
import { MissionBoard } from "@/components/missions/mission-board";
import { requireUser } from "@/lib/auth/dal";
import { ensureLearnerSetup, listDepartments, listMissions } from "@/lib/missions/service";
import { todayISO } from "@/lib/programme";

export const metadata: Metadata = { title: "Mission board" };

export default async function MissionsPage() {
  const user = await requireUser();
  await ensureLearnerSetup(user.id);
  const [missions, departments] = await Promise.all([listMissions(user.id), listDepartments(user.id)]);
  return <MissionBoard missions={missions} departments={departments} today={todayISO()} />;
}
