import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";

/** Renders nothing; sends visitors with a valid session to the dashboard. Must sit inside <Suspense>. */
export async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/");
  return null;
}
