import type { Metadata } from "next";
import { ExpensesView } from "@/components/businessos/expenses-view";
import { requireUser } from "@/lib/auth/dal";
import { listExpenses, listSuppliers } from "@/lib/businessos/service";
import { ensureLearnerSetup } from "@/lib/missions/service";
import { todayISO } from "@/lib/programme";

export const metadata: Metadata = { title: "Expenses · BusinessOS" };

export default async function ExpensesPage() {
  const user = await requireUser();
  await ensureLearnerSetup(user.id);
  const [expenses, suppliers] = await Promise.all([listExpenses(user.id), listSuppliers(user.id)]);
  return <ExpensesView expenses={expenses} suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} today={todayISO()} />;
}
