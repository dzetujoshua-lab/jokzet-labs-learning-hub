import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Paperclip } from "lucide-react";
import { AssessmentResult } from "@/components/assessments/assessment-result";
import { ActivityControls } from "@/components/activities/activity-controls";
import { DeptGlyph } from "@/components/dashboard/dept-glyph";
import { MissionWorkspace } from "@/components/missions/mission-workspace";
import { Button } from "@/components/ui/button";
import { getActivityDetail } from "@/lib/activities/service";
import { requireUser } from "@/lib/auth/dal";
import { listDepartments } from "@/lib/missions/service";
import { getSubmissionState } from "@/lib/missions/submissions";
import { metaFor, toLabel, todayISO } from "@/lib/programme";

export const metadata: Metadata = { title: "Activity" };

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "planned", IN_PROGRESS: "in progress", SUBMITTED: "awaiting assessment",
  NEEDS_REVISION: "needs revision", COMPLETED: "done", PASSED: "passed", SKIPPED: "skipped",
};
const CATEGORY_LABEL = { PERSONAL_ACTIVITY: "Personal activity", RECOMMENDED_CHALLENGE: "Recommended challenge", CURRICULUM_MISSION: "Mission" } as const;

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const lm = await getActivityDetail(user.id, id);
  if (!lm) notFound();

  const { mission } = lm;
  const state = await getSubmissionState(user.id, lm.id);
  const departments = (await listDepartments(user.id)).map((d) => ({ code: d.code, name: d.name }));
  const latest = state?.latest ?? null;
  const draftEvidence = latest?.status === "DRAFT" ? latest.evidence : [];
  const meta = metaFor(mission.department.code);
  const started = lm.status !== "NOT_STARTED";
  const hasRubric = mission.rubric !== null;

  let lockedReason: string | undefined;
  if (!hasRubric) lockedReason = "Choose how this activity will be assessed to be able to submit it.";
  else if (lm.status === "SUBMITTED") lockedReason = "Your last submission is waiting to be assessed.";
  else if (lm.status === "PASSED") lockedReason = "This activity is passed.";
  const canSubmit = started && !lockedReason;
  const hasSubmissions = (state?.attempts ?? 0) > 0;

  return (
    <div className="space-y-6">
      <Link href="/activities" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> personal activities
      </Link>

      <header className="panel animate-rise p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-secondary" style={{ color: meta.color }}>
              <DeptGlyph icon={meta.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="mono-label">{mission.department.name} · {CATEGORY_LABEL[mission.category]}</p>
              <h1 className="mt-2 font-display text-2xl font-medium leading-tight text-foreground">{mission.title}</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{mission.objective}</p>
            </div>
          </div>
          <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{STATUS_LABEL[lm.status]}</span>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Clock className="h-3 w-3" /> {mission.durationMinutes} min</span>
          <span className="inline-flex items-center gap-1.5"><Paperclip className="h-3 w-3" /> {toLabel(mission.evidenceType)}</span>
          <span>No XP · practice</span>
          {hasRubric ? <span>Pass at {mission.rubric?.passingScore}%</span> : null}
        </div>
        <ActivityControls learnerMissionId={lm.id} canStart={!started} needsRubric={!hasRubric && !hasSubmissions} canDelete={!hasSubmissions} />
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {latest?.status === "SUBMITTED" ? (
            <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="mono-label">Attempt {latest.attempt} submitted</p>
                <p className="mt-1.5 text-sm text-muted-foreground">Waiting to be scored against the rubric.</p>
              </div>
              <Button asChild size="sm"><Link href={`/assessments/${latest.id}`}>Assess now</Link></Button>
            </section>
          ) : null}
          {latest?.assessment ? <AssessmentResult assessment={latest.assessment} /> : null}
          {lm.status === "NEEDS_REVISION" ? (
            <p className="panel p-5 text-sm leading-relaxed text-muted-foreground">Work through the corrections above, add updated evidence, and resubmit. Your next submission is attempt {(state?.attempts ?? 0) + 1}.</p>
          ) : null}

          <section className="panel p-5">
            <p className="mono-label">What to hand in</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{mission.submissionRequirements}</p>
            {mission.notes ? (
              <>
                <p className="mono-label mt-5">{mission.category === "RECOMMENDED_CHALLENGE" ? "Why this was suggested" : "Your instructions"}</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{mission.notes}</p>
              </>
            ) : null}
          </section>

          {started ? (
            <MissionWorkspace
              learnerMissionId={lm.id}
              steps={[]}
              completed={lm.completedSteps}
              notes={lm.notes ?? ""}
              canSubmit={canSubmit}
              lockedReason={lockedReason}
              departmentCode={mission.department.code}
              departments={departments}
              today={todayISO()}
              attached={draftEvidence.map((e) => ({ id: e.id, title: e.title, kind: toLabel(e.kind) }))}
              available={(state?.available ?? []).map((e) => ({ id: e.id, title: e.title, kind: toLabel(e.kind) }))}
            />
          ) : (
            <p className="panel p-5 text-sm text-muted-foreground">Start the activity to save notes, attach evidence and submit it.</p>
          )}
        </div>

        <aside className="space-y-5">
          <section className="panel p-5">
            <p className="mono-label">Assessment rubric</p>
            {hasRubric ? (
              <ul className="mt-3 space-y-2.5">
                {mission.rubric?.criteria.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.description}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{c.maxPoints}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No rubric yet. Choose one above so the work can be assessed.</p>
            )}
          </section>
          {mission.skills.length ? (
            <section className="panel p-5">
              <p className="mono-label">Skills you are practising</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {mission.skills.map((s) => (
                  <span key={s.skillId} className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">{s.skill.name}</span>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Practice is recorded and assessed, but skills are earned through programme missions.</p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
