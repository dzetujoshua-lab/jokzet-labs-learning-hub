"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, GitBranch, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addFromMissionAction, deletePieceAction, moveCapstoneAction, saveCapstoneAction, savePieceAction,
} from "@/app/(app)/actions";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CapstoneView, PieceView, Suggestion } from "@/lib/portfolio/service";
import { fmtDate, metaFor } from "@/lib/programme";

type Dept = { code: string; name: string };
type Cover = { id: string; title: string };
type SkillGroup = { departmentCode: string; skills: string[] };

// Classes copied from the Base44 Portfolio page (STATUS_CLASS).
const STATUS_CLASS = {
  shipped: "border-primary/50 bg-primary/10 text-primary",
  building: "border-chart-7/50 bg-chart-7/10 text-chart-7",
  concept: "border-border text-muted-foreground",
} as const;

const NONE = "none";

function Alert({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {message}
    </p>
  ) : null;
}

function PieceForm({
  piece, departments, covers, onDone,
}: { piece: PieceView | null; departments: Dept[]; covers: Cover[]; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(piece?.title ?? "");
  const [dept, setDept] = useState(piece?.departmentCode ?? NONE);
  const [status, setStatus] = useState<string>(piece?.status ?? "concept");
  const [cover, setCover] = useState(piece?.coverEvidenceId ?? NONE);

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const result = await savePieceAction(piece?.id ?? null, {
        title,
        departmentCode: dept === NONE ? "" : dept,
        status: status as "concept" | "building" | "shipped",
        summary: String(formData.get("summary") ?? ""),
        tools: String(formData.get("tools") ?? ""),
        repoUrl: String(formData.get("repoUrl") ?? ""),
        liveUrl: String(formData.get("liveUrl") ?? ""),
        coverEvidenceId: cover === NONE ? "" : cover,
      });
      if (result.ok) {
        toast.success(piece ? "Piece updated" : "Piece added");
        onDone();
      } else setError(result.error ?? "Could not save.");
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <Alert message={error} />
      <FormField label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Invoice dashboard" autoFocus required maxLength={120} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Lead department">
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {departments.map((d) => <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="concept">Concept</SelectItem>
              <SelectItem value="building">Building</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="Summary">
        <Textarea name="summary" rows={3} maxLength={2000} defaultValue={piece?.summary ?? ""} placeholder="What it is, who it is for, what you shipped." />
      </FormField>
      <FormField label="Tools">
        <Input name="tools" defaultValue={piece?.tools.join(" · ") ?? ""} placeholder="React · Figma · Postgres" maxLength={300} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Repository link">
          <Input name="repoUrl" type="url" defaultValue={piece?.repoUrl ?? ""} placeholder="https://github.com/…" maxLength={500} />
        </FormField>
        <FormField label="Live link">
          <Input name="liveUrl" type="url" defaultValue={piece?.liveUrl ?? ""} placeholder="https://…" maxLength={500} />
        </FormField>
      </div>
      <FormField label="Cover image (from your evidence vault)">
        <Select value={cover} onValueChange={setCover}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No cover</SelectItem>
            {covers.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        {covers.length === 0 ? <p className="mt-1.5 text-[11px] text-muted-foreground">Upload a screenshot to the Evidence vault and it will be available here.</p> : null}
      </FormField>
      <Button type="submit" disabled={pending || !title.trim()} className="w-full">{pending ? "Saving…" : piece ? "Save changes" : "Add piece"}</Button>
    </form>
  );
}

function CapstoneForm({ capstone, onDone }: { capstone: CapstoneView | null; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(capstone?.title ?? "BusinessOS Ghana");

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const result = await saveCapstoneAction({
        title,
        summary: String(formData.get("summary") ?? ""),
        tools: String(formData.get("tools") ?? ""),
        stages: Number(formData.get("stages") ?? 8),
        repoUrl: String(formData.get("repoUrl") ?? ""),
        liveUrl: String(formData.get("liveUrl") ?? ""),
      });
      if (result.ok) {
        toast.success("Capstone saved");
        onDone();
      } else setError(result.error ?? "Could not save.");
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <Alert message={error} />
      <FormField label="Capstone name">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} autoFocus />
      </FormField>
      <FormField label="Summary">
        <Textarea name="summary" rows={3} maxLength={2000} defaultValue={capstone?.summary ?? ""} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Tools"><Input name="tools" defaultValue={capstone?.tools.join(" · ") ?? ""} maxLength={300} /></FormField>
        <FormField label="Stages"><Input name="stages" type="number" min={1} max={12} defaultValue={capstone?.stages ?? 8} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Repository link"><Input name="repoUrl" type="url" defaultValue={capstone?.repoUrl ?? ""} maxLength={500} /></FormField>
        <FormField label="Live link"><Input name="liveUrl" type="url" defaultValue={capstone?.liveUrl ?? ""} maxLength={500} /></FormField>
      </div>
      <Button type="submit" disabled={pending || !title.trim()} className="w-full">{pending ? "Saving…" : "Save capstone"}</Button>
    </form>
  );
}

function Pill({ href, icon: Icon, children, label }: { href: string; icon: typeof GitBranch; children: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-secondary-foreground transition-colors hover:border-primary/50 hover:text-primary"
    >
      <Icon className="h-3 w-3" /> {children}
    </a>
  );
}

export function PortfolioView({
  pieces, capstone, suggestions, skills, departments, covers,
}: { pieces: PieceView[]; capstone: CapstoneView | null; suggestions: Suggestion[]; skills: SkillGroup[]; departments: Dept[]; covers: Cover[] }) {
  const [editing, setEditing] = useState<PieceView | "new" | null>(null);
  const [capstoneOpen, setCapstoneOpen] = useState(false);
  const [pending, start] = useTransition();
  const deptName = (code: string | null) => departments.find((d) => d.code === code)?.name ?? "";

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    start(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error ?? "That did not work.");
      else if (success) toast.success(success);
    });
  }

  const stages = capstone ? capstone.stages : 0;
  const stage = capstone ? Math.min(capstone.stage, stages) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolio"
        title="Work that shows the level"
        description="The capstone ties every department together; the pieces beside it are the proof along the way."
      >
        <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New piece</Button>
      </PageHeader>

      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-32 h-64 opacity-[0.12] blur-3xl"
          style={{ background: "linear-gradient(90deg, hsl(var(--chart-1)), hsl(var(--chart-4)), transparent)" }}
        />
        <div className="relative">
          <p className="mono-label">Main software integration capstone</p>
          {capstone ? (
            <>
              <div className="mt-2.5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">{capstone.title}</h2>
                  {capstone.summary ? <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{capstone.summary}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {capstone.liveUrl ? <Pill href={capstone.liveUrl} icon={ExternalLink} label="Open the live capstone">open</Pill> : null}
                  {capstone.repoUrl ? <Pill href={capstone.repoUrl} icon={GitBranch} label="Open the capstone repository">repo</Pill> : null}
                  <button
                    type="button"
                    onClick={() => setCapstoneOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-secondary-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <Pencil className="h-3 w-3" /> edit
                  </button>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-1.5" role="img" aria-label={`Stage ${stage} of ${stages}`}>
                {Array.from({ length: stages }).map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i < stage ? "bg-primary" : "bg-secondary"}`} />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  stage {stage} of {stages}{capstone.tools.length ? ` · ${capstone.tools.join(" · ")}` : ""}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pending || stage === 0} onClick={() => run(() => moveCapstoneAction(-1))}><ArrowLeft className="h-3.5 w-3.5" /> back</Button>
                  <Button size="sm" disabled={pending || stage >= stages} onClick={() => run(() => moveCapstoneAction(1))}>advance <ArrowRight className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-2.5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                Name your capstone — BusinessOS Ghana — and track its build stages here as the integration of every department.
              </p>
              <Button variant="outline" onClick={() => setCapstoneOpen(true)}><Layers className="h-4 w-4" /> Set up capstone</Button>
            </div>
          )}
        </div>
      </section>

      {suggestions.length ? (
        <section aria-labelledby="ready-heading" className="panel p-5">
          <p id="ready-heading" className="mono-label">Ready to showcase</p>
          <p className="mt-1.5 text-xs text-muted-foreground">Missions you have passed that are not in the portfolio yet.</p>
          <ul className="mt-4 divide-y divide-border">
            {suggestions.map((s) => (
              <li key={s.missionCode} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{s.title}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: metaFor(s.departmentCode).color }}>
                    {deptName(s.departmentCode)}{s.percentage !== null ? ` · ${s.percentage}%` : ""}
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => addFromMissionAction(s.missionCode), "Added to portfolio")}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pieces.length === 0 ? (
        <EmptyState icon={Layers} title="No pieces yet" hint="Add the projects you're building — even the rough ones belong here.">
          <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New piece</Button>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pieces.map((p) => (
            <article key={p.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
              {p.coverEvidenceId ? (
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element -- authenticated stream, not an optimisable static asset */}
                  <img src={`/api/evidence/${p.coverEvidenceId}/file`} alt={`${p.title} cover`} loading="lazy" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="grid aspect-[16/10] w-full place-items-center bg-secondary/60">
                  <Layers className="h-6 w-6 text-muted-foreground" strokeWidth={1.4} />
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: p.departmentCode ? metaFor(p.departmentCode).color : undefined }}>
                    {deptName(p.departmentCode) || "Independent"}
                  </p>
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${STATUS_CLASS[p.status]}`}>{p.status}</span>
                </div>
                <h3 className="mt-2 font-display text-base font-medium text-foreground">{p.title}</h3>
                {p.summary ? <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{p.summary}</p> : null}
                {p.tools.length ? <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{p.tools.join(" · ")}</p> : null}
                {p.assessment ? (
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-primary">Assessed {p.assessment.percentage}% · attempt {p.assessment.attempt}</p>
                ) : null}
                {p.completedDate ? <p className="mt-1 text-[11px] text-muted-foreground">Shipped {fmtDate(p.completedDate)}</p> : null}
                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                  <div className="flex gap-1">
                    <button type="button" aria-label={`Edit ${p.title}`} onClick={() => setEditing(p)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${p.title}`}
                      disabled={pending}
                      onClick={() => { if (window.confirm(`Remove “${p.title}” from your portfolio?`)) run(() => deletePieceAction(p.id), "Piece removed"); }}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {p.repoUrl ? <Pill href={p.repoUrl} icon={GitBranch} label={`Repository for ${p.title}`}>repo</Pill> : null}
                    {p.liveUrl ? <Pill href={p.liveUrl} icon={ExternalLink} label={`Open ${p.title}`}>open</Pill> : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {skills.length ? (
        <section aria-labelledby="skills-heading" className="panel p-5">
          <p id="skills-heading" className="mono-label">Skills gained</p>
          <div className="mt-4 space-y-4">
            {skills.map((g) => (
              <div key={g.departmentCode}>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: metaFor(g.departmentCode).color }}>{deptName(g.departmentCode)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.skills.map((s) => <span key={s} className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">{s}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Modal
        open={editing !== null}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
        title={editing === "new" ? "New portfolio piece" : "Edit portfolio piece"}
        description="Real work, shown the way a client or employer would see it."
      >
        {editing !== null ? (
          <PieceForm piece={editing === "new" ? null : editing} departments={departments} covers={covers} onDone={() => setEditing(null)} />
        ) : null}
      </Modal>
      <Modal open={capstoneOpen} onOpenChange={setCapstoneOpen} title={capstone ? "Edit capstone" : "Set up capstone"} description="The integration project that ties every department together.">
        {capstoneOpen ? <CapstoneForm capstone={capstone} onDone={() => setCapstoneOpen(false)} /> : null}
      </Modal>
    </div>
  );
}
