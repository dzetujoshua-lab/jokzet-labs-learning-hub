import Link from "next/link";
import type { LearnerHome } from "@/lib/plan/home";
import type { PlanItemView } from "@/lib/plan/service";

const KIND: Record<string, string> = {
  TEACHING: "Lesson", PRACTICE: "Practice", REVIEW: "Review", CHECKPOINT: "Checkpoint", BASELINE: "Baseline", CATCH_UP: "Catch-up",
};
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const hours = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`);

function Session({ item, course, showDate }: { item: PlanItemView; course?: string; showDate?: boolean }) {
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span className="text-primary">{showDate ? `${shortDate(item.date)} · ` : ""}{item.time}</span>
        <span>{hours(item.minutes)}</span>
        <span>{KIND[item.kind] ?? item.kind}</span>
        {course ? <span>{course}</span> : null}
      </div>
      <p className="mt-1.5 text-sm text-foreground">{item.title}</p>
      {item.objective ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.objective}</p> : null}
    </>
  );
  return item.missionCode ? (
    <Link href={`/missions/${item.missionCode}`} className="block rounded-xl border border-border px-4 py-3 transition-colors hover:border-primary/50">{body}</Link>
  ) : (
    <div className="rounded-xl border border-border px-4 py-3">{body}</div>
  );
}

/** The personalised learner's home: what they are learning, what to do today, what is next and how they are doing. */
export function LearnerHomeView({ home }: { home: LearnerHome }) {
  const first = home.displayName.trim().split(/\s+/)[0];
  const nextWhen = home.nextSession && !home.todaySessions.length ? `${shortDate(home.nextSession.date)} at ${home.nextSession.time}` : null;

  return (
    <div className="space-y-7">
      <header className="animate-rise">
        <p className="mono-label">{new Date(`${home.today}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} · {home.timezone}</p>
        <h1 className="mt-3 font-display text-[30px] font-medium leading-none tracking-tight text-foreground md:text-[40px]">
          {first ? `Hello, ${first}` : "Your learning"}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {home.planPaused
            ? "Your plan is paused. Resume it from your timetable settings when you are ready."
            : home.todaySessions.length
              ? `Today you have ${home.todaySessions.length} session${home.todaySessions.length === 1 ? "" : "s"}, ${hours(home.minutesToday)} in all.`
              : nextWhen
                ? `Nothing is planned today. Your next session is ${nextWhen}.`
                : "You have no sessions left in your plan."}
        </p>
      </header>

      <section aria-labelledby="today-h" className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="today-h" className="mono-label">Today</h2>
          <Link href="/timetable" className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">Full timetable</Link>
        </div>
        {home.todaySessions.length ? (
          <div className="mt-4 space-y-2.5">
            {home.todaySessions.map((s) => <Session key={s.id} item={s} course={s.departmentCode ? home.courseNames[s.departmentCode] : undefined} />)}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {home.nextSession ? "Rest day. Your plan has nothing for today." : "There is nothing left to do in this plan."}
          </p>
        )}
        {home.catchUps > 0 ? <p className="mt-4 text-xs text-muted-foreground">{home.catchUps} catch-up session{home.catchUps === 1 ? "" : "s"} added for work you missed.</p> : null}
      </section>

      <section aria-labelledby="week-h">
        <h2 id="week-h" className="mono-label px-1">The next 7 days</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {home.week.map((d) => (
            <div key={d.date} title={`${d.sessions.length} session${d.sessions.length === 1 ? "" : "s"}`} className={`min-w-[56px] flex-1 shrink-0 rounded-xl border px-2.5 py-3 ${d.isToday ? "border-primary/60 bg-primary/10" : "border-border"}`}>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{d.label}</p>
              <p className="mt-1 font-display text-lg tabular-nums text-foreground">{d.sessions.length || "–"}</p>
              <p className="hidden font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground sm:block">{d.sessions.length ? (d.sessions.length === 1 ? "session" : "sessions") : "rest"}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="courses-h">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <h2 id="courses-h" className="mono-label">{home.courses.length === 1 ? "Your course" : "Your courses"}</h2>
          <Link href="/courses" className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">Explore courses</Link>
        </div>
        <div className="mt-3 grid gap-3.5 md:grid-cols-2">
          {home.courses.map((c) => (
            <Link key={c.code} href={`/departments/${c.code}`} className="panel block p-5 transition-colors hover:border-primary/50">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm text-foreground">{c.name}</h3>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{c.status === "ACTIVE" ? `Level ${c.level}` : c.status.toLowerCase()}</span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={c.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.name} progress`}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${c.percent}%` }} />
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {c.done} done · {c.remaining} to go{c.missed ? ` · ${c.missed} missed` : ""} · {c.percent}%
              </p>
              <p className="mt-3 text-xs text-muted-foreground">{c.next ? `Next: ${c.next.title} (${shortDate(c.next.date)}, ${c.next.time})` : "No sessions left for this course."}</p>
            </Link>
          ))}
        </div>
      </section>

      {home.upcoming.length ? (
        <section aria-labelledby="next-h" className="panel p-5">
          <h2 id="next-h" className="mono-label">Coming up</h2>
          <div className="mt-4 space-y-2.5">
            {home.upcoming.map((s) => <Session key={s.id} item={s} showDate course={s.departmentCode ? home.courseNames[s.departmentCode] : undefined} />)}
          </div>
        </section>
      ) : null}

      <section aria-label="Overall progress" className="panel p-5">
        <p className="mono-label">Overall progress</p>
        <p className="mt-3 text-sm text-foreground">{home.totals.done} of {home.totals.done + home.totals.remaining + home.totals.missed} planned sessions done ({home.totals.percent}%). Your plan ends {shortDate(home.planEnds)}.</p>
        <p className="mt-2 text-xs text-muted-foreground">Passing a mission records your progress. Official XP is added when a reviewer confirms your work.</p>
      </section>
    </div>
  );
}
