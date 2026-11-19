import type { Metadata } from "next";
import Link from "next/link";
import { Activity, AlertTriangle, BookOpenCheck, ClipboardCheck, GraduationCap, Info, Layers, LogIn, ShieldCheck, UserPlus, Users, XCircle } from "lucide-react";
import { ActivityArea, BarsByProgramme, Donut } from "@/components/admin/admin-charts";
import { AdminHeroArt } from "@/components/admin/hero-art";
import { getOverviewForRequest, type ActivityEvent, type Kpi } from "@/lib/admin/overview";
import { ROLE_LABEL } from "@/lib/admin/staff";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Administration Centre" };

const KPI_STYLE: Record<string, { cls: string; icon: typeof Users }> = {
  learners: { cls: "kpi-blue", icon: Users },
  active: { cls: "kpi-teal", icon: Activity },
  pending: { cls: "kpi-violet", icon: ClipboardCheck },
  enrolments: { cls: "kpi-amber", icon: Layers },
  content: { cls: "kpi-cyan", icon: BookOpenCheck },
};
const EVENT_ICON: Record<ActivityEvent["kind"], { icon: typeof Users; tone: string }> = {
  REGISTRATION: { icon: UserPlus, tone: "kpi-blue" }, ENROLMENT: { icon: GraduationCap, tone: "kpi-teal" }, SUBMISSION: { icon: LogIn, tone: "kpi-amber" },
  REVIEW: { icon: ClipboardCheck, tone: "kpi-violet" }, RESOURCE: { icon: BookOpenCheck, tone: "kpi-cyan" }, ROLE: { icon: ShieldCheck, tone: "kpi-violet" },
};
const ALERT_ICON = { info: Info, warn: AlertTriangle, bad: XCircle } as const;
const ALERT_TONE = { info: "text-[hsl(var(--admin-cyan))]", warn: "text-[hsl(var(--admin-amber))]", bad: "text-destructive" } as const;

const when = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" });
const dayOf = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Accra" });

