"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeOnboardingAction, saveOnboardingAction, skipBaselineAction, startBaselineAction } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sessionsPerDay } from "@/lib/plan/availability";
import type { OnboardingState } from "@/lib/plan/onboarding";
import { DURATIONS, MAX_GOALS, type DurationKind } from "@/lib/plan/schema";

type Goal = { departmentCode: string; weight: number; targetLevel: number; note: string };

const STEPS = ["About you", "Subjects", "Your time", "Duration", "Baseline"] as const;
const EXPERIENCE = [
  { value: "BEGINNER", label: "Beginner", hint: "New to this. Start from the basics." },
  { value: "IMPROVER", label: "Improver", hint: "Know a little. Fill the gaps." },
  { value: "INTERMEDIATE", label: "Intermediate", hint: "Comfortable. Build real projects." },
  { value: "ADVANCED", label: "Advanced", hint: "Experienced. Go deeper." },
] as const;
const DURATION_LABEL: Record<DurationKind, string> = {
  TWO_WEEKS: "2 weeks", ONE_MONTH: "1 month", THREE_MONTHS: "3 months", SIX_MONTHS: "6 months", ONE_YEAR: "1 year", CUSTOM: "Custom",
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SELECT = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const chip = (on: boolean) => `rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${on ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`;

export function OnboardingWizard({ departments, state, today }: { departments: { code: string; name: string }[]; state: OnboardingState; today: string }) {
  const router = useRouter();
  const d = state.draft;
  const [step, setStep] = useState(d ? 4 : 0);
  const [experience, setExperience] = useState(d?.experience ?? "BEGINNER");
  const [goals, setGoals] = useState<Goal[]>(d?.goals ?? []);
  const [sessionMinutes, setSessionMinutes] = useState(String(d?.sessionMinutes ?? 45));
  const [dailyStudyMinutes, setDailyStudyMinutes] = useState(String(d?.dailyStudyMinutes ?? 0));
  const [breakMinutes, setBreakMinutes] = useState(String(d?.breakMinutes ?? 0));
  const [flexibility, setFlexibility] = useState<"STRICT" | "BALANCED" | "FLEXIBLE">(d?.flexibility ?? "BALANCED");
  const [autoReschedule, setAutoReschedule] = useState(d?.autoReschedule ?? true);
  const [weekdays, setWeekdays] = useState<number[]>(d?.weekdays ?? [1, 3, 5]);
  const [startTime, setStartTime] = useState(d?.startTime ?? "18:00");
  const [timezone, setTimezone] = useState(d?.timezone ?? (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"));
  const [durationKind, setDurationKind] = useState<DurationKind>(d?.durationKind ?? "ONE_MONTH");
  const [customDays, setCustomDays] = useState(String(d?.durationKind === "CUSTOM" ? d.durationDays : 30));
  const [startDate, setStartDate] = useState(d?.startDate ?? today);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const perDay = sessionsPerDay(Number(dailyStudyMinutes) || 0, Number(sessionMinutes) || 45, Number(breakMinutes) || 0);
  const goalOf = (code: string) => goals.find((g) => g.departmentCode === code);
  const toggleGoal = (code: string) =>
    setGoals((gs) => (gs.some((g) => g.departmentCode === code) ? gs.filter((g) => g.departmentCode !== code) : gs.length >= MAX_GOALS ? gs : [...gs, { departmentCode: code, weight: 3, targetLevel: 1, note: "" }]));
  const patchGoal = (code: string, patch: Partial<Goal>) => setGoals((gs) => gs.map((g) => (g.departmentCode === code ? { ...g, ...patch } : g)));
  const toggleDay = (day: number) => setWeekdays((w) => (w.includes(day) ? w.filter((x) => x !== day) : [...w, day]));

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError("");
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      after?.();
    });
  };

  const save = () =>
    run(
      () =>
        saveOnboardingAction({
          experience, goals, sessionMinutes: Number(sessionMinutes), dailyStudyMinutes: Number(dailyStudyMinutes), breakMinutes: Number(breakMinutes), flexibility, autoReschedule, weekdays, startTime, timezone, durationKind,
          customDays: durationKind === "CUSTOM" ? Number(customDays) : undefined, startDate,
        }),
      () => {
        setStep(4);
        router.refresh();
      },
    );

  const nameOf = (code: string) => departments.find((x) => x.code === code)?.name ?? code;
  const baselineOf = (code: string) => state.baselines.find((b) => b.departmentCode === code);

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined} className={chip(i === step)}>{i + 1}. {label}</li>
        ))}
      </ol>

      <section className="panel p-5">
        {step === 0 ? (
          <div role="radiogroup" aria-label="Experience" className="grid gap-2 sm:grid-cols-2">
            {EXPERIENCE.map((e) => (
              <button key={e.value} type="button" role="radio" aria-checked={experience === e.value} onClick={() => setExperience(e.value)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${experience === e.value ? "border-primary/60 bg-primary/10" : "border-border hover:border-primary/40"}`}>
                <span className="block text-sm text-foreground">{e.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{e.hint}</span>
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Choose up to {MAX_GOALS} subjects. A higher weight gets more of your time.</p>
            <div className="flex flex-wrap gap-2">
              {departments.map((x) => (
                <button key={x.code} type="button" aria-pressed={!!goalOf(x.code)} onClick={() => toggleGoal(x.code)} className={chip(!!goalOf(x.code))}>{x.name}</button>
              ))}
            </div>
            {goals.map((g) => (
              <div key={g.departmentCode} className="rounded-xl border border-border p-4">
                <p className="text-sm text-foreground">{nameOf(g.departmentCode)}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-muted-foreground">Weight (1 to 5)
                    <select className={`${SELECT} mt-1`} value={g.weight} onChange={(e) => patchGoal(g.departmentCode, { weight: Number(e.target.value) })}>
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-muted-foreground">Aim for level
                    <select className={`${SELECT} mt-1`} value={g.targetLevel} onChange={(e) => patchGoal(g.departmentCode, { targetLevel: Number(e.target.value) })}>
                      {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Level {n}</option>)}
                    </select>
                  </label>
                </div>
                <Textarea aria-label={`Note for ${nameOf(g.departmentCode)}`} rows={2} maxLength={300} className="mt-3" placeholder="Anything specific you want from this subject (optional)" value={g.note} onChange={(e) => patchGoal(g.departmentCode, { note: e.target.value })} />
              </div>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div>
              <p className="mono-label">Days you can study</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAYS.map((label, i) => <button key={label} type="button" aria-pressed={weekdays.includes(i)} onClick={() => toggleDay(i)} className={chip(weekdays.includes(i))}>{label}</button>)}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-muted-foreground">Minutes per session
                <Input type="number" inputMode="numeric" min={15} max={240} step={5} className="mt-1" value={sessionMinutes} onChange={(e) => setSessionMinutes(e.target.value)} />
              </label>
              <label className="text-xs text-muted-foreground">Start time
                <Input type="time" className="mt-1" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </label>
              <label className="text-xs text-muted-foreground">Time zone
                <Input className="mt-1" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-muted-foreground">Study time per day (minutes, 0 = one session)
                <Input type="number" inputMode="numeric" min={0} max={720} step={5} className="mt-1" value={dailyStudyMinutes} onChange={(e) => setDailyStudyMinutes(e.target.value)} />
              </label>
              <label className="text-xs text-muted-foreground">Break between sessions (minutes)
                <Input type="number" inputMode="numeric" min={0} max={60} step={5} className="mt-1" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
              </label>
              <label className="text-xs text-muted-foreground">Flexibility
                <select className={`${SELECT} mt-1`} value={flexibility} onChange={(e) => setFlexibility(e.target.value as "STRICT" | "BALANCED" | "FLEXIBLE")}>
                  <option value="STRICT">Strict: keep my exact times</option>
                  <option value="BALANCED">Balanced</option>
                  <option value="FLEXIBLE">Flexible: shift within my days</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              That is {perDay} session{perDay === 1 ? "" : "s"} on each study day.
            </p>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="mt-0.5" checked={autoReschedule} onChange={(e) => setAutoReschedule(e.target.checked)} />
              <span>Let the Academy reschedule missed sessions for me. If this is off, missed sessions are only recorded.</span>
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((k) => <button key={k} type="button" aria-pressed={durationKind === k} onClick={() => setDurationKind(k)} className={chip(durationKind === k)}>{DURATION_LABEL[k]}</button>)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {durationKind === "CUSTOM" ? (
                <label className="text-xs text-muted-foreground">Number of days (7 to 365)
                  <Input type="number" inputMode="numeric" min={7} max={365} className="mt-1" value={customDays} onChange={(e) => setCustomDays(e.target.value)} />
                </label>
              ) : null}
              <label className="text-xs text-muted-foreground">Start date
                <Input type="date" className="mt-1" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              A baseline is a short exercise that shows where you should start. It is optional, you assess it yourself, and it never earns XP or skills.
            </p>
            {(d?.goals ?? []).map((g) => {
              const b = baselineOf(g.departmentCode);
              const available = state.baselineAvailable.includes(g.departmentCode);
              return (
                <div key={g.departmentCode} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{nameOf(g.departmentCode)}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {b?.status === "ASSESSED" ? `Done · ${b.percentage}% · start at level ${b.placementLevel}` : b?.status === "SKIPPED" ? "Skipped · start at Level 0" : b?.status === "PENDING" ? "Started" : available ? "Not started" : "No baseline yet · start at Level 0"}
                    </p>
                  </div>
                  {available && b?.status !== "ASSESSED" ? (
                    <div className="flex gap-2">
                      {b?.missionCode && b.status === "PENDING" ? (
                        <Button size="sm" variant="secondary" disabled={pending} onClick={() => router.push(`/missions/${b.missionCode}`)}>Continue</Button>
                      ) : (
                        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => startBaselineAction(g.departmentCode), () => router.refresh())}>Start</Button>
                      )}
                      {b?.status !== "SKIPPED" ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => skipBaselineAction(g.departmentCode), () => router.refresh())}>Skip</Button> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {error ? <p role="alert" className="mt-4 text-xs text-destructive">{error}</p> : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" disabled={pending || step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</Button>
        {step < 3 ? (
          <Button disabled={pending || (step === 1 && goals.length === 0) || (step === 2 && weekdays.length === 0)} onClick={() => { setError(""); setStep((s) => s + 1); }}>Next</Button>
        ) : step === 3 ? (
          <Button disabled={pending} onClick={save}>{pending ? "Saving…" : "Save and continue"}</Button>
        ) : (
          <Button disabled={pending} onClick={() => run(() => completeOnboardingAction(), () => { toast.success("Setup saved"); router.push("/"); router.refresh(); })}>
            {pending ? "Finishing…" : "Finish setup"}
          </Button>
        )}
      </div>
    </div>
  );
}
