"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { setReviewerScope, setStaffRole } from "@/lib/admin/staff";

type Done = { ok: boolean; error?: string; message?: string };

/** Every action re-checks the session and the ADMIN role (and the service checks it again against the database). */
export async function setRoleAction(input: { email: string; role: string; confirmEmail?: string }): Promise<Done> {
  const admin = await requireRole("ADMIN");
  const r = await setStaffRole(admin.id, input);
  revalidatePath("/admin/staff");
  return r.ok ? { ok: true, message: "Role updated." } : { ok: false, error: r.error };
}

export async function setScopeAction(input: { email: string; department: string }, add: boolean): Promise<Done> {
  const admin = await requireRole("ADMIN");
  const r = await setReviewerScope(admin.id, input, add);
  revalidatePath("/admin/staff");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
