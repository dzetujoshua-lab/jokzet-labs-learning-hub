"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { attachEvidenceAction, detachEvidenceAction, saveProgressAction, submitMissionAction, type WorkflowState } from "@/app/(app)/actions";
import { EvidenceForm } from "@/components/evidence/evidence-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type StepView = { id: string; phase: "WATCH" | "DO" | "EXPERIMENT" | "SHOW"; title: string; instructions: string };

const PHASES: { id: StepView["phase"]; label: string; hint: string }[] = [
  { id: "WATCH", label: "Watch", hint: "See how it is done" },
  { id: "DO", label: "Do", hint: "Build it yourself" },
  { id: "EXPERIMENT", label: "Experiment", hint: "Break it and learn" },
  { id: "SHOW", label: "Show", hint: "Prove it" },
];

function useToastOnResult(state: WorkflowState) {
  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
    if (state?.error) toast.error(state.error);
  }, [state]);
}

export type EvidenceChip = { id: string; title: string; kind: string };

function EvidenceSection({
  learnerMissionId, missionCode, departmentCode, departments, today, attached, available,
}: {
  learnerMissionId: string; missionCode?: string; departmentCode: string; departments: { code: string; name: string }[]; today: string;
  attached: EvidenceChip[]; available: EvidenceChip[];
}) {
  const [pick, setPick] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) toast.error(result.error ?? "Could not update the evidence");
    });

  return (
    <section className="panel p-5">
      <p className="mono-label">Evidence for this attempt · {attached.length}</p>
      {attached.length ? (
        <ul className="mt-3 space-y-2.5">
          {attached.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-[13px] text-foreground">{e.title} <span className="text-muted-foreground">· {e.kind}</span></p>
              <button type="button" disabled={pending} onClick={() => run(() => detachEvidenceAction(e.id))} className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-destructive">remove</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Nothing attached yet. Attach a vault item or upload new evidence (or add a repository or live link below).</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {available.length ? (
          <>
            <select aria-label="Attach existing evidence" value={pick} onChange={(e) => setPick(e.target.value)} className="h-8 max-w-[14rem] rounded-md border border-input bg-card px-2 text-xs text-foreground">
              <option value="">Attach from vault…</option>
              {available.map((e) => (<option key={e.id} value={e.id}>{e.title}</option>))}
            </select>
            <Button size="sm" variant="secondary" disabled={!pick || pending} onClick={() => { run(() => attachEvidenceAction(learnerMissionId, pick)); setPick(""); }}>Attach</Button>
          </>
        ) : null}
        <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setFormOpen(true)}><Plus className="h-3.5 w-3.5" /> Upload evidence</Button>
      </div>
      <EvidenceForm open={formOpen} onOpenChange={setFormOpen} departments={departments} defaultDepartment={departmentCode} missionCode={missionCode} attachToLearnerMissionId={learnerMissionId} today={today} />
    </section>
  );
}

export function MissionWorkspace({
  learnerMissionId, steps, completed, notes, canSubmit, lockedReason, missionCode, departmentCode, departments, today, attached, available,
}: {
  learnerMissionId: string;
  steps: StepView[];
  completed: string[];
  notes: string;
  canSubmit: boolean;
  lockedReason?: string;
  missionCode?: string;
  departmentCode: string;
  departments: { code: string; name: string }[];
  today: string;
  attached: EvidenceChip[];
  available: EvidenceChip[];
}) {
  const [saveState, saveAction, saving] = useActionState(saveProgressAction.bind(null, learnerMissionId), undefined);
  const [submitState, submitAction, submitting] = useActionState(submitMissionAction.bind(null, learnerMissionId), undefined);
  useToastOnResult(saveState);
  useToastOnResult(submitState);

  return (
    <div className="space-y-5">
      <form action={saveAction} className="space-y-5">
        {PHASES.map((phase, index) => {
          const phaseSteps = steps.filter((s) => s.phase === phase.id);
          if (!phaseSteps.length) return null;
          return (
            <section key={phase.id} className="panel overflow-hidden">
              <header className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <p className="mono-label">
                    {index + 1} · {phase.hint}
                  </p>
                  <h2 className="mt-1.5 font-display text-lg font-medium text-foreground">{phase.label}</h2>
                </div>
              </header>
              <ul>
                {phaseSteps.map((step) => (
                  <li key={step.id} className="border-b border-border/60 px-5 py-4 last:border-0">
                    <label className="flex cursor-pointer items-start gap-3.5">
                      <input
                        type="checkbox"
                        name="step"
                        value={step.id}
                        defaultChecked={completed.includes(step.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                      />
                      <span className="text-sm leading-relaxed text-foreground">{step.instructions}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <section className="panel p-5">
          <label htmlFor="notes" className="mono-label">
            Your notes
          </label>
          <Textarea id="notes" name="notes" defaultValue={notes} rows={4} maxLength={4000} className="mt-2" placeholder="What you tried, what broke, what you learned…" />
          <Button type="submit" size="sm" variant="secondary" className="mt-3" disabled={saving}>
            {saving ? "Saving…" : "Save progress"}
          </Button>
        </section>
      </form>

      {canSubmit ? (
        <EvidenceSection learnerMissionId={learnerMissionId} missionCode={missionCode} departmentCode={departmentCode} departments={departments} today={today} attached={attached} available={available} />
      ) : null}

      <section className="panel p-5">
        <p className="mono-label">Submit for assessment</p>
        {canSubmit ? (
          <form action={submitAction} className="mt-3 space-y-3">
            <div>
              <label htmlFor="explanation" className="mono-label mb-1.5 block">What you did and learned</label>
              <Textarea id="explanation" name="explanation" rows={4} required minLength={20} maxLength={4000} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="githubUrl" className="mono-label mb-1.5 block">Repository link (optional)</label>
                <Input id="githubUrl" name="githubUrl" type="url" inputMode="url" placeholder="https://" />
              </div>
              <div>
                <label htmlFor="liveUrl" className="mono-label mb-1.5 block">Live project link (optional)</label>
                <Input id="liveUrl" name="liveUrl" type="url" inputMode="url" placeholder="https://" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Submit needs at least one piece of evidence (attached above) or a repository/live link. Never include secrets.</p>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit mission"}
            </Button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{lockedReason}</p>
        )}
      </section>
    </div>
  );
}
