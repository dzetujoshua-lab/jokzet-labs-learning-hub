"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { acceptRecommendationAction, createPersonalActivityAction, dismissRecommendationAction } from "@/app/(app)/actions";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RUBRIC_TEMPLATES } from "@/lib/activities/rubric-templates";
import type { ActivityView, RecommendationView } from "@/lib/activities/service";
import { EVIDENCE_TYPES, MISSION_KINDS, fmtDate, metaFor } from "@/lib/programme";

type Dept = { code: string; name: string };
type Skill = { id: string; name: string; departmentCode: string };

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "planned", IN_PROGRESS: "in progress", SUBMITTED: "awaiting assessment", NEEDS_REVISION: "needs revision", COMPLETED: "done", PASSED: "passed", SKIPPED: "skipped",
};
const CATEGORY_LABEL = { PERSONAL_ACTIVITY: "Personal", RECOMMENDED_CHALLENGE: "Challenge", CURRICULUM_MISSION: "Mission" } as const;

function ActivityForm({ departments, skills, onDone }: { departments: Dept[]; skills: Skill[]; onDone: (id: string) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dept, setDept] = useState("");
  const [kind, setKind] = useState("Build");
  const [evidence, setEvidence] = useState("Screenshot");
  const [template, setTemplate] = useState("build");
  const [picked, setPicked] = useState<string[]>([]);
  const deptSkills = skills.filter((s) => s.departmentCode === dept);
  const chosenTemplate = RUBRIC_TEMPLATES.find((t) => t.key === template);

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      const result = await createPersonalActivityAction({
        title: String(fd.get("title") ?? ""), departmentCode: dept, kind: kind as never, evidenceType: evidence as never,
        minutes: Number(fd.get("minutes") ?? 60), objective: String(fd.get("objective") ?? ""), deliverables: String(fd.get("deliverables") ?? ""),
        instructions: String(fd.get("instructions") ?? ""), skillIds: picked, rubricTemplate: template, date: String(fd.get("date") ?? ""),
      });
      if (result.ok && result.id) {
        toast.success("Activity created");
        onDone(result.id);
      } else setError(result.error ?? "Could not create the activity.");
    });
  }

  return (
    <form action={submit} className="space-y-4">
      {error ? <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
      <FormField label="Title"><Input name="title" required minLength={3} maxLength={120} autoFocus placeholder="Build my portfolio website" /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Department">
          <Select value={dept} onValueChange={(v) => { setDept(v); setPicked([]); }}>
            <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
            <SelectContent>{departments.map((d) => <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Minutes"><Input name="minutes" type="number" min={5} max={480} step={5} defaultValue={60} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Kind">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MISSION_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Evidence to capture">
          <Select value={evidence} onValueChange={setEvidence}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{EVIDENCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="What you want to achieve"><Textarea name="objective" rows={2} required minLength={10} maxLength={500} placeholder="Build and publish a one-page site with my projects." /></FormField>
      <FormField label="What you will hand in as proof"><Input name="deliverables" required minLength={5} maxLength={500} placeholder="A live link and a screenshot" /></FormField>
      <FormField label="Instructions or plan (optional)"><Textarea name="instructions" rows={3} maxLength={2000} /></FormField>
      {deptSkills.length ? (
        <FormField label="Skills you will practise (optional, not credited)">
          <div className="flex flex-wrap gap-1.5">
            {deptSkills.map((s) => {
              const on = picked.includes(s.id);
              return (
                <button
                  key={s.id} type="button" aria-pressed={on}
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.id) : p.length < 8 ? [...p, s.id] : p))}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${on ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                >{s.name}</button>
              );
            })}
          </div>
        </FormField>
      ) : null}
      <FormField label="How it will be assessed">
        <Select value={template} onValueChange={setTemplate}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {RUBRIC_TEMPLATES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
            <SelectItem value="none">Decide later (not assessable yet)</SelectItem>
          </SelectContent>
        </Select>
        {chosenTemplate ? <p className="mt-1.5 text-[11px] text-muted-foreground">{chosenTemplate.suits}. Criteria: {chosenTemplate.criteria.map(([n]) => n).join(", ")}.</p> : null}
      </FormField>
      <FormField label="Planned date (optional)"><Input name="date" type="date" /></FormField>
      <Button type="submit" disabled={pending || !dept} className="w-full">{pending ? "Creating…" : "Create activity"}</Button>
    </form>
  );
}

export function ActivitiesView({
  activities, recommendations, departments, skills,
}: { activities: ActivityView[]; recommendations: RecommendationView[]; departments: Dept[]; skills: Skill[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const deptName = (code: string) => departments.find((d) => d.code === code)?.name ?? code;
  const active = activities.filter((a) => a.status !== "PASSED");
  const finished = activities.filter((a) => a.status === "PASSED");

  function accept(id: string) {
    start(async () => {
      const result = await acceptRecommendationAction(id);
      if (result.ok && result.id) {
        toast.success("Challenge added to your activities");
        router.push(`/activities/${result.id}`);
      } else toast.error(result.error ?? "Could not accept the challenge.");
    });
  }
  function dismiss(id: string) {
    start(async () => {
      const result = await dismissRecommendationAction(id);
      if (!result.ok) toast.error(result.error ?? "Could not dismiss the challenge.");
    });
  }

  const Card = ({ a }: { a: ActivityView }) => {
    const meta = metaFor(a.departmentCode);
    return (
      <li className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <Link href={`/activities/${a.id}`} className="block truncate text-sm text-foreground hover:text-primary">{a.title}</Link>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <span style={{ color: meta.color }}>{deptName(a.departmentCode)}</span>
            <span>{a.minutes}m</span>
            {a.date ? <span>{fmtDate(a.date)}</span> : null}
            <span>{a.hasRubric ? "assessable" : "no rubric yet"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{CATEGORY_LABEL[a.category]}</span>
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${a.status === "PASSED" ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{STATUS_LABEL[a.status]}</span>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Practice"
        title="Personal activities"
        description="Things you choose to build or explore beyond the programme. They are assessed against a rubric and can go in your portfolio. They never replace a programme mission and do not earn XP."
      >
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New activity</Button>
      </PageHeader>

      {recommendations.length ? (
        <section aria-labelledby="rec-heading" className="panel p-5">
          <p id="rec-heading" className="mono-label flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> Recommended challenges</p>
          <p className="mt-1.5 text-xs text-muted-foreground">Optional extra practice drawn from your own assessments. Nothing here is required.</p>
          <ul className="mt-4 divide-y divide-border">
            {recommendations.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">Challenge: {r.missionTitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.reasonDetail}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: metaFor(r.departmentCode).color }}>{deptName(r.departmentCode)} · about {r.minutes} min</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={pending} onClick={() => accept(r.id)}>Accept</Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => dismiss(r.id)}>Dismiss</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activities.length === 0 ? (
        <EmptyState icon={Compass} title="No personal activities yet" hint="Create one for something you want to build, design or explore. Pick how it will be assessed and capture evidence as you go.">
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New activity</Button>
        </EmptyState>
      ) : (
        <>
          {active.length ? (
            <section aria-label="Active activities" className="space-y-3">
              <p className="mono-label">In progress · {active.length}</p>
              <ul className="space-y-3">{active.map((a) => <Card key={a.id} a={a} />)}</ul>
            </section>
          ) : null}
          {finished.length ? (
            <section aria-label="Finished activities" className="space-y-3">
              <p className="mono-label">Finished · {finished.length}</p>
              <ul className="space-y-3">{finished.map((a) => <Card key={a.id} a={a} />)}</ul>
            </section>
          ) : null}
        </>
      )}

      <Modal open={open} onOpenChange={setOpen} title="New personal activity" description="Define what you will do, what proof you will hand in, and how it will be assessed.">
        {open ? <ActivityForm departments={departments} skills={skills} onDone={(id) => { setOpen(false); router.push(`/activities/${id}`); }} /> : null}
      </Modal>
    </div>
  );
}
