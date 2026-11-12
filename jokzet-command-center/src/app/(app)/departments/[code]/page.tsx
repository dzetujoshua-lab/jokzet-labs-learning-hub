import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AddMissionButton } from "@/components/departments/add-mission-button";
import { MilestoneEditor } from "@/components/departments/milestone-editor";
import { DeptGlyph } from "@/components/dashboard/dept-glyph";
import { MissionRow } from "@/components/dashboard/mission-row";
import { requireUser } from "@/lib/auth/dal";
import { getDepartmentDetail } from "@/lib/department-detail";
import { listDepartments } from "@/lib/missions/service";
import { fmtDate, levelProgress, metaFor, todayISO } from "@/lib/programme";

export const metadata: Metadata = { title: "Department" };

export default async function DepartmentDetailPage({ params }: PageProps<"/departments/[code]">) {
  const { code } = await params;
  const user = await requireUser();
  const detail = await getDepartmentDetail(user.id, code);
  if (!detail) notFound();

  const { dept, missions, evidence, evidenceCount, assessments, assessmentCount, portfolio } = detail;
  const departments = await listDepartments(user.id);
  const meta = metaFor(dept.code);
  const { level, inLevel, target, pct } = levelProgress(dept.xp);

  return (
    <div className="space-y-6">
      {/* Wrapper reproduces Base44's spacing: Tailwind 4 `space-y` treats an inline-flex child differently from Tailwind 3. */}
      <div>
        <Link
          href="/departments"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> departments
        </Link>
      </div>

      <header className="panel animate-rise p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-secondary" style={{ color: meta.color }}>
              <DeptGlyph icon={meta.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="mono-label">Department</p>
              <h1 className="mt-2 font-display text-2xl font-medium leading-tight text-foreground">{dept.name}</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl leading-none tabular-nums text-foreground">LV {level}</p>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {inLevel}/{target} XP
            </p>
          </div>
        </div>

        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: meta.color }} />
        </div>

        <MilestoneEditor departmentId={dept.id} initial={dept.nextMilestone ?? ""} />
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <p className="mono-label">Missions · {missions.length}</p>
            <AddMissionButton departments={departments} defaultDepartment={dept.code} today={todayISO()} />
          </div>
          {missions.length ? (
            <ul>
              {missions.slice(0, 8).map((mission) => (
                <MissionRow key={mission.id} mission={mission} deptName={dept.name} canToggle />
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-xs text-muted-foreground">No missions logged for this department yet.</p>
          )}
        </section>

        <div className="space-y-5">
          <section className="panel p-5">
            <p className="mono-label">Evidence · {evidenceCount}</p>
            {evidence.length ? (
              <ul className="mt-3 space-y-2.5">
                {evidence.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-[13px] text-foreground">{item.title}</p>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {fmtDate(item.date)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No evidence captured yet.</p>
            )}
          </section>

          <section className="panel p-5">
            <p className="mono-label">Assessments · {assessmentCount}</p>
            {assessments.length ? (
              <ul className="mt-3 space-y-2.5">
                {assessments.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-[13px] text-foreground">{item.title}</p>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                      {item.score}/{item.max}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No assessments logged yet.</p>
            )}
          </section>

          <section className="panel p-5">
            <p className="mono-label">Portfolio · {portfolio.length}</p>
            {portfolio.length ? (
              <ul className="mt-3 space-y-2.5">
                {portfolio.map((piece) => (
                  <li key={piece.id} className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-[13px] text-foreground">{piece.title}</p>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {piece.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No portfolio pieces mapped to this department.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
