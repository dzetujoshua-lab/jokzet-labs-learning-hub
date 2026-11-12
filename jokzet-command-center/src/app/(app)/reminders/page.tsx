import type { Metadata } from "next";
import Link from "next/link";
import { BellOff, CalendarCheck } from "lucide-react";
import { DailyMissionRow } from "@/components/dashboard/daily-mission-row";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { MarkReadButton } from "@/components/reminders/mark-read-button";
import { requireUser } from "@/lib/auth/dal";
import { listHistory as listNotifications } from "@/lib/notifications/engine";
import { generateInstances, listHistory, listMissed, listUpcoming, reconcileMissed } from "@/lib/schedule/daily";

export const metadata: Metadata = { title: "Reminders" };

const DELIVERY_TONE = {
  DELIVERED: "border-primary/50 bg-primary/10 text-primary",
  PENDING: "border-border text-muted-foreground",
  SKIPPED: "border-border text-muted-foreground",
  FAILED: "border-destructive/50 bg-destructive/10 text-destructive",
} as const;

const CHANNEL_LABEL = { IN_APP: "in-app", BROWSER: "browser", PUSH: "push" } as const;

export default async function RemindersPage() {
  const user = await requireUser();
  await generateInstances(user.id);
  await reconcileMissed(user.id);
  const [upcoming, missed, notifications, completions] = await Promise.all([
    listUpcoming(user.id, new Date(), 7),
    listMissed(user.id),
    listNotifications(user.id),
    listHistory(user.id),
  ]);
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reminders"
        title="Reminders and history"
        description="Upcoming missions, missed missions to review, and every notification with its delivery status."
      >
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          reminder settings
        </Link>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <p className="mono-label">Upcoming · {upcoming.length}</p>
          </div>
          {upcoming.length ? (
            <ul>
              {upcoming.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3.5 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-foreground">{m.title}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{m.date} · reminder {m.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <EmptyState icon={CalendarCheck} title="No upcoming missions" hint="Import your weekly schedule in Settings to generate daily missions." />
            </div>
          )}
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <p className="mono-label">Missed missions · {missed.length}</p>
          </div>
          {missed.length ? (
            <ul>
              {missed.map((m) => (
                <DailyMissionRow key={m.id} mission={m} showDate />
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-xs text-muted-foreground">Nothing missed. Missions you do not finish by the end of the day appear here for review.</p>
          )}
        </section>
      </div>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <p className="mono-label">Notification history · {notifications.length}</p>
          <MarkReadButton unread={unread} />
        </div>
        {notifications.length ? (
          <ul>
            {notifications.map((n) => (
              <li key={n.id} className="border-b border-border/60 px-5 py-4 last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm leading-snug ${n.readAt ? "text-muted-foreground" : "text-foreground"}`}>{n.title}</p>
                    {n.body ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{n.body}</p> : null}
                    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {n.kind.toLowerCase()} · {new Date(n.createdAt).toISOString().slice(0, 16).replace("T", " ")} UTC
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {n.deliveries.map((d) => (
                      <span
                        key={d.channel}
                        title={d.error ?? undefined}
                        className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${DELIVERY_TONE[d.status]}`}
                      >
                        {CHANNEL_LABEL[d.channel]} · {d.status.toLowerCase()}
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState icon={BellOff} title="No notifications yet" hint="Due-time reminders and test notifications will be listed here with their delivery status." />
          </div>
        )}
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <p className="mono-label">Mission history · {completions.length}</p>
        </div>
        {completions.length ? (
          <ul>
            {completions.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3 last:border-0">
                <p className="min-w-0 truncate text-[13px] text-foreground">
                  {c.title} <span className="text-muted-foreground">· {c.date}</span>
                </p>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {c.from.toLowerCase().replace("_", " ")} → {c.to.toLowerCase().replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-xs text-muted-foreground">Status changes you make to daily missions are recorded here.</p>
        )}
      </section>
    </div>
  );
}
