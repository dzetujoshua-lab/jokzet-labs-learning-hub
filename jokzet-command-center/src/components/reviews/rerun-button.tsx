"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rerunAiAssessmentAction } from "@/app/(app)/review/actions";
import { Button } from "@/components/ui/button";

/** Administrators only (the action checks the role again): sends a stopped AI assessment back to the AI. */
export function RerunButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="text-right">
      <Button
        size="sm" variant="outline" disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await rerunAiAssessmentAction(jobId);
            if (!r.ok) return setError(r.error ?? "Could not re-run.");
            router.refresh();
          })
        }
      >
        {pending ? "Sending…" : "Re-run AI assessment"}
      </Button>
      {error ? <p role="alert" className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
