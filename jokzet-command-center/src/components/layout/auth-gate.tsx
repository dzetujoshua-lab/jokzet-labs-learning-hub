import { ReminderRuntime } from "@/components/notifications/reminder-runtime";
import { requireUser } from "@/lib/auth/dal";

/** Blocks the authenticated area until the session is verified; mounts the reminder runtime only for signed-in users. */
export async function AuthGate({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      {children}
      <ReminderRuntime />
    </>
  );
}
