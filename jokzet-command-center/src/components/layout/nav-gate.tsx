import { requireUser } from "@/lib/auth/dal";
import { timetableAccess } from "@/lib/plan/timetable-service";
import { DesktopNav, MobileNav } from "./nav-links";

/**
 * The primary navigation with the Timetable link added when the signed-in learner may use it (personalised programme and the
 * rollout flag on). Async: render inside <Suspense> with the plain navigation as the fallback, so everyone sees the usual
 * links straight away and nobody ever sees a link that leads nowhere.
 */
export async function NavGate({ variant }: { variant: "desktop" | "mobile" }) {
  const user = await requireUser();
  const show = await timetableAccess(user.id);
  const admin = user.role === "ADMIN"; // the link only points the way; /admin checks the role again on the server
  return variant === "desktop" ? <DesktopNav showTimetable={show} showAdmin={admin} /> : <MobileNav showTimetable={show} showAdmin={admin} />;
}
