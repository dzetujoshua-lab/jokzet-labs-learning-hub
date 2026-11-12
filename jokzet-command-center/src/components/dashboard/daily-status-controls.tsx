"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setDailyStatusAction } from "@/app/(app)/actions";

type Status = "SCHEDULED" | "STARTED" | "AWAITING_ASSESSMENT" | "COMPLETED" | "MISSED" | "SKIPPED";

const ACTIONS: { status: "STARTED" | "AWAITING_ASSESSMENT" | "COMPLETED"; label: string }[] = [
  { status: "STARTED", label: "Start" },
  { status: "AWAITING_ASSESSMENT", label: "Awaiting assessment" },
  { status: "COMPLETED", label: "Complete" },
];

/** Pill buttons in the same mono style as the Base44 scope pills. The server enforces ownership and due dates. */
export function DailyStatusControls({ id, status }: { id: string; status: Status }) {
  const [pending, startTransition] = useTransition();

  const set = (target: (typeof ACTIONS)[number]["status"]) =>
    startTransition(async () => {
      const result = await setDailyStatusAction(id, target);
      if (!result.ok) toast.error(result.error ?? "Could not update the mission");
    });

  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {ACTIONS.map(({ status: target, label }) => {
        const current = status === target;
        return (
          <button
            key={target}
            type="button"
            disabled={pending || current || status === "COMPLETED"}
            aria-pressed={current}
            onClick={() => set(target)}
            className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors disabled:cursor-default ${
              current ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
