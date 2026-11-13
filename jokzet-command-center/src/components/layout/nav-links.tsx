"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BellRing, CalendarDays, ClipboardCheck, Gauge, Images, Layers, LayoutGrid, ListChecks, Settings } from "lucide-react";

// Navigation structure and order are unchanged from the Base44 export (src/components/Layout.jsx).
const NAV = [
  { to: "/", label: "Command", icon: Gauge, end: true },
  { to: "/missions", label: "Missions", icon: ListChecks, end: false },
  { to: "/departments", label: "Departments", icon: LayoutGrid, end: false },
  { to: "/evidence", label: "Evidence", icon: Images, end: false },
  { to: "/assessments", label: "Assessments", icon: ClipboardCheck, end: false },
  { to: "/portfolio", label: "Portfolio", icon: Layers, end: false },
  { to: "/reminders", label: "Reminders", icon: BellRing, end: false },
  // Added in Phase 8 (analytics); placement needs the user's approval, see docs/PHASE_8_ANALYTICS_PORTFOLIO.md.
  { to: "/analytics", label: "Analytics", icon: BarChart3, end: false },
  // Added at the user's request (schedule import + reminder settings); everything above is the Base44 order.
  { to: "/settings", label: "Settings", icon: Settings, end: false },
] as const;

/** Shown only to learners on the personalised programme (decided on the server). Placed after Missions; nothing else moves. */
const TIMETABLE = { to: "/timetable", label: "Timetable", icon: CalendarDays, end: false } as const;
type NavItem = { to: string; label: string; icon: (typeof NAV)[number]["icon"]; end: boolean };
const navFor = (showTimetable?: boolean): readonly NavItem[] => (showTimetable ? [NAV[0], NAV[1], TIMETABLE, ...NAV.slice(2)] : NAV);

const isActive = (pathname: string | null, to: string, end: boolean) =>
  pathname === null ? false : end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

function DesktopLinks({ pathname, showTimetable }: { pathname: string | null; showTimetable?: boolean }) {
  return (
    <nav aria-label="Primary" className="flex-1 space-y-1 px-3">
      {navFor(showTimetable).map(({ to, label, icon: Icon, end }) => {
        const active = isActive(pathname, to, end);
        return (
          <Link
            key={to}
            href={to}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors duration-200 ${
              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.7} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileLinks({ pathname, showTimetable }: { pathname: string | null; showTimetable?: boolean }) {
  return (
    <nav aria-label="Primary" className="flex gap-1.5 overflow-x-auto px-4 pb-3">
      {navFor(showTimetable).map(({ to, label, end }) => {
        const active = isActive(pathname, to, end);
        return (
          <Link
            key={to}
            href={to}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
              active ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function DesktopWithPath({ showTimetable }: { showTimetable?: boolean }) {
  return <DesktopLinks pathname={usePathname()} showTimetable={showTimetable} />;
}
function MobileWithPath({ showTimetable }: { showTimetable?: boolean }) {
  return <MobileLinks pathname={usePathname()} showTimetable={showTimetable} />;
}

/** usePathname() is runtime data; the Suspense fallback renders the same links without an active state. */
export function DesktopNav({ showTimetable }: { showTimetable?: boolean } = {}) {
  return (
    <Suspense fallback={<DesktopLinks pathname={null} showTimetable={showTimetable} />}>
      <DesktopWithPath showTimetable={showTimetable} />
    </Suspense>
  );
}
export function MobileNav({ showTimetable }: { showTimetable?: boolean } = {}) {
  return (
    <Suspense fallback={<MobileLinks pathname={null} showTimetable={showTimetable} />}>
      <MobileWithPath showTimetable={showTimetable} />
    </Suspense>
  );
}
