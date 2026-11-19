import Link from "next/link";
import { ArrowRight, Check, Trophy } from "lucide-react";
import { DeptGlyph } from "@/components/dashboard/dept-glyph";
import { HeroIllustration } from "@/components/home/hero-illustration";
import type { HomeGoalDay, LearnerHome } from "@/lib/plan/home";
import type { PlanItemView } from "@/lib/plan/service";
import { metaFor } from "@/lib/programme";

const KIND: Record<string, string> = {
  TEACHING: "Lesson", PRACTICE: "Practice", REVIEW: "Review", CHECKPOINT: "Checkpoint", BASELINE: "Baseline", CATCH_UP: "Catch-up",
};
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const hours = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`);
const pct = (n: number, d: number) => (d > 0 ? Math.min(100, Math.round((n / d) * 100)) : 0);

/** "Good morning" and so on, from the learner's own time zone (their plan's), not the server's. */
function greeting(timezone: string, now: Date = new Date()): string {
  let hour = 12;
  try { hour = Number.parseInt(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(now), 10); } catch { /* keep midday */ }
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="bar-fill h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
    </div>
  );
}

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
    <Link href={`/missions/${item.missionCode}`} className="dash-card block rounded-xl border border-border px-4 py-3 hover:border-primary/50">{body}</Link>
  ) : (
    <div className="rounded-xl border border-border px-4 py-3">{body}</div>
  );
}

const DAY_STATE: Record<HomeGoalDay["state"], string> = {
  DONE: "Finished", MISSED: "Missed", PENDING: "Not finished yet", UPCOMING: "Planned", REST: "Rest day",
};

/** Today's study time as a ring, and how each day of this week went. Planned and finished minutes are kept apart. */
function DailyGoal({ home }: { home: LearnerHome }) {
  const { plannedMinutes, doneMinutes, days } = home.goal;
  const value = pct(doneMinutes, plannedMinutes);
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <section aria-labelledby="goal-h" className="panel p-5">
      <h2 id="goal-h" className="mono-label">Your daily goal</h2>
      {plannedMinutes > 0 ? (
        <div className="mt-4 flex items-center gap-4">
          <div className="relative h-[112px] w-[112px] shrink-0" role="img" aria-label={`${doneMinutes} of ${plannedMinutes} planned minutes done today`}>
            <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="56" cy="56" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="9" />
              <circle cx="56" cy="56" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="9" strokeLinecap="round" className="ring-arc" strokeDasharray={`${(value / 100) * c} ${c}`} />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="font-display text-lg tabular-nums text-foreground">{doneMinutes} / {plannedMinutes}</p>
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">min today</p>
              </div>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {doneMinutes >= plannedMinutes ? "Today's plan is done. Well done." : `${plannedMinutes - doneMinutes} minutes of planned study left today. Only finished sessions count.`}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{home.nextSession ? "Rest day: nothing is planned today." : "Nothing is left in your plan."}</p>
      )}
      <ul className="mt-5 flex justify-between gap-1" aria-label="This week">
        {days.map((d) => (
          <li key={d.date} className="flex flex-1 flex-col items-center gap-1.5" title={`${d.label}: ${DAY_STATE[d.state]}`}>
            <span
              className={`grid h-6 w-6 place-items-center rounded-full border text-primary-foreground ${
                d.state === "DONE" ? "border-primary bg-primary" : d.isToday ? "border-primary/70" : d.state === "MISSED" ? "border-destructive/60" : "border-border"
              }`}
            >
              {d.state === "DONE" ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" /> : null}
            </span>
            <span className={`font-mono text-[9px] uppercase tracking-[0.1em] ${d.isToday ? "text-primary" : "text-muted-foreground"}`}>{d.label}</span>
            <span className="sr-only">{DAY_STATE[d.state]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Official XP and progress to the next level, skills a reviewer confirmed, and any achievements actually earned. */
function Rewards({ home }: { home: LearnerHome }) {
  const p = home.progress;
  return (
    <section aria-labelledby="rewards-h" className="panel p-5">
      <h2 id="rewards-h" className="mono-label">Achievements and rewards</h2>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-secondary text-primary"><Trophy className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">Level {p.level} · {p.xp} XP</p>
          <p className="text-xs text-muted-foreground">{p.perLevel - p.xpIntoLevel} XP to level {p.level + 1}</p>
        </div>
      </div>
      <div className="mt-3"><Progress value={pct(p.xpIntoLevel, p.perLevel)} label="Progress to the next level" /></div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {home.focus.confirmedSkills
          ? `${home.focus.confirmedSkills} skill${home.focus.confirmedSkills === 1 ? "" : "s"} confirmed by a reviewer.`
          : "XP and skills are added when a reviewer confirms your work. Self-assessed and AI results are feedback."}
      </p>
      {home.earnedAchievements.length ? (
        <ul className="mt-4 space-y-2">
          {home.earnedAchievements.map((a) => (
            <li key={a.name} className="rounded-xl border border-border px-3 py-2"><p className="text-sm text-foreground">{a.name}</p><p className="text-xs text-muted-foreground">{a.description}</p></li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">No achievements earned yet. They will appear here when you earn them.</p>
      )}
    </section>
  );
}

/**
 * The personalised learner's home, arranged as a welcome banner, what to continue, skills and courses to explore, with a column
 * for the daily goal and rewards. Everything shown comes from the learner's own plan, enrolments and results.
 */
export function LearnerHomeView({ home }: { home: LearnerHome }) {
  const first = home.displayName.trim().split(/\s+/)[0];
  const cont = home.continue;
  const contMeta = cont?.courseCode ? metaFor(cont.courseCode) : null;
  const nextWhen = home.nextSession && !home.todaySessions.length ? `${shortDate(home.nextSession.date)} at ${home.nextSession.time}` : null;
  const enrolled = home.courses.length === 1 ? home.courses[0].name : `${home.courses.length} courses`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-7">
        <section aria-labelledby="hello-h" className="panel relative overflow-hidden bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8">
          <div className="relative z-10 md:max-w-[52%]">
            <p className="mono-label">{new Date(`${home.today}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</p>
            <h1 id="hello-h" className="mt-3 font-display text-[30px] font-medium leading-[1.05] tracking-tight text-foreground md:text-[38px]">
              {greeting(home.timezone)}{first ? `, ${first}` : ""}!
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {home.planPaused
                ? "Your plan is paused. Resume it from your timetable settings when you are ready."
                : home.todaySessions.length
                  ? `${home.todaySessions.length} session${home.todaySessions.length === 1 ? "" : "s"} today, ${hours(home.minutesToday)} in all. One lesson closer to finished work.`
                  : nextWhen ? `Nothing is planned today. Your next session is ${nextWhen}.` : "You have no sessions left in your plan."}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {cont ? (
                <Link href={`/missions/${cont.missionCode}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                  Continue learning <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <Link href="/courses" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                  Explore courses <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
              <span className="rounded-full border border-border bg-background/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Learning {enrolled}</span>
            </div>
          </div>
          <HeroIllustration className="pointer-events-none absolute bottom-3 right-4 hidden h-auto w-[38%] max-w-[300px] md:block" />
        </section>

        <section aria-labelledby="cont-h">
          <h2 id="cont-h" className="mono-label px-1">Continue learning</h2>
          {cont ? (
            <div className="panel dash-card mt-3 flex flex-wrap items-center gap-4 p-4 sm:p-5">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-border bg-secondary" style={{ color: contMeta?.color }} aria-hidden="true">
                {contMeta ? <DeptGlyph icon={contMeta.icon} /> : null}
              </span>
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {cont.reason === "NEEDS_REVISION" ? "Revise and resubmit" : cont.reason === "IN_PROGRESS" ? "In progress" : "Up next"}{cont.course ? ` · ${cont.course}` : ""}
                </p>
                <p className="mt-1 text-base text-foreground">{cont.title}</p>
                {cont.percent !== null ? (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1"><Progress value={cont.percent} label={`${cont.course} plan progress`} /></div>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{cont.percent}%</span>
                  </div>
                ) : null}
                {cont.percent !== null ? <p className="mt-1 text-[11px] text-muted-foreground">of this course&apos;s planned sessions done</p> : null}
              </div>
              <Link href={`/missions/${cont.missionCode}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                {cont.reason === "NEEDS_REVISION" ? "Open feedback" : cont.reason === "IN_PROGRESS" ? "Resume" : "Start"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <p className="panel mt-3 p-5 text-sm text-muted-foreground">Nothing in progress yet. Your next lesson will appear here as soon as your plan has one.</p>
          )}
        </section>

        <section aria-labelledby="skills-h">
          <h2 id="skills-h" className="mono-label px-1">Build your skills</h2>
          {home.skills.length ? (
            <ul className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {home.skills.map((s) => {
                const meta = metaFor(s.courseCode);
                return (
                  <li key={`${s.courseCode}-${s.name}`} className="w-[176px] shrink-0">
                    <Link href={`/departments/${s.courseCode}`} className="panel dash-card block h-full p-4 hover:border-primary/50">
                      <span className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-secondary" style={{ color: meta.color }} aria-hidden="true"><DeptGlyph icon={meta.icon} /></span>
                      <p className="mt-3 line-clamp-2 text-sm leading-snug text-foreground">{s.name}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{s.lessons} lesson{s.lessons === 1 ? "" : "s"}</p>
                      <p className={`mt-2 font-mono text-[10px] uppercase tracking-[0.12em] ${s.state === "CONFIRMED" ? "text-primary" : "text-muted-foreground"}`}>
                        {s.state === "CONFIRMED" ? "Confirmed" : s.state === "SELF" ? "Self-assessed" : "Not started"}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="panel mt-3 p-5 text-sm text-muted-foreground">The skills for your courses will appear here once their lessons are published.</p>
          )}
        </section>

        <section aria-labelledby="explore-h">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <h2 id="explore-h" className="mono-label">Explore learning programmes</h2>
            <Link href="/courses" className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">See all</Link>
          </div>
          {home.explore.length ? (
            <ul className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {home.explore.map((o) => {
                const meta = metaFor(o.code);
                return (
                  <li key={o.code} className="w-[200px] shrink-0">
                    <Link href="/courses" className="panel dash-card block h-full p-4 hover:border-primary/50">
                      <span className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-secondary" style={{ color: meta.color }} aria-hidden="true"><DeptGlyph icon={meta.icon} /></span>
                      <p className="mt-3 text-sm leading-snug text-foreground">{o.name}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{o.lessons} lessons · not added</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="panel mt-3 p-5 text-sm text-muted-foreground">You are taking every course that is available. New courses appear here when they are published.</p>
          )}
        </section>

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
            <p className="mt-4 text-sm text-muted-foreground">{home.nextSession ? "Rest day. Your plan has nothing for today." : "There is nothing left to do in this plan."}</p>
          )}
          {home.catchUps > 0 ? <p className="mt-4 text-xs text-muted-foreground">{home.catchUps} catch-up session{home.catchUps === 1 ? "" : "s"} added for work you missed.</p> : null}
        </section>

        <section aria-labelledby="courses-h">
          <h2 id="courses-h" className="mono-label px-1">{home.courses.length === 1 ? "Your course" : "Your courses"}</h2>
          <div className="mt-3 grid gap-3.5 md:grid-cols-2">
            {home.courses.map((c) => (
              <Link key={c.code} href={`/departments/${c.code}`} className="panel dash-card block p-5 hover:border-primary/50">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm text-foreground">{c.name}</h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{c.status === "ACTIVE" ? `Level ${c.level}` : c.status.toLowerCase()}</span>
                </div>
                <div className="mt-4"><Progress value={c.percent} label={`${c.name} progress`} /></div>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{c.done} done · {c.remaining} to go{c.missed ? ` · ${c.missed} missed` : ""} · {c.percent}%</p>
                <p className="mt-3 text-xs text-muted-foreground">{c.next ? `Next: ${c.next.title} (${shortDate(c.next.date)}, ${c.next.time})` : "No sessions left for this course."}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <aside className="min-w-0 space-y-4" aria-label="Your goals and rewards">
        <DailyGoal home={home} />

        <section aria-labelledby="assess-h" className="panel p-5">
          <h2 id="assess-h" className="mono-label">Assessments</h2>
          {home.assessments.length ? (
            <ul className="mt-3 space-y-2">
              {home.assessments.map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className="dash-card block rounded-xl border border-border px-3.5 py-2.5 hover:border-primary/50">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{a.kind === "AWAITING" ? "Waiting" : a.kind === "REVISE" ? "Revise" : a.kind === "CHECKPOINT" ? "Next checkpoint" : "Result"}</p>
                    <p className="mt-1 text-sm text-foreground">{a.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No assessments yet. When you finish a mission, submit your evidence to be scored against its rubric.</p>
          )}
        </section>

        <Rewards home={home} />

        {home.upcoming.length ? (
          <section aria-labelledby="next-h" className="panel p-5">
            <h2 id="next-h" className="mono-label">Coming up</h2>
            <div className="mt-4 space-y-2.5">
              {home.upcoming.slice(0, 4).map((s) => <Session key={s.id} item={s} showDate course={s.departmentCode ? home.courseNames[s.departmentCode] : undefined} />)}
            </div>
          </section>
        ) : null}

        {home.focus.working.length ? (
          <section aria-labelledby="focus-h" className="panel p-5">
            <h2 id="focus-h" className="mono-label">Work on</h2>
            <p className="mt-3 text-sm text-foreground">From your latest assessments: <span className="text-muted-foreground">{home.focus.working.join(", ")}</span>.</p>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
