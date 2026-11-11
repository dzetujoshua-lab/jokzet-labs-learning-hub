import { Sparkles } from 'lucide-react';

export default function EmptyState({ icon: Icon = Sparkles, title, hint, children }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" strokeWidth={1.7} />
      </span>
      <p className="mt-4 font-display text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}