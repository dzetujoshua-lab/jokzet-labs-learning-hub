import { fmtDate } from "@/lib/programme";
import type { Timetable } from "@/lib/plan/timetable-service";

/** What has happened to the plan, newest first (read-only: an audit trail, not a control). */
export function HistoryList({ history }: { history: Timetable["history"] }) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-border px-5 py-4"><p className="mono-label">Schedule history</p></div>
      {history.length ? (
        <ul>
          {history.map((h, k) => (
            <li key={`${h.at}-${k}`} className="flex items-start gap-3 border-b border-border/60 px-5 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-foreground">{h.title}</p>
                {h.detail ? <p className="text-xs text-muted-foreground">{h.detail}</p> : null}
                <p className="text-xs text-muted-foreground">{h.by === "You" ? "By you" : "Automatic"}{h.reason ? ` · ${h.reason}` : ""}</p>
              </div>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{fmtDate(h.at.slice(0, 10))}</span>
            </li>
          ))}
        </ul>
      ) : <p className="px-5 py-6 text-sm text-muted-foreground">Nothing has changed yet.</p>}
    </section>
  );
}
