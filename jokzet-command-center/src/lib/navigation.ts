import {
  Gauge, Target, LayoutGrid, FolderArchive, ClipboardCheck, BarChart3,
  CalendarClock, Layers, Building2, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; phase: number };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Command", icon: Gauge, phase: 8 },
  { href: "/departments", label: "Departments", icon: LayoutGrid, phase: 6 },
  { href: "/missions", label: "Missions", icon: Target, phase: 6 },
  { href: "/evidence", label: "Evidence Vault", icon: FolderArchive, phase: 7 },
  { href: "/assessments", label: "Assessments", icon: ClipboardCheck, phase: 7 },
  { href: "/analytics", label: "Analytics", icon: BarChart3, phase: 8 },
  { href: "/calendar", label: "Calendar", icon: CalendarClock, phase: 8 },
  { href: "/portfolio", label: "Portfolio", icon: Layers, phase: 8 },
  { href: "/businessos", label: "BusinessOS Ghana", icon: Building2, phase: 9 },
];
