import type { Metadata } from "next";
import { EvidenceVault } from "@/components/evidence/evidence-vault";
import { requireUser } from "@/lib/auth/dal";
import { listEvidence } from "@/lib/evidence/service";
import { ensureLearnerSetup, listDepartments } from "@/lib/missions/service";
import { todayISO } from "@/lib/programme";

export const metadata: Metadata = { title: "Evidence vault" };

export default async function EvidencePage() {
  const user = await requireUser();
  await ensureLearnerSetup(user.id);
  const [items, departments] = await Promise.all([listEvidence(user.id), listDepartments(user.id)]);
  return <EvidenceVault items={items} departments={departments.map((d) => ({ code: d.code, name: d.name }))} today={todayISO()} />;
}
