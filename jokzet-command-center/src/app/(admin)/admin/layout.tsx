import { AdminShell } from "@/components/admin/admin-shell";
import { getOverviewForRequest } from "@/lib/admin/overview";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";

// Like the learner area, every page here depends on the signed-in user, so entries from outside are blocking by design.
export const instant = false;

/**
 * The Administration Centre. Only an Academy Admin gets past this layout; every page and action repeats the check (a layout
 * is not re-run on every client navigation, so it is never the only guard).
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireRole("ADMIN");
  const [profile, overview] = await Promise.all([db.profile.findUnique({ where: { userId: user.id }, select: { displayName: true } }), getOverviewForRequest(user.id)]);
  const alertCount = overview.ok ? overview.overview.alerts.filter((a) => a.level !== "info" || a.href).length : 0;
  return (
    <AdminShell user={user} displayName={profile?.displayName?.trim() || "Administrator"} alertCount={alertCount}>
      {children}
    </AdminShell>
  );
}
