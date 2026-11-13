import { BrandLogo } from "@/components/brand-logo";
import { DesktopNav, MobileNav } from "./nav-links";

/** Layout copied from the Base44 export (src/components/Layout.jsx): 248px sidebar, sticky mobile header, 1180px main. */
export function AppShell({
  children,
  sidebarProgress,
  mobileLevel,
  signOut,
  desktopNav = <DesktopNav />,
  mobileNav = <MobileNav />,
}: {
  children: React.ReactNode;
  sidebarProgress: React.ReactNode;
  mobileLevel: React.ReactNode;
  signOut: React.ReactNode;
  /** The primary navigation. The layout passes a version that knows whether to show the Timetable link. */
  desktopNav?: React.ReactNode;
  mobileNav?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-sidebar/80 backdrop-blur lg:flex">
        <div className="px-5 pb-6 pt-7">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-10 w-10" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">Jokzet Labs</p>
              <p className="mt-2 font-display text-[15px] font-medium leading-tight text-foreground">
                Learning
                <br />
                Command Center
              </p>
            </div>
          </div>
        </div>

        {desktopNav}

        <div className="border-t border-border px-5 py-5">
          {sidebarProgress}
          <div className="mt-4">{signOut}</div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-8 w-8" />
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.26em] text-primary">Jokzet Labs</p>
                <p className="font-display text-sm font-medium text-foreground">Learning Command Center</p>
              </div>
            </div>
            {mobileLevel}
          </div>
          {mobileNav}
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
