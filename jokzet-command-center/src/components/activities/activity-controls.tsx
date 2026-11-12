"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { attachRubricTemplateAction, deleteActivityAction, startActivityAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RUBRIC_TEMPLATES } from "@/lib/activities/rubric-templates";

/** Start, choose-a-rubric and delete controls for one activity. Each reports server refusals instead of failing silently. */
export function ActivityControls({
  learnerMissionId, canStart, needsRubric, canDelete,
}: { learnerMissionId: string; canStart: boolean; needsRubric: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [template, setTemplate] = useState("build");

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    start(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        after?.();
      } else toast.error(result.error ?? "That did not work.");
    });

  return (
    <div className="mt-5 flex flex-wrap items-end gap-3">
      {canStart ? <Button onClick={() => run(() => startActivityAction(learnerMissionId), "Activity started")} disabled={pending}>Start activity</Button> : null}
      {needsRubric ? (
        <div className="flex items-end gap-2">
          <div>
            <p className="mono-label mb-1.5">Choose how it will be assessed</p>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>{RUBRIC_TEMPLATES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button variant="secondary" disabled={pending} onClick={() => run(() => attachRubricTemplateAction(learnerMissionId, template), "Rubric added")}>Add rubric</Button>
        </div>
      ) : null}
      {canDelete ? (
        <Button
          variant="outline" disabled={pending}
          onClick={() => { if (window.confirm("Delete this activity? This cannot be undone.")) run(() => deleteActivityAction(learnerMissionId), "Activity deleted", () => router.push("/activities")); }}
        >Delete</Button>
      ) : null}
    </div>
  );
}
