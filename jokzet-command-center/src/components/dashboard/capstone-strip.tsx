import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";

export type CapstoneView = { title: string; stage: number; stages: number } | null;

export function CapstoneStrip({ piece }: { piece: CapstoneView }) {
  if (!piece) {
    return (
      <section className="rounded-3xl border border-dashed border-border bg-card/60 p-6">
        <p className="mono-label">Main software integration capstone</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            Name your capstone — BusinessOS Ghana — and track its build stages here as the integration of every
            department.
          </p>
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary"
          >
            <Layers className="h-3 w-3" /> set up capstone
          </Link>
        </div>
      </section>
    );
  }

  const stages = piece.stages || 8;
  const stage = Math.min(piece.stage || 0, stages);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-64 opacity-[0.12] blur-3xl"
        style={{ background: "linear-gradient(90deg, hsl(var(--chart-1)), hsl(var(--chart-4)), transparent)" }}
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mono-label">Main software integration capstone</p>
          <h2 className="mt-2.5 font-display text-2xl font-medium tracking-tight text-foreground">{piece.title}</h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Stage {stage} of {stages}
          </p>
        </div>
        <Link
          href="/portfolio"
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-border bg-secondary px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-secondary-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          open capstone <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="relative mt-6 flex items-center gap-1.5">
        {Array.from({ length: stages }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < stage ? "bg-primary" : "bg-secondary"}`} />
        ))}
      </div>
    </section>
  );
}
