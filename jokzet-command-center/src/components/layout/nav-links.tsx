"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BellRing, ShieldCheck, BookOpen, CalendarDays, ClipboardCheck, Home, Images, Layers, LayoutGrid, ListChecks } from "lucide-react";

/**
 * Primary navigation, grouped like a learning app: learn, practise, progress. Every entry is a real route; nothing is listed
 * for a feature the Academy does not have. Settings sits in the account card at the bottom of the sidebar.
 */
type Icon = typeof Home;
type NavItem = { to: string; label: string; icon: Icon; end: boolean };
type Group = { title: string; items: readonly NavItem[] };

const HOME: NavItem = { to: "/", label: "Home", icon: Home, end: true };
const COURSES: NavItem = { to: "/departments", label: "My Courses", icon: LayoutGrid, end: false };
const MATERIALS: NavItem = { to: "/missions", label: "Learning Materials", icon: BookOpen, end: false };
/** Shown only to learners on the personalised programme (decided on the server). */
const TIMETABLE: NavItem = { to: "/timetable", label: "Timetable", icon: CalendarDays, end: false };
const ACTIVITIES: NavItem = { to: "/activities", label: "Daily Activities", icon: ListChecks, end: false };
const ASSESSMENTS: NavItem = { to: "/assessments", label: "Assessments", icon: ClipboardCheck, end: false };
const EVIDENCE: NavItem = { to: "/evidence", label: "Evidence", icon: Images, end: false };
const PROGRESS: NavItem = { to: "/analytics", label: "My Progress", icon: BarChart3, end: false };
const PORTFOLIO: NavItem = { to: "/portfolio", label: "Portfolio", icon: Layers, end: false };
const REMINDERS: NavItem = { to: "/reminders", label: "Reminders", icon: BellRing, end: false };
/** Shown only to Academy Admins (decided on the server). */
const ADMIN: NavItem = { to: "/admin", label: "Administration Centre", icon: ShieldCheck, end: false };

export const navGroups = (showTimetable?: boolean, showAdmin?: boolean): readonly Group[] => [
  { title: "Learn", items: [HOME, COURSES, MATERIALS, ...(showTimetable ? [TIMETABLE] : [])] },
  { title: "Practise", items: [ACTIVITIES, ASSESSMENTS, EVIDENCE] },
  { title: "Progress", items: [PROGRESS, PORTFOLIO, REMINDERS] },
  ...(showAdmin ? [{ title: "Administration", items: [ADMIN] }] : []),
];

const isActive = (pathname: string | null, to: string, end: boolean) =>
  pathname === null ? false : end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

function DesktopLinks({ pathname, showTimetable, showAdmin }: { pathname: string | null; showTimetable?: boolean; showAdmin?: boolean }) {
  return (
    <nav aria-label="Primary" className="flex-1 space-y-5 overflow-y-auto px-3">
      {navGroups(showTimetable, showAdmin).map((g) => (
        <div key={g.title}>
          <p className="mono-label px-3 pb-1.5">{g.title}</p>
          <div className="space-y-0.5">
            {g.items.map(({ to, label, icon: Icon, end }) => {
              const active = isActive(pathname, to, end);
              return (
                <Link
                  key={to}
                  href={to}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors duration-200 ${
                    active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.7} />
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

function MobileLinks({ pathname, showTimetable, showAdmin }: { pathname: string | null; showTimetable?: boolean; showAdmin?: boolean }) {
  return (
    <nav aria-label="Primary" className="flex gap-1.5 overflow-x-auto px-4 pb-3">
      {navGroups(showTimetable, showAdmin).flatMap((g) => g.items).map(({ to, label, end }) => {
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

function DesktopWithPath({ showTimetable, showAdmin }: { showTimetable?: boolean; showAdmin?: boolean }) {
  return <DesktopLinks pathname={usePathname()} showTimetable={showTimetable} showAdmin={showAdmin} />;
}
function MobileWithPath({ showTimetable, showAdmin }: { showTimetable?: boolean; showAdmin?: boolean }) {
  return <MobileLinks pathname={usePathname()} showTimetable={showTimetable} showAdmin={showAdmin} />;
}

/** usePathname() is runtime data; the Suspense fallback renders the same links without an active state. */
export function DesktopNav({ showTimetable, showAdmin }: { showTimetable?: boolean; showAdmin?: boolean } = {}) {
  return (
    <Suspense fallback={<DesktopLinks pathname={null} showTimetable={showTimetable} showAdmin={showAdmin} />}>
      <DesktopWithPath showTimetable={showTimetable} showAdmin={showAdmin} />
    </Suspense>
  );
}
export function MobileNav({ showTimetable, showAdmin }: { showTimetable?: boolean; showAdmin?: boolean } = {}) {
  return (
    <Suspense fallback={<MobileLinks pathname={null} showTimetable={showTimetable} showAdmin={showAdmin} />}>
      <MobileWithPath showTimetable={showTimetable} showAdmin={showAdmin} />
    </Suspense>
  );
}
