import { Flame, FolderOpen, ClipboardCheck } from 'lucide-react';

export default function LevelBand({ level, xp, xpTarget, streak, evidenceCount, assessmentsPassed }) {
  const pct = Math.min(100, Math.round((xp / xpTarget) * 100));

  return (
    <section className="panel animate-rise grid gap-7 p-6 md:grid-cols-[auto_1fr_auto] md:items-center md:p-7">
      <div className="flex items-end gap-5">
        <div>
          <p className="mono-label">Programme level</p>
          <p className="mt-2 font-display text-[68px] font-light leading-[0.8] tabular-nums text-foreground">{level}</p>
        </div>
        <div className="pb-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {level} → {level + 1}
          </p>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-foreground">
            {xp} / {xpTarget} XP
          </p>
        </div>
      </div>

      <div className="min-w-0 md:px-2">
        <div className="flex items-center justify-between">
          <p className="mono-label">Progress to next level</p>
          <p className="font-mono text-[11px] tabular-nums text-primary">{pct}%</p>
        </div>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {xpTarget - xp} XP remaining
        </p>
      </div>

      <div className="flex items-center gap-6 md:gap-7">
        <Stat icon={Flame} value={streak} label="day streak" />
        <Stat icon={FolderOpen} value={evidenceCount} label="evidence" />
        <Stat icon={ClipboardCheck} value={assessmentsPassed} label="assessments" />
      </div>
    </section>
  );
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div>
      <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.7} />
      <p className="mt-2 font-display text-xl leading-none tabular-nums text-foreground">{value}</p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    </div>
  );
}