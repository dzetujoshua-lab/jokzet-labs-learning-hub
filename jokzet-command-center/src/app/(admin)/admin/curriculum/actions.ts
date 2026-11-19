"use server";

import { revalidatePath } from "next/cache";
import { verifyResourceLinks, type LinkCheck } from "@/lib/admin/quality";
import { requireRole } from "@/lib/auth/dal";

/** Administrators only. Opens each approved resource's link once and records the date for those that answer. */
export async function verifyLinksAction(): Promise<{ ok: true; result: LinkCheck } | { ok: false; error: string }> {
  const admin = await requireRole("ADMIN");
  const r = await verifyResourceLinks(admin.id);
  revalidatePath("/admin/curriculum");
  return r.ok ? { ok: true, result: r.result } : { ok: false, error: r.error };
}
