import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { BrandLogo } from "@/components/brand-logo";
import type { SessionUser } from "@/lib/auth/sessions";
import { ROLE_LABEL } from "@/lib/admin/staff";
import { AdminNav } from "./admin-nav";
import { MobileDrawer } from "./mobile-drawer";
import "./admin-theme.css";

/**
 * The Administration Centre frame: a persistent sidebar on desktop, a drawer on smaller screens, a header with search, and the
 * signed-in administrator's account at the bottom. The `admin-theme` class scopes the dark glass colours to this subtree only.
 */
export function AdminShell({ user, displayName, alertCount, children }: { user: SessionUser; displayName: string; alertCount: number; children: React.ReactNode }) {
  return (
    <div className="admin-theme">
      <div className="lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-border/60 bg-[hsl(var(--sidebar-background)/0.85)] px-3 py-6 backdrop-blur lg:flex">
          <div className="flex items-center gap-3 px-2">
            <BrandLogo className="h-10 w-10" />
            <div>
              <p className="font-display text-[15px] font-medium leading-tight text-foreground">JOKZET Academy</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--admin-cyan))]">Administration Centre</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto"><AdminNav /></div>
          <div className="glass p-3">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-secondary font-display text-sm">{displayName.charAt(0).toUpperCase()}</span>
              <div className="min-w-0">
                <p className="truncate text-[13px] text-foreground">{displayName}</p>
                <p className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"><ShieldCheck className="h-3 w-3" aria-hidden="true" />{ROLE_LABEL[user.role]}</p>
              </div>
            </div>
            <form action={logout} className="mt-3"><button type="submit" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground">Sign out</button></form>
          </div>
        </aside>

        <div className="min-w-0">
          {/* No blur below the desktop breakpoint: backdrop-filter would make this header the containing block of the fixed navigation drawer. */}
          <header className="sticky top-0 z-30 border-b border-border/60 bg-[hsl(var(--background)/0.97)] lg:bg-[hsl(var(--background)/0.8)] lg:backdrop-blur">
            <div className="mx-auto flex w-full max-w-[1320px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <MobileDrawer />
              <form action="/admin/staff" method="get" role="search" className="min-w-0 flex-1 sm:max-w-md">
                <label htmlFor="admin-search" className="sr-only">Search staff by name or email</label>
                <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-card/70 px-4 focus-within:border-[hsl(var(--admin-cyan)/0.7)]">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <input id="admin-search" name="q" type="search" maxLength={80} autoComplete="off" placeholder="Search staff by name or email…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                </div>
              </form>
              <div className="ml-auto flex items-center gap-2.5">
                <Link href="/admin" className="relative hidden h-10 items-center rounded-full border border-border bg-card/70 px-3.5 font-mono text-[11px] text-foreground sm:inline-flex" aria-label={alertCount ? `${alertCount} items need attention` : "Nothing needs attention"}>
                  {alertCount ? <><span className="mr-2 h-2 w-2 rounded-full bg-[hsl(var(--admin-amber))]" aria-hidden="true" />{alertCount} to review</> : "All clear"}
                </Link>
                <span className="hidden h-10 items-center gap-2 rounded-full border border-border bg-card/70 pl-1.5 pr-3.5 sm:inline-flex">
                  <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-secondary font-display text-xs">{displayName.charAt(0).toUpperCase()}</span>
                  <span className="text-xs text-foreground">{displayName}</span>
                </span>
              </div>
            </div>
          </header>
          <main className="admin-enter mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
