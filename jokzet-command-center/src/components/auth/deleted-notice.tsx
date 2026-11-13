"use client";

import { useSearchParams } from "next/navigation";

/** Confirms a self-service deletion on the sign-in page. Must sit inside <Suspense>. */
export function DeletedNotice() {
  if (useSearchParams().get("deleted") !== "1") return null;
  return (
    <p role="status" className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
      Your account and its data have been deleted.
    </p>
  );
}
