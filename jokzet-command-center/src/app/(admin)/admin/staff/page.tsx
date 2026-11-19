import type { Metadata } from "next";
import { AssignRoleForm, ScopeControl } from "@/components/admin/staff-controls";
import { listStaff } from "@/lib/admin/staff";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Administration Centre · Staff and roles" };

export default async function StaffPage({ searchParams }: PageProps<"/admin/staff">) {
  const admin = await requireRole("ADMIN");
  const params = await searchParams;
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = pick(params.q)?.trim() ?? "";
  const r = await listStaff(admin.id, q);
  if (!r.ok) return null;
  return (
    <div className="space-y-5">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--admin-cyan))]">Administration Centre</p>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-tight text-foreground">Staff and roles</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Curriculum Managers review learning resources, frameworks and syllabus drafts. Academy Admins give the final approval before anything is published. Assessment Reviewers evaluate learner submissions, only in the departments you give them.</p>
      </header>
      <section className="glass p-5" aria-labelledby="assign-h">
        <p id="assign-h" className="mono-label">Assign a role</p>
        <p className="mb-4 mt-1.5 text-xs text-muted-foreground">The person must already have an account. You can&apos;t change your own role, and the last Academy Admin can&apos;t be removed. Every change is recorded with who made it.</p>
        <AssignRoleForm initialRole={pick(params.role)} />
      </section>
      <section className="glass overflow-hidden" aria-labelledby="staff-h">
        <div className="border-b border-border/60 px-5 py-4"><p id="staff-h" className="mono-label">{q ? `Staff matching “${q}”` : "Current staff"} · {r.staff.length}</p></div>
        {r.staff.length ? (
          <ul>
            {r.staff.map((s) => (
              <li key={s.id} className="border-b border-border/60 px-5 py-3 last:border-0">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="min-w-0 flex-1 text-sm text-foreground">{s.displayName} <span className="text-muted-foreground">· {s.email}</span></span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--admin-cyan))]">{s.label}</span>
                </div>
                {s.role === "REVIEWER" ? <ScopeControl email={s.email} scopes={s.scopes} departments={r.departments} /> : null}
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-4 text-sm text-muted-foreground">{q ? "No staff match that search." : "No staff yet."}</p>}
      </section>
    </div>
  );
}
