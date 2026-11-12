import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AuthGate } from "@/components/layout/auth-gate";
import { MobileLevel, SidebarProgress, SidebarProgressFallback, SignOutButton } from "@/components/layout/sidebar-slots";
import Loading from "./loading";

// Every page here depends on the signed-in user (a per-request session lookup), so navigations INTO the app from
// outside (e.g. after sign-in) are blocking by design. This opts that entry out of Next's instant-navigation
// validation only; streaming and the Suspense fallbacks below are unchanged, and navigations between pages inside
// the app are still validated. See node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md (Opting out).
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      sidebarProgress={
        <Suspense fallback={<SidebarProgressFallback />}>
          <SidebarProgress />
        </Suspense>
      }
      mobileLevel={
        <Suspense fallback={null}>
          <MobileLevel />
        </Suspense>
      }
      signOut={<SignOutButton />}
    >
      <Suspense fallback={<Loading />}>
        <AuthGate>{children}</AuthGate>
      </Suspense>
    </AppShell>
  );
}
