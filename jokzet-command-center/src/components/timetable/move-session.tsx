"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { moveSessionAction } from "@/app/(app)/timetable/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export type Option = { date: string; slotIndex: number; time: string; label: string };

/** Move one upcoming session to a free slot the server has already checked. The server checks again when you confirm. */
export function MoveSession({ itemId, title, current, options }: { itemId: string; title: string; current: string; options: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<Option | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!pick) return setError("Pick a slot first.");
    setError("");
    startTransition(async () => {
      const r = await moveSessionAction(itemId, pick.date, pick.slotIndex, reason);
      if (!r.ok) return setError(r.error ?? "Could not move this session.");
      toast.success("Session moved");
      setOpen(false);
      setPick(null);
      setReason("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">Move</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move this session</DialogTitle>
          <DialogDescription>{title} · {current}</DialogDescription>
        </DialogHeader>
        {options.length ? (
          <div className="space-y-4">
            <div>
              <p className="mono-label">Pick a free slot</p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Free slots">
                {options.map((o) => {
                  const on = pick?.date === o.date && pick.slotIndex === o.slotIndex;
                  return (
                    <button key={`${o.date}#${o.slotIndex}`} type="button" role="radio" aria-checked={on} onClick={() => setPick(o)}
                      className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${on ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                      {o.label} · {o.time}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label htmlFor="move-reason" className="mono-label">Reason (optional)</label>
              <Textarea id="move-reason" rows={2} maxLength={200} className="mt-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why you are moving it" />
            </div>
            <p className="text-xs text-muted-foreground">Only free study slots are shown. The original time stays in your schedule history.</p>
            {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button size="sm" disabled={pending} onClick={submit}>{pending ? "Moving…" : "Move session"}</Button>
              <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">There is no free slot left in your plan for this session. You can extend the plan or change your study days in timetable settings.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
