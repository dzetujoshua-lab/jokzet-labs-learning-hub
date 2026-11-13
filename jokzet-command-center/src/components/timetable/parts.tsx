import Link from "next/link";
import { DEPARTMENTS } from "@/lib/departments";
import { metaFor } from "@/lib/programme";
import { stateOf, stepDate, type SessionState, type TimetableView } from "@/lib/plan/timetable";
import type { PlanItemView } from "@/lib/plan/service";

export const CATCH_UP_COLOR = "#7dc7ff"; // the one extra hue in the timetable: catch-up work (the app's own colours cover the rest)

export const STATE_LABEL: Record<SessionState, string> = { done: "Done", missed: "Missed", "catch-up": "Catch-up", practised: "Practised", planned: "Planned", cancelled: "Cancelled" };
export const STATE_CHIP: Record<SessionState, string> = {
  done: "border-primary/50 bg-primary/10 text-primary",
  missed: "border-destructive/50 bg-destructive/10 text-destructive",
  "catch-up": "border-border text-muted-foreground",
  practised: "border-primary/50 bg-primary/10 text-primary",
  planned: "border-border text-muted-foreground",
  cancelled: "border-border text-muted-foreground",
};

export const deptName = (code: string | null) => (code ? (DEPARTMENTS.find((d) => d.code === code)?.name ?? code) : "Review");
export const deptColor = (code: string | null) => (code ? metaFor(code).color : "hsl(var(--muted-foreground))");
export const stateOfItem = (i: PlanItemView) => stateOf(i);
export const dotColor = (i: PlanItemView) => {
  const s = stateOfItem(i);
  return s === "missed" ? "hsl(var(--destructive))" : s === "catch-up" ? CATCH_UP_COLOR : deptColor(i.departmentCode);
};
export const HATCH = { backgroundImage: "repeating-linear-gradient(135deg, transparent 0 5px, hsl(var(--destructive) / 0.14) 5px 10px)" } as const;

const chipBase = "rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors";
export const timetableHref = (view: TimetableView, date: string) => `/timetable?view=${view}&date=${date}`;

/** Day / Week / Month switch plus previous and next. Plain links: opening a screen never changes anything. */
export function ViewSwitch({ view, date }: { view: TimetableView; date: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(["day", "week", "month"] as const).map((v) => (
        <Link key={v} href={timetableHref(v, date)} aria-current={v === view ? "page" : undefined} className={`${chipBase} ${v === view ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
          {v}
        </Link>
      ))}
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <Link href={timetableHref(view, stepDate(view, date, -1))} aria-label="Previous" className={`${chipBase} border-border text-muted-foreground hover:border-primary/40`}>Prev</Link>
      <Link href={timetableHref(view, stepDate(view, date, 1))} aria-label="Next" className={`${chipBase} border-border text-muted-foreground hover:border-primary/40`}>Next</Link>
    </div>
  );
}

export function StateChip({ item }: { item: PlanItemView }) {
  const s = stateOfItem(item);
  return <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${STATE_CHIP[s]}`}>{STATE_LABEL[s]}</span>;
}

export function Tile({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="mono-label">{label}</p>
      <div className="mt-2 font-display text-xl leading-tight tabular-nums text-foreground">{children}</div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Bar({ percent }: { percent: number }) {
  return (
    <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}
