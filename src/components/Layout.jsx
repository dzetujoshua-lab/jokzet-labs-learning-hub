import { NavLink, Outlet } from 'react-router-dom';
import { Gauge, ListChecks, LayoutGrid, Images, ClipboardCheck, Layers, BellRing } from 'lucide-react';
import { useDepartments } from '@/hooks/useProgramme';
import { PROGRAMME_XP_PER_LEVEL } from '@/lib/programme';

const NAV = [
  { to: '/', label: 'Command', icon: Gauge, end: true },
  { to: '/missions', label: 'Missions', icon: ListChecks },
  { to: '/departments', label: 'Departments', icon: LayoutGrid },
  { to: '/evidence', label: 'Evidence', icon: Images },
  { to: '/assessments', label: 'Assessments', icon: ClipboardCheck },
  { to: '/portfolio', label: 'Portfolio', icon: Layers },
  { to: '/reminders', label: 'Reminders', icon: BellRing },
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors duration-200 ${
    isActive
      ? 'bg-secondary text-foreground'
      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
  }`;

export default function Layout() {
  const { data: departments = [] } = useDepartments();
  const totalXp = departments.reduce((sum, d) => sum + (d.xp || 0), 0);
  const level = Math.floor(totalXp / PROGRAMME_XP_PER_LEVEL);
  const xpIntoLevel = totalXp % PROGRAMME_XP_PER_LEVEL;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-sidebar/80 backdrop-blur lg:flex">
        <div className="px-5 pb-6 pt-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">Jokzet Labs</p>
          <p className="mt-2 font-display text-[15px] font-medium leading-tight text-foreground">
            Learning<br />Command Center
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon className="h-4 w-4" strokeWidth={1.7} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border px-5 py-5">
          <div className="flex items-center justify-between">
            <p className="mono-label">Level</p>
            <p className="font-display text-sm tabular-nums text-foreground">{level}</p>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round((xpIntoLevel / PROGRAMME_XP_PER_LEVEL) * 100)}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] tabular-nums text-muted-foreground">
            {xpIntoLevel} / {PROGRAMME_XP_PER_LEVEL} XP
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.26em] text-primary">Jokzet Labs</p>
              <p className="font-display text-sm font-medium text-foreground">Learning Command Center</p>
            </div>
            <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
              LV {level}
            </span>
          </div>
          <nav className="flex gap-1.5 overflow-x-auto px-4 pb-3">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                    isActive
                      ? 'border-primary/60 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}