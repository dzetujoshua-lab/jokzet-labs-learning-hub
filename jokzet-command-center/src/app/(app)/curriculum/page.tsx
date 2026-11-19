import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { fmtDate, metaFor } from "@/lib/programme";
import { listContentGaps } from "@/lib/resources/gaps";

export const metadata: Metadata = { title: "Curriculum" };

/**
 * For Curriculum Managers and Academy Admins: what still needs an approved learning resource, and the state of every resource in the
 * catalogue. Read-only. A resource becomes visible to learners only when it is APPROVED, which today is a reviewed change to
 * prisma/curriculum/resources.ts (the reviewer's name, the date and the Academy Admin's approval are recorded there).
 */
export default async function CurriculumPage() {
  const user = await requireRole("ADMIN", "AUTHOR");
  const [gaps, resources] = await Promise.all([
    listContentGaps(),
    db.learningResource.findMany({
      orderBy: [{ status: "asc" }, { title: "asc" }], take: 200,
      select: { id: true, title: true, provider: true, kind: true, status: true, approvedBy: true, approvedAt: true, lastVerifiedAt: true, _count: { select: { missions: true } } },
    }),
  ]);
  const counts = resources.reduce<Record<string, number>>((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={user.role === "ADMIN" ? "Academy Admin" : "Curriculum Manager"}
        title="Curriculum"
        description="Lessons that still need an approved learning resource, and every resource's review state. Nothing reaches learners until it is approved."
      />
      {user.role === "ADMIN" ? <p className="text-sm"><Link className="text-primary underline-offset-4 hover:underline" href="/admin/staff">Staff and roles →</Link></p> : null}

      <section className="panel overflow-hidden" aria-labelledby="gaps-h">
        <div className="border-b border-border px-5 py-4"><p id="gaps-h" className="mono-label">Lessons without an approved primary resource · {gaps.length}</p></div>
        {gaps.length ? (
          <ul>
            {gaps.map((g) => (
              <li key={g.code} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border/60 px-5 py-3 last:border-0">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: metaFor(g.departmentCode).color }}>{g.code}</span>
                <span className="min-w-0 flex-1 text-sm text-foreground">{g.title}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{g.departmentName}{g.hasSupplementary ? " · optional material only" : ""}</span>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-4 text-sm text-muted-foreground">Every published lesson and checkpoint has an approved primary resource.</p>}
      </section>

      <section className="panel overflow-hidden" aria-labelledby="cat-h">
        <div className="border-b border-border px-5 py-4">
          <p id="cat-h" className="mono-label">Resource catalogue · {resources.length}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{Object.entries(counts).map(([s, n]) => `${s.toLowerCase().replace("_", " ")} ${n}`).join(" · ") || "No resources have been added yet."}</p>
        </div>
        {resources.length ? (
          <ul>
            {resources.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border/60 px-5 py-3 last:border-0">
                <span className="min-w-0 flex-1 text-sm text-foreground">{r.title}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{r.provider} · {r.kind.toLowerCase()} · {r._count.missions} lesson{r._count.missions === 1 ? "" : "s"}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary">{r.status.replace("_", " ")}</span>
                {r.status === "APPROVED" && r.approvedBy ? <span className="w-full text-xs text-muted-foreground">Approved by {r.approvedBy}{r.approvedAt ? ` on ${fmtDate(r.approvedAt.toISOString().slice(0, 10))}` : ""}{r.lastVerifiedAt ? ` · link checked ${fmtDate(r.lastVerifiedAt.toISOString().slice(0, 10))}` : ""}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
