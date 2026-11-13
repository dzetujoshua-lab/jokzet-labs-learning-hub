"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changeAvailabilityAction } from "@/app/(app)/timetable/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sessionsPerDay } from "@/lib/plan/availability";

type Flex = "STRICT" | "BALANCED" | "FLEXIBLE";
export type AvailabilityValues = { weekdays: number[]; startTime: string; sessionMinutes: number; dailyStudyMinutes: number; breakMinutes: number; flexibility: Flex; autoReschedule: boolean };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SELECT = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${on ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`;

/** Change study days, hours, breaks and the rescheduling choice. Changing WHEN you study builds a new version of the plan from today. */
export function AvailabilityForm({ initial }: { initial: AvailabilityValues }) {
  const router = useRouter();
  const [v, setV] = useState({ ...initial, sessionMinutes: String(initial.sessionMinutes), dailyStudyMinutes: String(initial.dailyStudyMinutes), breakMinutes: String(initial.breakMinutes) });
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const perDay = sessionsPerDay(Number(v.dailyStudyMinutes) || 0, Number(v.sessionMinutes) || 45, Number(v.breakMinutes) || 0);
  const toggle = (d: number) => setV((s) => ({ ...s, weekdays: s.weekdays.includes(d) ? s.weekdays.filter((x) => x !== d) : [...s.weekdays, d] }));

  const save = () => {
    setError("");
    startTransition(async () => {
      const r = await changeAvailabilityAction({
        weekdays: v.weekdays, startTime: v.startTime, sessionMinutes: Number(v.sessionMinutes), dailyStudyMinutes: Number(v.dailyStudyMinutes), breakMinutes: Number(v.breakMinutes),
        flexibility: v.flexibility, autoReschedule: v.autoReschedule,
      });
      if (!r.ok) return setError(r.error ?? "Could not save.");
      toast.success(r.newVersion ? "New timetable built from today" : "Saved");
      router.push("/timetable");
      router.refresh();
    });
  };

  return (
    <section className="panel space-y-5 p-5">
      <div>
        <p className="mono-label">Days you can study</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map((d, i) => <button key={d} type="button" aria-pressed={v.weekdays.includes(i)} onClick={() => toggle(i)} className={chip(v.weekdays.includes(i))}>{d}</button>)}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">Start time<Input type="time" className="mt-1" value={v.startTime} onChange={(e) => setV({ ...v, startTime: e.target.value })} /></label>
        <label className="text-xs text-muted-foreground">Minutes per session<Input type="number" inputMode="numeric" min={15} max={240} step={5} className="mt-1" value={v.sessionMinutes} onChange={(e) => setV({ ...v, sessionMinutes: e.target.value })} /></label>
        <label className="text-xs text-muted-foreground">Study time per day (0 = one session)<Input type="number" inputMode="numeric" min={0} max={720} step={5} className="mt-1" value={v.dailyStudyMinutes} onChange={(e) => setV({ ...v, dailyStudyMinutes: e.target.value })} /></label>
        <label className="text-xs text-muted-foreground">Break between sessions<Input type="number" inputMode="numeric" min={0} max={60} step={5} className="mt-1" value={v.breakMinutes} onChange={(e) => setV({ ...v, breakMinutes: e.target.value })} /></label>
        <label className="text-xs text-muted-foreground">Flexibility
          <select className={`${SELECT} mt-1`} value={v.flexibility} onChange={(e) => setV({ ...v, flexibility: e.target.value as Flex })}>
            <option value="STRICT">Strict: keep my exact times</option>
            <option value="BALANCED">Balanced</option>
            <option value="FLEXIBLE">Flexible: shift within my days</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">That is {perDay} session{perDay === 1 ? "" : "s"} on each study day.</p>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="mt-0.5" checked={v.autoReschedule} onChange={(e) => setV({ ...v, autoReschedule: e.target.checked })} />
        <span>Let the Academy reschedule missed sessions for me. If this is off, missed sessions are only recorded.</span>
      </label>
      <p className="text-xs leading-relaxed text-muted-foreground">Changing your days, hours or session length builds a new timetable from today. Your old timetable stays in your history and nothing you have done changes.</p>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button disabled={pending || v.weekdays.length === 0} onClick={save}>{pending ? "Saving…" : "Save changes"}</Button>
        <Button variant="secondary" disabled={pending} onClick={() => router.push("/timetable")}>Cancel</Button>
      </div>
    </section>
  );
}
