import Link from "next/link";
import { Check, Clock, Paperclip, Trash2 } from "lucide-react";
import { removeMission, toggleMission } from "@/app/(app)/actions";
import { metaFor } from "@/lib/programme";
import type { MissionView } from "@/lib/missions/service";
import { DeptGlyph } from "./dept-glyph";

/** Class names are copied from the Base44 MissionRow. Toggle/delete are server-action forms (work without client JS). */
export function MissionRow({
  mission,
  deptName,
  canToggle = false,
  canDelete = false,
}: {
  mission: MissionView;
  deptName?: string;
  canToggle?: boolean;
  canDelete?: boolean;
}) {
  const done = mission.status === "done";
  const meta = metaFor(mission.departmentCode);
  const titleClass = `text-sm leading-snug ${done ? "text-muted-foreground line-through" : "text-foreground"}`;

  return (
    <li className="group flex items-start gap-3.5 border-b border-border/60 px-5 py-4 last:border-0">
      {canToggle ? (
        <form action={toggleMission.bind(null, mission.id, !done)}>
          <button
            type="submit"
            aria-label={done ? "Mark mission as planned" : "Mark mission as done"}
            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
              done
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-transparent hover:border-primary hover:text-primary"
            }`}
          >
            <Check className="h-3 w-3" strokeWidth={2.6} />
          </button>
        </form>
      ) : (
        <span
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
            done ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent"
          }`}
        >
          <Check className="h-3 w-3" strokeWidth={2.6} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {mission.code ? (
          <Link href={`/missions/${mission.code}`} className={`block ${titleClass} hover:text-primary`}>
            {mission.title}
          </Link>
        ) : (
          <p className={titleClass}>{mission.title}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5" style={{ color: meta.color }}>
            <DeptGlyph icon={meta.icon} className="h-3 w-3" />
            {deptName || mission.departmentCode}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" strokeWidth={1.8} />
            {mission.minutes || 45}m
          </span>
          <span className="inline-flex items-center gap-1">
            <Paperclip className="h-3 w-3" strokeWidth={1.8} />
            {mission.evidenceType || "Evidence"}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {mission.kind || "Task"}
        </span>
        {canDelete ? (
          <form action={removeMission.bind(null, mission.id)}>
            <button
              type="submit"
              aria-label="Delete mission"
              className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}
