"use client";

import { useActionState, useEffect, useState } from "react";
import { createMission } from "@/app/(app)/actions";
import { FormField } from "@/components/form-field";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EVIDENCE_TYPES, MISSION_KINDS } from "@/lib/programme";
import { MAX_CUSTOM_XP } from "@/lib/missions/schema";

type Dept = { code: string; name: string };

function Form({
  departments, defaultDepartment, today, onDone,
}: { departments: Dept[]; defaultDepartment?: string; today: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(createMission, undefined);
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState(defaultDepartment ?? "");

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="space-y-4">
      {state?.error ? (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </p>
      ) : null}

      <FormField label="What will you do">
        <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Build the login form" autoFocus required maxLength={120} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Department">
          <Select name="departmentCode" value={dept} onValueChange={setDept} required>
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
        <FormField label="Date">
          <Input type="date" name="date" defaultValue={today} required />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Kind">
          <Select name="kind" defaultValue="Build">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MISSION_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {kind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Evidence to capture">
          <Select name="evidenceType" defaultValue="Screenshot">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVIDENCE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Minutes">
          <Input type="number" name="minutes" min={5} max={480} step={5} defaultValue={45} />
        </FormField>
        <FormField label="XP reward">
          <Input type="number" name="xpReward" min={5} max={MAX_CUSTOM_XP} step={5} defaultValue={25} />
        </FormField>
      </div>

      <FormField label="Notes">
        <Textarea name="notes" rows={3} maxLength={500} placeholder="Constraints, links, what done looks like…" />
      </FormField>

      <Button type="submit" disabled={pending || !title.trim() || !dept} className="w-full">
        {pending ? "Saving…" : "Add mission"}
      </Button>
    </form>
  );
}

export function MissionForm({
  open, onOpenChange, departments, defaultDepartment, today,
}: {
  open: boolean; onOpenChange: (open: boolean) => void; departments: Dept[]; defaultDepartment?: string; today: string;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New mission"
      description="One practical, finishable action — with the evidence it should leave behind."
    >
      {/* Mounting the form only while open resets all fields each time. */}
      {open ? (
        <Form departments={departments} defaultDepartment={defaultDepartment} today={today} onDone={() => onOpenChange(false)} />
      ) : null}
    </Modal>
  );
}
