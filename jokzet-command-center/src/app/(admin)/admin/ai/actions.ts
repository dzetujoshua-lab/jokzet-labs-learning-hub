"use server";

import { revalidatePath } from "next/cache";
import { checkProvider, type ProviderCheck } from "@/lib/admin/ai-centre";
import { requireRole } from "@/lib/auth/dal";

/** Administrators only. One real, tiny call to the provider; the result is shown once and never stored. */
export async function checkProviderAction(): Promise<{ ok: true; check: ProviderCheck } | { ok: false; error: string }> {
  const admin = await requireRole("ADMIN");
  const r = await checkProvider(admin.id);
  revalidatePath("/admin/ai");
  return r.ok ? { ok: true, check: r.check } : { ok: false, error: r.error };
}
