import { AppFrame } from "@/components/layout/app-frame";

// Every page here depends on the signed-in user (a per-request session lookup), so navigations INTO the app from
// outside (e.g. after sign-in) are blocking by design. This opts that entry out of Next's instant-navigation
// validation only; streaming and the Suspense fallbacks are unchanged, and navigations between pages inside
// the app are still validated. See node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md (Opting out).
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppFrame enforceOnboarding>{children}</AppFrame>;
}
