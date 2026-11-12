"use client";

import { useRef, useState, useTransition } from "react";
import { FileJson, Upload } from "lucide-react";
import { toast } from "sonner";
import { confirmScheduleAction, previewScheduleAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import type { ImportPreview } from "@/lib/schedule/importer";
import { MAX_IMPORT_BYTES } from "@/lib/schedule/constants";

const STATUS_LABEL = {
  new: { text: "New schedule", cls: "border-primary/40 bg-primary/10 text-primary" },
  update: { text: "Update to existing schedule", cls: "border-border text-foreground" },
  unchanged: { text: "Already imported, no changes", cls: "border-border text-muted-foreground" },
} as const;

export function ScheduleImporter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setText("");
    setFileName("");
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setPreview({ ok: false, errors: ["The file is larger than 200 KB."] });
      return;
    }
    startTransition(async () => {
      const content = await file.text();
      setText(content);
      setFileName(file.name);
      setPreview(await previewScheduleAction(content));
    });
  };

  const confirm = () =>
    startTransition(async () => {
      const result = await confirmScheduleAction(text);
      if (!result.ok) {
        setPreview({ ok: false, errors: result.errors });
        return;
      }
      toast.success(
        result.status === "unchanged"
          ? "This schedule was already imported. Nothing changed."
          : `Schedule imported. ${result.instancesCreated} daily missions created.`,
      );
      reset();
    });

  return (
    <section className="panel p-5 md:p-6">
      <p className="mono-label">Import schedule</p>
      <h2 className="mt-2 font-display text-lg font-medium text-foreground">Weekly mission schedule</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Upload the JOKZET Labs schedule file (JSON). You will see every weekly mission before anything is saved.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id="schedule-file"
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button asChild variant="secondary" size="sm" className="cursor-pointer gap-1.5">
          <label htmlFor="schedule-file">
            <Upload className="h-3.5 w-3.5" /> Choose JSON file
          </label>
        </Button>
        {fileName ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <FileJson className="h-3 w-3" /> {fileName}
          </span>
        ) : null}
      </div>

      {preview && !preview.ok ? (
        <div role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">This file cannot be imported:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-destructive">
            {preview.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview?.ok ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-display text-base font-medium text-foreground">{preview.package.name}</span>
            <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${STATUS_LABEL[preview.status].cls}`}>
              {STATUS_LABEL[preview.status].text}
            </span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Starts {preview.schedule.startDate} · {preview.schedule.timezone} · reminder {preview.schedule.defaultStartTime} ·{" "}
            {preview.notification.minutesBefore ? `${preview.notification.minutesBefore} min before` : "at start"}
          </p>

          <ul className="overflow-hidden rounded-2xl border border-border">
            {preview.missions.map((m) => (
              <li key={m.key} className="border-b border-border/60 px-4 py-3.5 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-foreground">
                    <span className="mr-2.5 inline-block w-24 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{m.dayLabel}</span>
                    {m.title}
                  </p>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {m.startTime} · {m.durationMinutes} min
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{m.objective}</p>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{m.stages.join(" → ")}</p>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={confirm} disabled={pending || preview.status === "unchanged"}>
              {pending ? "Importing…" : preview.status === "update" ? "Confirm update" : "Confirm import"}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={pending}>
              Cancel
            </Button>
            {preview.status === "unchanged" ? (
              <span className="text-xs text-muted-foreground">Importing again would create nothing new.</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
