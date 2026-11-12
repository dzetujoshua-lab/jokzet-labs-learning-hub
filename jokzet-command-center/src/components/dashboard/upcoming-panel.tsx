import Link from "next/link";
import { fmtDate } from "@/lib/programme";
import type { DailyMissionView } from "@/lib/schedule/daily";

/** Same markup vocabulary as the Reminders rail (panel p-5, mono-label, dot list). */
export function UpcomingPanel({ items }: { items: DailyMissionView[] }) {
  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between">
        <p className="mono-label">Upcoming missions</p>
        <Link href="/reminders" className="font-mono text-[10px] text-muted-foreground hover:text-foreground">
          all
        </Link>
      </div>

      {items.length ? (
        <ul className="mt-4 space-y-3.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[13px] leading-snug text-foreground">{item.title}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {fmtDate(item.date)} · {item.time}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          No upcoming missions yet. Import your weekly schedule in Settings.
        </p>
      )}
    </section>
  );
}
