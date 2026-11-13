import { ReminderRuntime } from "@/components/notifications/reminder-runtime";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { personalisedLearningEnabled } from "@/lib/plan/flag";
import { onboardingRedirectFor } from "@/lib/plan/onboarding";

/** Blocks the authenticated area until the session is verified; mounts the reminder runtime only for signed-in users. */
export async function AuthGate({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Only when the rollout flag is on: a PERSONALISED learner who has not finished onboarding is sent to the wizard.
  // Done here (page-level server code) rather than in the proxy, so it is checked against the database, not a cookie.
  if (personalisedLearningEnabled()) {
    const to = await onboardingRedirectFor(user.id);
    if (to) redirect(to);
  }
  return (
    <>
      {children}
      <ReminderRuntime />
    </>
  );
}
