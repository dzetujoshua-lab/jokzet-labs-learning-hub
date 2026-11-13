import type { Metadata } from "next";
import { InventoryView } from "@/components/businessos/inventory-view";
import { requireUser } from "@/lib/auth/dal";
import { listProducts, listSuppliers } from "@/lib/businessos/service";
import { ensureLearnerSetup } from "@/lib/missions/service";
import { todayISO } from "@/lib/programme";

export const metadata: Metadata = { title: "Inventory · BusinessOS" };

export default async function InventoryPage() {
  const user = await requireUser();
  await ensureLearnerSetup(user.id);
  const [products, suppliers] = await Promise.all([listProducts(user.id), listSuppliers(user.id)]);
  return <InventoryView products={products} suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} today={todayISO()} />;
}
