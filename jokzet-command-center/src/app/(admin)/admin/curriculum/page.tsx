import type { Metadata } from "next";
import { VerifyLinksButton } from "@/components/admin/admin-actions";
import { getQuality, STALE_DAYS } from "@/lib/admin/quality";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Administration Centre · Curriculum quality" };

const day = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Accra" }) : "never");
const FIELD = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";
const nice = (s: string) => s.toLowerCase().replace(/_/g, " ");

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`kpi ${tone} p-4`}>
      <p className="text-[12px] text-foreground/85">{label}</p>
      <p className="mt-2 font-display text-[28px] font-semibold leading-none tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export default async function CurriculumQualityPage({ searchParams }: PageProps<"/admin/curriculum">) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const res = await getQuality(admin.id, { programme: pick(sp.programme) || undefined, status: pick(sp.status) || undefined, kind: pick(sp.kind) || undefined });
  if (!res.ok) return null;
  const q = res.quality;
  return (
    <div className="space-y-5">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--admin-cyan))]">Administration Centre</p>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-tight text-foreground">Curriculum</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">What stands between the curriculum and a learner: lessons without an approved video, assessments without a rubric, resources waiting or not recently checked. Nothing reaches learners until it is approved.</p>
      </header>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Count label="Lessons without an approved main resource" value={q.gaps.length} tone="kpi-amber" />
        <Count label="Assessments without a rubric" value={q.noRubric.length} tone="kpi-violet" />
        <Count label="Resources awaiting review" value={q.awaiting.length} tone="kpi-blue" />
        <Count label={`Links not checked in ${STALE_DAYS} days`} value={q.unverified.length} tone="kpi-cyan" />
      </section>

      <form method="get" className="glass flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="c-programme" className="mb-1 block text-[11px] text-muted-foreground">Programme</label>
          <select id="c-programme" name="programme" defaultValue={q.filter.programme} className={FIELD}><option value="">All programmes</option>{q.departments.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}</select>
        </div>
        <div>
          <label htmlFor="c-status" className="mb-1 block text-[11px] text-muted-foreground">Review status</label>
          <select id="c-status" name="status" defaultValue={q.filter.status} className={FIELD}><option value="">Any</option>{["APPROVED", "PENDING_REVIEW", "DRAFT", "REJECTED", "ARCHIVED"].map((s) => <option key={s} value={s}>{nice(s)}</option>)}</select>
        </div>
        <div>
          <label htmlFor="c-kind" className="mb-1 block text-[11px] text-muted-foreground">Resource type</label>
          <select id="c-kind" name="kind" defaultValue={q.filter.kind} className={FIELD}><option value="">Any</option>{["VIDEO", "PLAYLIST", "DOCUMENTATION", "INTERACTIVE", "ORIGINAL", "DEMONSTRATION"].map((s) => <option key={s} value={s}>{nice(s)}</option>)}</select>
        </div>
        <button type="submit" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Apply</button>
        <p className="w-full text-[11px] text-muted-foreground">Resources are reviewed by named people recorded with each approval, so there is no &ldquo;assigned reviewer&rdquo; to filter by yet.</p>
      </form>

      <section className="glass overflow-hidden" aria-labelledby="prog-h">
        <div className="border-b border-border/60 px-5 py-4"><h2 id="prog-h" className="font-display text-sm text-foreground">Programmes</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead><tr className="text-muted-foreground"><th className="px-5 py-2 font-normal">Programme</th><th className="px-3 py-2 font-normal">Published lessons</th><th className="px-3 py-2 font-normal">With a main resource</th><th className="px-3 py-2 font-normal">With a rubric</th><th className="px-5 py-2 font-normal">Notes</th></tr></thead>
            <tbody>
              {q.programmes.map((p) => (
                <tr key={p.code} className="border-t border-border/60">
                  <td className="px-5 py-2.5 text-foreground">{p.name}</td>
                  <td className="px-3 py-2.5 tabular-nums text-foreground">{p.lessons}</td>
                  <td className={`px-3 py-2.5 tabular-nums ${p.withPrimary < p.lessons ? "text-[hsl(var(--admin-amber))]" : "text-[hsl(var(--admin-teal))]"}`}>{p.withPrimary} / {p.lessons}</td>
                  <td className={`px-3 py-2.5 tabular-nums ${p.withRubric < p.lessons ? "text-destructive" : "text-[hsl(var(--admin-teal))]"}`}>{p.withRubric} / {p.lessons}</td>
                  <td className="px-5 py-2.5 text-muted-foreground">{p.lessons === 0 ? "No published lessons: not offered to learners" : p.onlyLevelZero ? "Only Level 0 is published" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass overflow-hidden" aria-labelledby="gaps-h">
          <div className="border-b border-border/60 px-5 py-4"><h2 id="gaps-h" className="font-display text-sm text-foreground">Lessons missing a main resource · {q.gaps.length}</h2></div>
          {q.gaps.length ? <ul>{q.gaps.map((g) => <li key={g.code} className="border-b border-border/60 px-5 py-2.5 text-sm last:border-0"><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{g.code}</span> <span className="text-foreground">{g.title}</span>{g.hasSupplementary ? <span className="ml-2 text-[11px] text-muted-foreground">optional material only</span> : null}</li>)}</ul> : <p className="px-5 py-4 text-sm text-muted-foreground">Every published lesson has an approved main resource.</p>}
        </section>
        <section className="glass overflow-hidden" aria-labelledby="rub-h">
          <div className="border-b border-border/60 px-5 py-4"><h2 id="rub-h" className="font-display text-sm text-foreground">Assessments without a rubric · {q.noRubric.length}</h2></div>
          {q.noRubric.length ? <ul>{q.noRubric.map((m) => <li key={m.code} className="border-b border-border/60 px-5 py-2.5 text-sm last:border-0"><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{m.code}</span> <span className="text-foreground">{m.title}</span></li>)}</ul> : <p className="px-5 py-4 text-sm text-muted-foreground">Every published lesson has a rubric.</p>}
        </section>
      </div>

      <section className="glass overflow-hidden" aria-labelledby="res-h">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
          <h2 id="res-h" className="font-display text-sm text-foreground">Resources · {q.resources.length}</h2>
          <VerifyLinksButton />
        </div>
        {q.resources.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead><tr className="text-muted-foreground"><th className="px-5 py-2 font-normal">Resource</th><th className="px-3 py-2 font-normal">Type</th><th className="px-3 py-2 font-normal">Status</th><th className="px-3 py-2 font-normal">Lessons</th><th className="px-3 py-2 font-normal">Approved by</th><th className="px-5 py-2 font-normal">Link checked</th></tr></thead>
              <tbody>
                {q.resources.map((r) => (
                  <tr key={r.id} className="border-t border-border/60 align-top">
                    <td className="max-w-[22rem] px-5 py-2.5 text-foreground">{r.title}<span className="block text-[11px] text-muted-foreground">{r.provider}</span></td>
                    <td className="px-3 py-2.5 text-muted-foreground">{nice(r.kind)}</td>
                    <td className="px-3 py-2.5 text-foreground">{nice(r.status)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-foreground">{r.lessons}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.approvedBy ? `${r.approvedBy}, ${day(r.approvedAt)}` : "·"}</td>
                    <td className={`px-5 py-2.5 ${r.stale ? "text-[hsl(var(--admin-amber))]" : "text-muted-foreground"}`}>{day(r.lastVerifiedAt)}{r.stale ? " (due)" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="px-5 py-4 text-sm text-muted-foreground">No resources match.</p>}
      </section>
    </div>
  );
}
