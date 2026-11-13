import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Paperclip, Wrench } from "lucide-react";
import { startMissionAction } from "@/app/(app)/actions";
import { AssessmentResult } from "@/components/assessments/assessment-result";
import { DeptGlyph } from "@/components/dashboard/dept-glyph";
import { MissionWorkspace } from "@/components/missions/mission-workspace";
import { WatchPanel } from "@/components/missions/watch-panel";
import { MissionSchedulePanel } from "@/components/timetable/mission-schedule";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { getMissionDetail } from "@/lib/missions/progress";
import { listDepartments } from "@/lib/missions/service";
import { getMissionSchedule, timetableAccess } from "@/lib/plan/timetable-service";
import { parseResourceUrl } from "@/lib/resources/embed";
import { getMissionWatch } from "@/lib/resources/service";
import { getSubmissionState } from "@/lib/missions/submissions";
import { metaFor, toLabel, todayISO } from "@/lib/programme";

export const metadata: Metadata = { title: "Mission" };

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "planned", IN_PROGRESS: "in progress", SUBMITTED: "awaiting assessment",
  NEEDS_REVISION: "needs revision", COMPLETED: "done", PASSED: "passed", SKIPPED: "skipped",
};

export default async function MissionDetailPage({ params }: PageProps<"/missions/[code]">) {
  const { code } = await params;
  const user = await requireUser();
  const detail = await getMissionDetail(user.id, code);
  if (!detail) notFound();

  const { mission, learnerMission } = detail;
  const watch = await getMissionWatch(user.id, mission.id); // approved WATCH resources only
  const state = learnerMission ? await getSubmissionState(user.id, learnerMission.id) : null;
  const departments = (await listDepartments(user.id)).map((d) => ({ code: d.code, name: d.name }));
  const schedule = mission.code && (await timetableAccess(user.id)) ? await getMissionSchedule(user.id, mission.code) : null; // only for personalised learners with a plan
  const latest = state?.latest ?? null;
  const draftEvidence = latest?.status === "DRAFT" ? latest.evidence : [];
  const meta = metaFor(mission.department.code);
  const started = learnerMission && learnerMission.status !== "NOT_STARTED";
  const status = learnerMission?.status ?? "NOT_STARTED";

  let lockedReason: string | undefined;
  if (status === "SUBMITTED") lockedReason = "Your last submission is waiting to be assessed.";
  else if (status === "PASSED") lockedReason = "This mission is passed.";
  const canSubmit = !!started && !lockedReason;

  return (
    <div className="space-y-6">
      <Link
        href="/missions"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> mission board
      </Link>

      <header className="panel animate-rise p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-secondary" style={{ color: meta.color }}>
              <DeptGlyph icon={meta.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="mono-label">
                {mission.department.name} · {mission.code}
              </p>
              <h1 className="mt-2 font-display text-2xl font-medium leading-tight text-foreground">{mission.title}</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{mission.objective}</p>
            </div>
          </div>
          <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {STATUS_LABEL[status]}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Clock className="h-3 w-3" /> {mission.durationMinutes} min</span>
          <span className="inline-flex items-center gap-1.5"><Paperclip className="h-3 w-3" /> {toLabel(mission.evidenceType)}</span>
          <span className="inline-flex items-center gap-1.5"><Wrench className="h-3 w-3" /> {mission.requiredTools.join(", ") || "No tools"}</span>
          <span>{mission.xpReward} XP</span>
          <span>Pass at {mission.rubric?.passingScore ?? 70}%</span>
        </div>

        {!started ? (
          <form action={startMissionAction.bind(null, mission.code!)} className="mt-5">
            <Button type="submit">Start mission</Button>
          </form>
        ) : null}
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
          {status === "NEEDS_REVISION" ? (
            <p className="panel p-5 text-sm leading-relaxed text-muted-foreground">
              Work through the corrections above, add updated evidence, and resubmit. Your next submission is attempt {(state?.attempts ?? 0) + 1}.
            </p>
          ) : null}
          {started && learnerMission ? (
            <MissionWorkspace
              learnerMissionId={learnerMission.id}
              steps={mission.steps.map((s) => ({ id: s.id, phase: s.phase, title: s.title, instructions: s.instructions }))}
              completed={learnerMission.completedSteps}
              notes={learnerMission.notes ?? ""}
              canSubmit={canSubmit}
              lockedReason={lockedReason}
              missionCode={mission.code!}
              departmentCode={mission.department.code}
              departments={departments}
              today={todayISO()}
              attached={draftEvidence.map((e) => ({ id: e.id, title: e.title, kind: toLabel(e.kind) }))}
              available={(state?.available ?? []).map((e) => ({ id: e.id, title: e.title, kind: toLabel(e.kind) }))}
            />
          ) : (
            <section className="panel p-5">
              <p className="mono-label">Method</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Watch → Do → Experiment → Show → Get assessed. Start the mission to see the steps and save your progress.
              </p>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          {schedule ? <MissionSchedulePanel schedule={schedule} /> : null}
          {watch.length ? (
            <WatchPanel resources={watch} />
          ) : (
            <section className="panel p-5">
              <p className="mono-label">Watch · learn it first</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No approved video or guide has been added for this mission yet. The steps below still tell you what to do.</p>
              {mission.resources.map((r) => (
                <div key={r.id} className="mt-3">
                  <p className="text-[13px] text-foreground">{r.title}</p>
                  {r.url && parseResourceUrl(r.url).ok ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                      open
                    </a>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">{r.notes ?? "To be supplied."}</p>
                  )}
                </div>
              ))}
            </section>
          )}

          <section className="panel p-5">
            <p className="mono-label">Experiment challenge</p>
            <p className="mt-2 text-[13px] leading-relaxed text-foreground">{mission.experimentChallenge}</p>
          </section>

          <section className="panel p-5">
            <p className="mono-label">Assessment rubric</p>
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
          </section>

          <section className="panel p-5">
            <p className="mono-label">If you do not pass</p>
            <p className="mt-2 text-[13px] leading-relaxed text-foreground">{mission.remediation}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
