import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { AssignRoleForm, ScopeControl } from "@/components/admin/staff-controls";
import { listStaff } from "@/lib/admin/staff";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Admin Centre · Staff" };

export default async function StaffPage() {
  const admin = await requireRole("ADMIN");
  const r = await listStaff(admin.id);
  if (!r.ok) return null;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin Centre"
        title="Staff and roles"
        description="Curriculum Managers review learning resources, frameworks and syllabus drafts. Academy Admins give the final approval before anything is published. Assessment Reviewers evaluate learner submissions, only in the departments you give them."
      />
      <section className="panel p-5" aria-labelledby="assign-h">
        <p id="assign-h" className="mono-label">Assign a role</p>
        <p className="mb-4 mt-1.5 text-xs text-muted-foreground">The person must already have an account. You can&apos;t change your own role, and the last Academy Admin can&apos;t be removed. Every change is recorded with who made it.</p>
        <AssignRoleForm />
      </section>
      <section className="panel overflow-hidden" aria-labelledby="staff-h">
        <div className="border-b border-border px-5 py-4"><p id="staff-h" className="mono-label">Current staff · {r.staff.length}</p></div>
        {r.staff.length ? (
          <ul>
            {r.staff.map((s) => (
              <li key={s.id} className="border-b border-border/60 px-5 py-3 last:border-0">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="min-w-0 flex-1 text-sm text-foreground">{s.displayName} <span className="text-muted-foreground">· {s.email}</span></span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary">{s.label}</span>
                </div>
                {s.role === "REVIEWER" ? <ScopeControl email={s.email} scopes={s.scopes} departments={r.departments} /> : null}
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-4 text-sm text-muted-foreground">No staff yet.</p>}
      </section>
    </div>
  );
}
