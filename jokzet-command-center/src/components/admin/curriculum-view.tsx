import { db } from "@/lib/db";
import { fmtDate, metaFor } from "@/lib/programme";
import { listContentGaps } from "@/lib/resources/gaps";

/**
 * Lessons that still need an approved learning resource, and every resource's review state. Read-only. Shared by the Curriculum page
 * in the learner area (Curriculum Managers) and the Administration Centre. The caller has already checked the role.
 */
export async function CurriculumView() {
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