function KpiCard({ kpi }: { kpi: Kpi }) {
  const { cls, icon: Icon } = KPI_STYLE[kpi.key] ?? KPI_STYLE.learners;
  return (
    <div className={`kpi ${cls} glass-hover p-4`}>
      <div className="flex items-center gap-3">
        <span className="kpi-icon grid h-11 w-11 place-items-center rounded-full" aria-hidden="true"><Icon className="h-5 w-5" strokeWidth={1.8} /></span>
        <p className="text-[13px] leading-tight text-foreground/90">{kpi.label}</p>
      </div>
      <p className="mt-3 font-display text-[32px] font-semibold leading-none tabular-nums text-foreground">{kpi.value.toLocaleString("en-GB")}</p>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{kpi.note}</p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const user = await requireRole("ADMIN");
  const [res, profile] = await Promise.all([getOverviewForRequest(user.id), db.profile.findUnique({ where: { userId: user.id }, select: { displayName: true } })]);
  if (!res.ok) return null;
  const o = res.overview;
  const name = profile?.displayName?.trim() || "Administrator";
  const first = name.split(/\s+/)[0];
  const today = o.generatedAt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Accra" });

  return (
    <div className="space-y-5">
      {/* Latest: real, current conditions only */}
      <section aria-label="Latest" className="glass flex items-center gap-3 overflow-hidden px-3 py-2">
        <span className="shrink-0 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-primary-foreground">Latest</span>
        {o.alerts.length ? (
          <ul className="ticker flex min-w-0 flex-1 gap-5 overflow-x-auto whitespace-nowrap text-[12px]">
            {o.alerts.map((a) => {
              const Icon = ALERT_ICON[a.level];
              const body = <><Icon className={`mr-1.5 inline h-3.5 w-3.5 ${ALERT_TONE[a.level]}`} aria-hidden="true" />{a.text}</>;
              return <li key={a.id} className="shrink-0">{a.href ? <Link href={a.href} className="inline-flex min-h-8 items-center text-foreground/90 hover:text-foreground hover:underline">{body}</Link> : <span className="text-foreground/90">{body}</span>}</li>;
            })}
          </ul>
        ) : <p className="text-[12px] text-muted-foreground">Nothing needs attention right now.</p>}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <section aria-labelledby="hero-h" className="glass hero-glow relative overflow-hidden p-6 sm:p-8">
            <div className="relative z-10 max-w-[28rem]">
              <h1 id="hero-h" className="font-display text-[34px] font-semibold leading-none tracking-tight text-foreground sm:text-[44px]">JOKZET Labs Academy</h1>
              <p className="mt-3 font-display text-lg text-[hsl(var(--admin-cyan))] sm:text-xl">Administration Centre</p>
              <p className="mt-3 text-sm leading-relaxed text-foreground/80">Manage learning, empower learners, and maintain the quality of the Academy.</p>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Quality · Care · Accountability</p>
            </div>
            <AdminHeroArt className="pointer-events-none absolute bottom-0 right-2 hidden h-[88%] w-auto md:block" />
          </section>

          <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
            {o.kpis.map((k) => <KpiCard key={k.key} kpi={k} />)}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section aria-labelledby="learners-h" className="glass p-5">
              <h2 id="learners-h" className="font-display text-sm text-foreground">Learner overview</h2>
              <div className="mt-4"><Donut label="Learners" totalLabel="learners" slices={[{ name: "Active", value: o.learnerSplit.active }, { name: "Inactive", value: o.learnerSplit.inactive }]} /></div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-xs">
                <div><dt className="text-muted-foreground">New in 7 days</dt><dd className="font-display text-lg tabular-nums text-foreground">{o.learnerSplit.newThisWeek}</dd></div>
                <div><dt className="text-muted-foreground">Activities in 7 days</dt><dd className="font-display text-lg tabular-nums text-foreground">{o.learnerSplit.activitiesThisWeek}</dd></div>
              </dl>
            </section>
            <section aria-labelledby="prog-h" className="glass p-5">
              <h2 id="prog-h" className="font-display text-sm text-foreground">Learners by programme</h2>
              <div className="mt-3"><BarsByProgramme rows={o.programmes.map((p) => ({ name: p.name, learners: p.learners }))} /></div>
            </section>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section aria-labelledby="assess-h" className="glass p-5">
              <h2 id="assess-h" className="font-display text-sm text-foreground">Assessment insights</h2>
              <div className="mt-4"><Donut label="Assessment results" totalLabel="results" slices={[{ name: "Passed", value: o.assessments.passed }, { name: "Needs improvement", value: o.assessments.needsImprovement }, { name: "Failed", value: o.assessments.failed }]} /></div>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border/60 pt-3 text-xs">
                <div><dt className="text-muted-foreground">Submitted</dt><dd className="font-display text-lg tabular-nums text-foreground">{o.assessments.submitted}</dd></div>
                <div><dt className="text-muted-foreground">Pending review</dt><dd className="font-display text-lg tabular-nums text-foreground">{o.assessments.pendingReview}</dd></div>
                <div><dt className="text-muted-foreground">Stopped AI jobs</dt><dd className="font-display text-lg tabular-nums text-foreground">{o.assessments.failedJobs}</dd></div>
              </dl>
            </section>
            <section aria-labelledby="progress-h" className="glass p-5">
              <h2 id="progress-h" className="font-display text-sm text-foreground">Learning activity, last 8 weeks</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">Recorded learner activity (missions started, evidence, submissions, results). It counts activity, not mastery.</p>
              <div className="mt-3"><ActivityArea rows={o.weekly} /></div>
            </section>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section aria-labelledby="events-h" className="glass p-5">
              <h2 id="events-h" className="font-display text-sm text-foreground">Upcoming</h2>
              {o.upcoming.length ? (
                <ul className="mt-3 space-y-2.5">
                  {o.upcoming.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 rounded-xl border border-border/60 px-3 py-2.5">
                      <span className="mt-0.5 w-11 shrink-0 text-center font-display text-xs leading-tight text-[hsl(var(--admin-cyan))]">{dayOf(e.when)}</span>
                      <div className="min-w-0">
                        <p className="text-[13px] text-foreground">{e.href ? <Link href={e.href} className="hover:underline">{e.title}</Link> : e.title}</p>
                        <p className="text-[11px] text-muted-foreground">{e.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-sm text-muted-foreground">Nothing is scheduled. Reviews waiting and AI retries appear here.</p>}
            </section>
            <section aria-labelledby="quick-h" className="glass p-5">
              <h2 id="quick-h" className="font-display text-sm text-foreground">Quick actions</h2>
              <ul className="mt-3 grid grid-cols-2 gap-2.5">
                {[
                  { href: "/admin/staff", label: "Manage staff", icon: Users, tone: "kpi-blue" },
                  { href: "/admin/staff?role=AUTHOR#assign-h", label: "Assign Curriculum Manager", icon: GraduationCap, tone: "kpi-violet" },
                  { href: "/review", label: "Review assessments", icon: ClipboardCheck, tone: "kpi-amber" },
                  { href: "/admin/curriculum", label: "Curriculum and resources", icon: BookOpenCheck, tone: "kpi-teal" },
                ].map((q) => (
                  <li key={q.href}>
                    <Link href={q.href} className={`kpi ${q.tone} glass-hover flex h-full flex-col items-center gap-2 p-3 text-center`}>
                      <span className="kpi-icon grid h-10 w-10 place-items-center rounded-full" aria-hidden="true"><q.icon className="h-4 w-4" strokeWidth={1.8} /></span>
                      <span className="text-[12px] leading-tight text-foreground">{q.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <aside className="min-w-0 space-y-5" aria-label="Administrator and recent activity">
          <section className="glass p-5" aria-labelledby="me-h">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{today}</p>
            <p className="mt-3 text-xs text-muted-foreground">Welcome back,</p>
            <h2 id="me-h" className="font-display text-xl font-semibold text-foreground">{first}</h2>
            <p className="mt-1 text-xs text-[hsl(var(--admin-cyan))]">{ROLE_LABEL[user.role]} · JOKZET Academy</p>
          </section>
          <section className="glass p-5" aria-labelledby="act-h">
            <h2 id="act-h" className="font-display text-sm text-foreground">Recent activity</h2>
            {o.activity.length ? (
              <ul className="mt-3 space-y-3">
                {o.activity.map((a) => {
                  const { icon: Icon, tone } = EVENT_ICON[a.kind];
                  return (
                    <li key={a.id} className="flex items-start gap-3">
                      <span className={`${tone} kpi-icon grid h-8 w-8 shrink-0 place-items-center rounded-full`} aria-hidden="true"><Icon className="h-3.5 w-3.5" strokeWidth={1.8} /></span>
                      <div className="min-w-0 flex-1"><p className="text-[12.5px] leading-snug text-foreground">{a.text}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{when(a.at)}</p></div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mt-3 text-sm text-muted-foreground">No activity yet.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
