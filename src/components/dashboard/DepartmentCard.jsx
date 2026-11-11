import { Link } from 'react-router-dom';
import DeptGlyph from './DeptGlyph';
import { levelProgress, metaFor } from '@/lib/programme';

export default function DepartmentCard({ dept }) {
  const meta = metaFor(dept.code);
  const { level, inLevel, target, pct } = levelProgress(dept.xp || 0);

  return (
    <Link
      to={`/departments/${dept.id}`}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-colors duration-300 hover:border-foreground/25"
    >
      <div className="flex items-start justify-between">
        <span
          className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-secondary"
          style={{ color: meta.color }}
        >
          <DeptGlyph icon={meta.icon} />
        </span>
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">LV {level}</span>
      </div>

      <h3 className="mt-4 font-display text-[15px] font-medium leading-snug text-foreground">{dept.name}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {dept.next_milestone || 'Set the next milestone for this department'}
      </p>

      <div className="mt-4 flex items-center gap-2.5">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: meta.color }} />
        </div>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {inLevel}/{target}
        </span>
      </div>
    </Link>
  );
}