import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { DayView } from "@/components/timetable/day-view";
import { HistoryList } from "@/components/timetable/history-list";
import { MonthView } from "@/components/timetable/month-view";
import { PlanControls } from "@/components/timetable/plan-controls";
import { ViewSwitch } from "@/components/timetable/parts";
import { WeekView } from "@/components/timetable/week-view";
import { requireUser } from "@/lib/auth/dal";
import { getTimetable, timetableAccess } from "@/lib/plan/timetable-service";
import { weekDates } from "@/lib/plan/timetable";
import { fmtDate } from "@/lib/programme";

export const metadata: Metadata = { title: "Timetable" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Read-only: opening or switching a view changes nothing. Only the Pause / Resume / Build buttons call actions. */
export default async function TimetablePage({ searchParams }: PageProps<"/timetable">) {
  const user = await requireUser();
  if (!(await timetableAccess(user.id))) notFound(); // original-programme learners (and everyone while the flag is off) never see it
  const sp = await searchParams;
  const t = await getTimetable(user.id, { view: first(sp.view), date: first(sp.date) });

  if (!t) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Timetable" title="Your timetable" description="Your study sessions will appear here once your plan is built." />
        <EmptyState icon={CalendarDays} title="No plan yet" hint="Build your plan from the study days and goals you chose in setup." />
        <PlanControls mode="NONE" />
      </div>
    );
  }

  const title =
    t.view === "day" ? (t.date === t.today ? "Today" : fmtDate(t.date))
    : t.view === "week" ? `Week of ${fmtDate(weekDates(t.date)[0])}`
    : new Date(`${t.date.slice(0, 7)}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Timetable · ${t.plan.sessionsPerDay} session${t.plan.sessionsPerDay === 1 ? "" : "s"} a day`} title={title}>
        <ViewSwitch view={t.view} date={t.date} />
      </PageHeader>

      {t.plan.status === "PAUSED" ? (
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-foreground">Your plan is paused. Reminders are off and nothing is marked missed. Sessions still to do move forward when you resume.</p>
          <PlanControls mode="PAUSED" />
        </div>
      ) : null}

      {t.view === "day" ? <DayView t={t} /> : t.view === "week" ? <WeekView t={t} /> : <MonthView t={t} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <HistoryList history={t.history} />
        <section className="panel p-5">
          <p className="mono-label">Your plan</p>
          <p className="mt-3 text-sm text-foreground">{fmtDate(t.plan.startDate)} to {fmtDate(t.plan.endDate)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.progress.completed} of {t.progress.total} sessions done{t.progress.missed ? ` · ${t.progress.missed} missed` : ""}</p>
          <div className="mt-4">
            {t.plan.status === "ACTIVE" ? <PlanControls mode="ACTIVE" autoReschedule={t.plan.autoReschedule} /> : <p className="text-xs text-muted-foreground">Paused. Use Resume plan above when you are ready.</p>}
            {t.plan.status === "ACTIVE" ? <Link href="/timetable/settings" className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-primary">Timetable settings</Link> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
