"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addCourseAction, previewCourseAction } from "@/app/(app)/courses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CourseOffer } from "@/lib/enrolment/service";
import type { CoursePreview } from "@/lib/plan/service";

const DURATIONS = [
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 270, label: "9 months" },
  { days: 365, label: "1 year" },
];

/** One course the learner could add: details, then a preview of what it would add to their timetable, then an explicit confirmation. */
export function AddCourseCard({ offer, today }: { offer: CourseOffer; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(90);
  const [start, setStart] = useState(today);
  const [preview, setPreview] = useState<CoursePreview | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [key] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)));

  const check = () => {
    setError("");
    setPreview(null);
    startTransition(async () => {
      const r = await previewCourseAction({ departmentCode: offer.code, startDate: start, durationDays: days });
      if (!r.ok) return setError(r.error);
      setPreview(r.preview);
    });
  };
  const confirm = () => {
    setError("");
    startTransition(async () => {
      const r = await addCourseAction({ departmentCode: offer.code, startDate: start, durationDays: days, requestKey: key });
      if (!r.ok) return setError(r.error);
      toast.success(r.created ? `${offer.name} added` : "You are already taking this course");
      router.push(`/departments/${offer.code}`);
      router.refresh();
    });
  };

  return (
    <section className="panel p-5">
      <h2 className="text-sm text-foreground">{offer.name}</h2>
      {offer.description ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{offer.description}</p> : null}
      {offer.outcomes.length ? <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">You will: {offer.outcomes.join(" · ")}</p> : null}
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {offer.lessons} approved lessons · {offer.resourcesComplete ? "learning videos ready" : offer.lessonsWithApprovedResource === 0 ? "learning videos not added yet" : `videos for ${offer.lessonsWithApprovedResource} of ${offer.lessons} lessons`}
      </p>

      {!open ? (
        <Button className="mt-4" variant="secondary" onClick={() => setOpen(true)}>Add this course</Button>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="How long">
            {DURATIONS.map((d) => (
              <button key={d.days} type="button" aria-pressed={days === d.days} onClick={() => { setDays(d.days); setPreview(null); }}
                className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ${days === d.days ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                {d.label}
              </button>
            ))}
          </div>
          <label className="block text-xs text-muted-foreground">Start date
            <Input type="date" className="mt-1" min={today} value={start} onChange={(e) => { setStart(e.target.value); setPreview(null); }} />
          </label>
          <p className="text-xs text-muted-foreground">It uses the study days, times and time zone you already set, shared with your other courses.</p>

          {preview ? (
            <div role="status" className="rounded-xl border border-border p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="text-foreground">{preview.sessions} sessions over {preview.weeks} weeks, finishing about {preview.endDate}.</p>
              <p className="mt-1">{preview.missionsPlanned} of {preview.missionsAvailable} approved lessons are scheduled.{preview.replacesPracticeSessions ? ` ${preview.replacesPracticeSessions} spare practice sessions of your other courses give up their seat; nothing you have started, finished or missed is moved.` : ""}</p>
              {preview.contentGapSessions > 0 ? <p className="mt-1">Only part of your study time can be filled with approved lessons today. More lessons will be added as they are approved.</p> : null}
              {!preview.fits ? <p className="mt-1 text-destructive">This does not fit your current study time. Add study time or study days in your timetable settings, choose a longer duration, or start later.</p> : null}
            </div>
          ) : null}
          {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={pending} onClick={check}>{pending && !preview ? "Checking…" : "Check my timetable"}</Button>
            <Button disabled={pending || !preview || !preview.fits} onClick={confirm}>{pending && preview ? "Adding…" : "Confirm and add"}</Button>
            <Button variant="ghost" disabled={pending} onClick={() => { setOpen(false); setPreview(null); setError(""); }}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  );
}
