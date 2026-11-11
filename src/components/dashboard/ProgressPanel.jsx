import { useEffect, useState } from 'react';

const SEGMENTS = 25;

function useCountUp(target, duration = 1100) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setValue(target);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

export default function ProgressPanel({ eyebrow, title, badge, percent, footnote }) {
  const shown = useCountUp(percent);
  const filled = Math.round((percent / 100) * SEGMENTS);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-background p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full opacity-[0.14] blur-3xl"
        style={{ background: 'hsl(var(--primary))' }}
      />
      <div className="relative flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="mono-label">{eyebrow}</p>
          <h3 className="mt-3 font-display text-xl font-medium leading-tight text-foreground">{title}</h3>
          <span className="mt-4 inline-flex items-center rounded-full bg-secondary px-3 py-1.5 font-mono text-[11px] text-secondary-foreground">
            {badge}
          </span>
        </div>
        <p className="shrink-0 font-display text-[52px] font-light leading-none tabular-nums text-foreground">
          {shown}
          <span className="text-2xl text-muted-foreground">%</span>
        </p>
      </div>

      <ul
        className="relative mt-6 flex h-14 gap-1.5"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${title}: ${percent}%`}
      >
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <li
            key={i}
            className={`animate-cap flex-1 rounded-full border ${
              i < filled ? 'border-primary bg-primary' : 'border-white/20 bg-transparent'
            }`}
            style={{ animationDelay: `${i * 38}ms` }}
          />
        ))}
      </ul>

      {footnote ? <p className="relative mt-4 font-mono text-[11px] text-muted-foreground">{footnote}</p> : null}
    </section>
  );
}