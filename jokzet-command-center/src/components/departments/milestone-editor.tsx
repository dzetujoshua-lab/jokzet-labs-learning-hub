"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { updateMilestone } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MilestoneEditor({ departmentId, initial }: { departmentId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = value.trim() !== saved;

  const save = () =>
    startTransition(async () => {
      const result = await updateMilestone(departmentId, value);
      if (result.ok) {
        setSaved(value.trim());
        toast.success("Milestone saved");
      } else {
        toast.error(result.error ?? "Could not save the milestone");
      }
    });

  return (
    <div className="mt-5">
      <label htmlFor="milestone" className="mono-label block">
        Next milestone
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          id="milestone"
          value={value}
          maxLength={200}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What does the next level actually prove?"
          className="max-w-md"
        />
        <Button onClick={save} disabled={!dirty || pending} size="sm" className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
