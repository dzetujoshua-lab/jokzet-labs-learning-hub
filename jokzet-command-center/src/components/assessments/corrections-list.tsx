"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { resolveCorrectionAction } from "@/app/(app)/actions";

export type CorrectionView = { id: string; body: string; resolved: boolean };

/** Corrections generated from weak rubric criteria. The learner ticks each one off once it has been addressed. */
export function CorrectionsList({ items }: { items: CorrectionView[] }) {
  const [pending, startTransition] = useTransition();
  if (!items.length) return null;
  return (
    <ul className="mt-3 space-y-2.5">
      {items.map((c) => (
        <li key={c.id} className="flex items-start gap-3">
          <button
            type="button"
            disabled={pending}
            aria-pressed={c.resolved}
            aria-label={c.resolved ? "Mark correction as not done" : "Mark correction as done"}
            onClick={() => startTransition(() => resolveCorrectionAction(c.id, !c.resolved))}
            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
              c.resolved ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent hover:border-primary hover:text-primary"
            }`}
          >
            <Check className="h-3 w-3" strokeWidth={2.6} />
          </button>
          <p className={`text-[13px] leading-snug ${c.resolved ? "text-muted-foreground line-through" : "text-foreground"}`}>{c.body}</p>
        </li>
      ))}
    </ul>
  );
}
