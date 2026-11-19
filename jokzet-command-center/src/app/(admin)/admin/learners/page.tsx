import type { Metadata } from "next";
import Link from "next/link";
import { listLearners, PAGE_SIZE } from "@/lib/admin/learners";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Administration Centre · Learners" };

const ONBOARDING: Record<string, string> = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", PLAN_GENERATING: "Building plan", PLAN_REVIEW: "Reviewing plan", COMPLETE: "Complete" };
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Accra" });
const FIELD = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

export default async function LearnersPage({ searchParams }: PageProps<"/admin/learners">) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const res = await listLearners(admin.id, { q: pick(sp.q), filter: pick(sp.filter), course: pick(sp.course), page: pick(sp.page) });
  if (!res.ok) return null;
  const d = res.data;
  const link = (page: number) => {
    const p = new URLSearchParams();
    if (d.query.q) p.set("q", d.query.q);
    if (d.query.filter && d.query.filter !== "all") p.set("filter", d.query.filter);
    if (d.query.course) p.set("course", d.query.course);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `/admin/learners${qs ? `?${qs}` : ""}`;
  };
  return (
    <div className="space-y-5">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--admin-cyan))]">Administration Centre</p>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-tight text-foreground">Learners</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Who has an account and where they are. This list holds no evidence, scores or feedback: those stay with the reviewers they belong to. Active means something was recorded in the last 14 days.</p>
      </header>

      <form method="get" className="glass flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="l-q" className="mb-1 block text-[11px] text-muted-foreground">Name or email</label>
          <input id="l-q" name="q" type="search" maxLength={80} defaultValue={d.query.q} autoComplete="off" className={`${FIELD} w-full`} />
        </div>
        <div>
          <label htmlFor="l-filter" className="mb-1 block text-[11px] text-muted-foreground">Show</label>
          <select id="l-filter" name="filter" defaultValue={d.query.filter} className={FIELD}>
            <option value="all">Everyone</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="onboarding">Not finished onboarding</option>
          </select>
        </div>
        <div>
          <label htmlFor="l-course" className="mb-1 block text-[11px] text-muted-foreground">Course</label>
          <select id="l-course" name="course" defaultValue={d.query.course} className={FIELD}>
            <option value="">All courses</option>{d.departments.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
          </select>
        </div>
        <button type="submit" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Apply</button>
      </form>

      <section className="glass overflow-hidden" aria-labelledby="list-h">
        <div className="border-b border-border/60 px-5 py-4"><h2 id="list-h" className="font-display text-sm text-foreground">{d.total} learner{d.total === 1 ? "" : "s"}</h2></div>
        {d.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead><tr className="text-muted-foreground"><th className="px-5 py-2 font-normal">Learner</th><th className="px-3 py-2 font-normal">Joined</th><th className="px-3 py-2 font-normal">Onboarding</th><th className="px-3 py-2 font-normal">Courses</th><th className="px-3 py-2 font-normal">Last activity</th><th className="px-3 py-2 font-normal">Passed</th><th className="px-5 py-2 font-normal">Submitted</th></tr></thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.email} className="border-t border-border/60 align-top">
                    <td className="px-5 py-2.5"><p className="text-sm text-foreground">{r.displayName}</p><p className="text-muted-foreground">{r.email}</p></td>
                    <td className="px-3 py-2.5 text-muted-foreground">{day(r.joined)}</td>
                    <td className="px-3 py-2.5 text-foreground">{ONBOARDING[r.onboarding] ?? r.onboarding}</td>
                    <td className="px-3 py-2.5 text-foreground">{r.courses.length ? r.courses.join(", ") : <span className="text-muted-foreground">none</span>}</td>
                    <td className="px-3 py-2.5">{r.lastActivity ? <span className={r.active ? "text-[hsl(var(--admin-teal))]" : "text-muted-foreground"}>{day(r.lastActivity)}</span> : <span className="text-muted-foreground">none yet</span>}</td>
                    <td className="px-3 py-2.5 tabular-nums text-foreground">{r.passed}</td>
                    <td className="px-5 py-2.5 tabular-nums text-foreground">{r.submitted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="px-5 py-4 text-sm text-muted-foreground">No learners match.</p>}
        {d.pages > 1 ? (
          <nav aria-label="Pages" className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-xs">
            <span className="text-muted-foreground">Page {d.page} of {d.pages} · {PAGE_SIZE} per page</span>
            <span className="flex gap-3">
              {d.page > 1 ? <Link className="text-[hsl(var(--admin-cyan))] hover:underline" href={link(d.page - 1)}>Previous</Link> : null}
              {d.page < d.pages ? <Link className="text-[hsl(var(--admin-cyan))] hover:underline" href={link(d.page + 1)}>Next</Link> : null}
            </span>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
