import type { Metadata } from "next";
import { SalesView } from "@/components/businessos/sales-view";
import { requireUser } from "@/lib/auth/dal";
import { listCustomers, listProducts, listSales } from "@/lib/businessos/service";
import { ensureLearnerSetup } from "@/lib/missions/service";
import { todayISO } from "@/lib/programme";

export const metadata: Metadata = { title: "Sales · BusinessOS" };

export default async function SalesPage() {
  const user = await requireUser();
  await ensureLearnerSetup(user.id);
  const [sales, products, customers] = await Promise.all([listSales(user.id), listProducts(user.id), listCustomers(user.id)]);
  return <SalesView sales={sales} products={products} customers={customers.map((c) => ({ id: c.id, name: c.name }))} today={todayISO()} />;
}
