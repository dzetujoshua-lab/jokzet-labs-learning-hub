"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, GraduationCap, LayoutDashboard, LogOut, Users } from "lucide-react";

/**
 * The Administration Centre's navigation. Only pages that exist are listed, so there are no dead links; more entries are added as
 * each module is built. "Review queue" and "Learner view" lead to the existing learner-area pages (the review queue is shared with
 * Assessment Reviewers).
 */
type Item = { to: string; label: string; icon: typeof Users; end?: boolean };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Administration", items: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/admin/staff", label: "Staff and Roles", icon: Users },
    { to: "/admin/curriculum", label: "Curriculum", icon: GraduationCap },
    { to: "/review", label: "Review Queue", icon: ClipboardCheck },
  ] },
  { title: "Quick links", items: [{ to: "/", label: "Learner view", icon: LogOut }] },
];
const isActive = (path: string | null, to: string, end?: boolean) => (path === null ? false : end ? path === to : path === to || path.startsWith(`${to}/`));

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="space-y-5">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{g.title}</p>
          <div className="space-y-1">
            {g.items.map(({ to, label, icon: Icon, end }) => {
              const active = isActive(pathname, to, end);
              return (
                <Link
                  key={to} href={to} onClick={onNavigate} aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors duration-200 ${active ? "admin-nav-active font-medium" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
