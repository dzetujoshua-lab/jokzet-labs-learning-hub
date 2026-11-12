"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSettingsAction } from "@/app/(app)/actions";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADVANCE_CHOICES } from "@/lib/schedule/constants";

export type SettingsValues = {
  enabled: boolean;
  reminderTime: string;
  timezone: string;
  advanceEnabled: boolean;
  advanceMinutes: number;
  inAppEnabled: boolean;
  browserEnabled: boolean;
  pushEnabled: boolean;
};

function Toggle({ id, label, hint, checked, onChange, disabled }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3.5 border-b border-border/60 py-3.5 last:border-0">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
      />
      <span>
        <span className="block text-sm text-foreground">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

export function ReminderSettingsForm({ initial, timezones, scheduleTime }: { initial: SettingsValues; timezones: string[]; scheduleTime: string }) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const save = () =>
    startTransition(async () => {
      const result = await saveSettingsAction({ ...values });
      if (result.ok) toast.success("Reminder settings saved");
      else toast.error(result.error);
    });

  return (
    <section className="panel p-5 md:p-6">
      <p className="mono-label">Reminders</p>
      <h2 className="mt-2 font-display text-lg font-medium text-foreground">Reminder settings</h2>

      <div className="mt-4">
        <Toggle id="enabled" label="Daily mission reminders" hint="Turn all reminders on or off." checked={values.enabled} onChange={(v) => set("enabled", v)} />
        <Toggle id="inapp" label="In-app reminders" hint="Shown inside the app. These always work, even without browser permission." checked={values.inAppEnabled} onChange={(v) => set("inAppEnabled", v)} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <FormField label={`Reminder time (blank = mission time ${scheduleTime})`}>
          <Input type="time" value={values.reminderTime} onChange={(e) => set("reminderTime", e.target.value)} />
        </FormField>
        <FormField label="Timezone">
          <select
            value={values.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="mt-2">
        <Toggle id="advance" label="Advance reminder" hint="Also remind me before the mission starts." checked={values.advanceEnabled} onChange={(v) => set("advanceEnabled", v)} />
        {values.advanceEnabled ? (
          <div className="pb-3 pl-[30px]">
            <FormField label="Minutes before">
              <select
                value={values.advanceMinutes}
                onChange={(e) => set("advanceMinutes", Number(e.target.value))}
                className="h-9 w-40 rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {ADVANCE_CHOICES.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        ) : null}
      </div>

      <Button onClick={save} disabled={pending} className="mt-3">
        {pending ? "Saving…" : "Save reminder settings"}
      </Button>
    </section>
  );
}
