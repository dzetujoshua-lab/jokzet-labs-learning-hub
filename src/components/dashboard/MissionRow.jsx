import { Check, Clock, Paperclip, Trash2 } from 'lucide-react';
import DeptGlyph from './DeptGlyph';
import { metaFor } from '@/lib/programme';

export default function MissionRow({ mission, deptName, onToggle, onDelete }) {
  const done = mission.status === 'done';
  const meta = metaFor(mission.department_code);

  return (
    <li className="group flex items-start gap-3.5 border-b border-border/60 px-5 py-4 last:border-0">
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={done ? 'Mark mission as planned' : 'Mark mission as done'}
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
            done
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-transparent hover:border-primary hover:text-primary'
          }`}
        >
          <Check className="h-3 w-3" strokeWidth={2.6} />
        </button>
      ) : (
        <span
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
            done ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'
          }`}
        >
          <Check className="h-3 w-3" strokeWidth={2.6} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
          {mission.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5" style={{ color: meta.color }}>
            <DeptGlyph icon={meta.icon} className="h-3 w-3" />
            {deptName || mission.department_code}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" strokeWidth={1.8} />
            {mission.minutes || 45}m
          </span>
          <span className="inline-flex items-center gap-1">
            <Paperclip className="h-3 w-3" strokeWidth={1.8} />
            {mission.evidence_type || 'Evidence'}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {mission.kind || 'Task'}
        </span>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete mission"
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
          </button>
        ) : null}
      </div>
    </li>
  );
}