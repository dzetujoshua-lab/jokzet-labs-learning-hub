"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EVIDENCE_TYPES } from "@/lib/programme";

type Dept = { code: string; name: string };

function Form({
  departments, defaultDepartment, missionCode, attachToLearnerMissionId, today, onDone,
}: {
  departments: Dept[]; defaultDepartment?: string; missionCode?: string; attachToLearnerMissionId?: string; today: string; onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState(defaultDepartment ?? "");
  const [kind, setKind] = useState("Screenshot");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const body = new FormData(event.currentTarget);
    body.set("departmentCode", dept);
    body.set("kind", kind);
    if (missionCode) body.set("missionCode", missionCode);
    if (attachToLearnerMissionId) body.set("attachToLearnerMissionId", attachToLearnerMissionId);
    startTransition(async () => {
      try {
        const response = await fetch("/api/evidence", { method: "POST", body });
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) return setError(result?.error ?? "Could not save this evidence.");
        toast.success("Evidence saved");
        router.refresh();
        onDone();
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormField label="What does this prove">
        <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Login form shipped and responsive" autoFocus required maxLength={120} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Department">
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger>
              <SelectValue placeholder="Pick one" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.code} value={d.code}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Type">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVIDENCE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <FormField label="Date">
        <Input type="date" name="capturedDate" defaultValue={today} required />
      </FormField>

      <FormField label="File (stored privately)">
        <input
          type="file"
          name="file"
          accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.mp4,.webm,.mov,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.md,.txt,.sh,.sql,.java,.c,.cpp,.h,.go,.rs,.php,.rb,.yml,.yaml,.toml,.xml,.ini,.log,.csv,.conf"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.12em] file:text-foreground"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">Images 10 MB, PDF 20 MB, video 50 MB, code and text 1 MB. Never include passwords, keys or tokens.</p>
      </FormField>

      <FormField label="Or a link">
        <Input name="linkUrl" type="url" inputMode="url" placeholder="https://github.com/…" maxLength={500} />
      </FormField>

      <FormField label="Notes">
        <Textarea name="description" rows={2} maxLength={2000} placeholder="What to look at, and why it matters" />
      </FormField>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || !title.trim() || !dept} className="w-full">
        {pending ? "Uploading…" : "Log evidence"}
      </Button>
    </form>
  );
}

export function EvidenceForm({
  open, onOpenChange, departments, defaultDepartment, missionCode, attachToLearnerMissionId, today,
}: {
  open: boolean; onOpenChange: (open: boolean) => void; departments: Dept[]; defaultDepartment?: string;
  missionCode?: string; attachToLearnerMissionId?: string; today: string;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Log evidence"
      description="Attach the proof: a screenshot, photo, code file, document, or a link to the work."
    >
      {open ? (
        <Form
          departments={departments}
          defaultDepartment={defaultDepartment}
          missionCode={missionCode}
          attachToLearnerMissionId={attachToLearnerMissionId}
          today={today}
          onDone={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}
