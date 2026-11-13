import { Suspense } from "react";

// Same reasoning as the (app) layout: this page depends on the signed-in user (a per-request session lookup), so entering
// it from outside is blocking by design. The Suspense boundary keeps the rest of the shell streaming.
export const instant = false;

export default function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  return <Suspense fallback={<p className="px-4 py-16 text-center text-sm text-muted-foreground">Loading…</p>}>{children}</Suspense>;
}
