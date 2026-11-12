"use client";

import { useTransition } from "react";
import { markNotificationsReadAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";

export function MarkReadButton({ unread }: { unread: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="secondary" size="sm" disabled={pending || unread === 0} onClick={() => startTransition(() => markNotificationsReadAction())}>
      Mark all read{unread ? ` (${unread})` : ""}
    </Button>
  );
}
