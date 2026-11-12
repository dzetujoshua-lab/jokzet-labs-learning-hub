import type { Metadata } from "next";
import { BrowserNotifications } from "@/components/settings/browser-notifications";
import { ReminderSettingsForm } from "@/components/settings/reminder-settings-form";
import { ScheduleImporter } from "@/components/settings/schedule-importer";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { getPushConfig } from "@/lib/notifications/push";
import { getActiveSchedule, getSettings } from "@/lib/schedule/daily";
import { DAY_LABELS, DEFAULT_TIMEZONE } from "@/lib/schedule/time";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, schedule, subscriptionCount] = await Promise.all([
    getSettings(user.id),
    getActiveSchedule(user.id),
    db.pushSubscription.count({ where: { userId: user.id } }),
  ]);
  const push = getPushConfig();

  const zones = new Set<string>(Intl.supportedValuesOf("timeZone"));
  const current = settings?.timezone ?? schedule?.timezone ?? DEFAULT_TIMEZONE;
  zones.add(current);
  zones.add(DEFAULT_TIMEZONE);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Schedule and reminders"
        description="Import your weekly mission schedule, choose when reminders fire and how they reach you."
      />

      {schedule ? (
        <section className="panel p-5 md:p-6">
          <p className="mono-label">Active schedule</p>
          <h2 className="mt-2 font-display text-lg font-medium text-foreground">{schedule.name}</h2>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Starts {schedule.startDate.toISOString().slice(0, 10)} · {schedule.timezone} · {schedule.templates.length} weekly missions
          </p>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] text-muted-foreground sm:grid-cols-2">
            {[...schedule.templates]
              .sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7))
              .map((t) => (
                <li key={t.id}>
                  <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.14em]">{DAY_LABELS[t.dayOfWeek].slice(0, 3)}</span>
                  <span className="text-foreground">{t.title}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <ScheduleImporter />

      {settings ? (
        <>
          <ReminderSettingsForm
            initial={{
              enabled: settings.enabled,
              reminderTime: settings.reminderTime ?? "",
              timezone: settings.timezone,
              advanceEnabled: settings.advanceEnabled,
              advanceMinutes: settings.advanceMinutes,
              inAppEnabled: settings.inAppEnabled,
              browserEnabled: settings.browserEnabled,
              pushEnabled: settings.pushEnabled,
            }}
            timezones={[...zones].sort()}
            scheduleTime={schedule?.defaultStartTime ?? "12:00"}
          />
          <BrowserNotifications
            browserEnabled={settings.browserEnabled}
            pushConfigured={push.configured}
            publicKey={push.publicKey}
            subscriptionCount={subscriptionCount}
          />
        </>
      ) : (
        <section className="panel p-5 md:p-6">
          <p className="text-sm text-muted-foreground">Import a schedule first. Reminder settings appear once a schedule exists.</p>
        </section>
      )}
    </div>
  );
}
