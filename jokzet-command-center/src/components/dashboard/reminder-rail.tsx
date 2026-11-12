import Link from "next/link";
import { fmtDate, isPast, todayISO } from "@/lib/programme";

export type ReminderView = { id: string; title: string; date: string; status: "open" | "done" | "snoozed" };

const TONE = { overdue: "bg-destructive", today: "bg-primary", later: "bg-muted-foreground" } as const;

const toneFor = (due: string) => (isPast(due) ? "overdue" : due === todayISO() ? "today" : "later");

export function ReminderRail({ reminders }: { reminders: ReminderView[] }) {
  const openAll = reminders.filter((r) => r.status === "open");
  const open = openAll.slice(0, 5);

  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between">
        <p className="mono-label">Reminders</p>
        <Link href="/reminders" className="font-mono text-[10px] text-muted-foreground hover:text-foreground">
          {openAll.length} open
        </Link>
      </div>

      {open.length ? (
        <ul className="mt-4 space-y-3.5">
          {open.map((reminder) => {
            const tone = toneFor(reminder.date);
            return (
              <li key={reminder.id} className="flex items-start gap-3">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE[tone]}`} />
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug text-foreground">{reminder.title}</p>
                  <p
                    className={`mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                      tone === "overdue" ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {fmtDate(reminder.date)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Nothing scheduled. Add a reminder so deadlines don&apos;t rely on memory.
        </p>
      )}
    </section>
  );
}
