import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AuthGate } from "@/components/layout/auth-gate";
import { NavGate } from "@/components/layout/nav-gate";
import { DesktopNav, MobileNav } from "@/components/layout/nav-links";
import { MobileLevel, SidebarProgress, SidebarProgressFallback, SignOutButton } from "@/components/layout/sidebar-slots";
import Loading from "@/app/(app)/loading";

/**
 * The signed-in shell. `enforceOnboarding` sends a learner who has not confirmed a plan to /onboarding (the learning area).
 * The account area (Settings, Privacy) passes false: it still requires a session, but a learner can always export or delete
 * their data, even mid-onboarding.
 */
export function AppFrame({ children, enforceOnboarding }: { children: React.ReactNode; enforceOnboarding: boolean }) {
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
      desktopNav={
        <Suspense fallback={<DesktopNav />}>
          <NavGate variant="desktop" />
        </Suspense>
      }
      mobileNav={
        <Suspense fallback={<MobileNav />}>
          <NavGate variant="mobile" />
        </Suspense>
      }
    >
      <Suspense fallback={<Loading />}>
        <AuthGate enforceOnboarding={enforceOnboarding}>{children}</AuthGate>
      </Suspense>
    </AppShell>
  );
}
