import type { Metadata } from "next";
import { ContactsView } from "@/components/businessos/contacts-view";
import { requireUser } from "@/lib/auth/dal";
import { listCustomers } from "@/lib/businessos/service";
import { ensureLearnerSetup } from "@/lib/missions/service";

export const metadata: Metadata = { title: "Customers · BusinessOS" };

export default async function CustomersPage() {
  const user = await requireUser();
  await ensureLearnerSetup(user.id);
  return <ContactsView kind="customer" rows={await listCustomers(user.id)} />;
}
