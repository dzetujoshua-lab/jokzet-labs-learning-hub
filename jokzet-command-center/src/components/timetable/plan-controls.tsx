"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buildPlanAction, pausePlanAction, resumePlanAction } from "@/app/(app)/timetable/actions";
import { Button } from "@/components/ui/button";

/** Pause or resume the plan (or build one that is missing). The server re-checks everything; this only calls it. */
export function PlanControls({ mode, autoReschedule }: { mode: "ACTIVE" | "PAUSED" | "NONE"; autoReschedule?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setError("");
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      toast.success(done);
      router.refresh();
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      {mode === "ACTIVE" ? <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(pausePlanAction, "Plan paused")}>Pause plan</Button> : null}
      {mode === "PAUSED" ? <Button size="sm" disabled={pending} onClick={() => run(resumePlanAction, "Plan resumed")}>Resume plan</Button> : null}
      {mode === "NONE" ? <Button size="sm" disabled={pending} onClick={() => run(buildPlanAction, "Plan built")}>{pending ? "Building…" : "Build my plan"}</Button> : null}
      {autoReschedule !== undefined ? <span className="text-xs text-muted-foreground">Automatic rescheduling is {autoReschedule ? "on" : "off"}.</span> : null}
      {error ? <p role="alert" className="w-full text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
