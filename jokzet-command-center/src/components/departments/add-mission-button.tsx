"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MissionForm } from "@/components/missions/mission-form";

export function AddMissionButton({
  departments, defaultDepartment, today,
}: { departments: { code: string; name: string }[]; defaultDepartment: string; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
      <MissionForm open={open} onOpenChange={setOpen} departments={departments} defaultDepartment={defaultDepartment} today={today} />
    </>
  );
}
