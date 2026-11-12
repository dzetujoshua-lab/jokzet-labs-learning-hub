import type { Metadata } from "next";
import { ContactsView } from "@/components/businessos/contacts-view";
import { requireUser } from "@/lib/auth/dal";
import { listSuppliers } from "@/lib/businessos/service";
import { ensureLearnerSetup } from "@/lib/missions/service";

export const metadata: Metadata = { title: "Suppliers · BusinessOS" };

export default async function SuppliersPage() {
  const user = await requireUser();
  await ensureLearnerSetup(user.id);
  return <ContactsView kind="supplier" rows={await listSuppliers(user.id)} />;
}
