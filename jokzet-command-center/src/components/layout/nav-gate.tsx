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
  return variant === "desktop" ? <DesktopNav showTimetable={show} /> : <MobileNav showTimetable={show} />;
}
