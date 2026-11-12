"use client";

import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState icon={AlertTriangle} title="Something went wrong" hint={error.digest ? `Reference: ${error.digest}` : "This section failed to load. Your data has not been changed."}>
      <button type="button" onClick={reset} className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
        try again
      </button>
    </EmptyState>
  );
}
