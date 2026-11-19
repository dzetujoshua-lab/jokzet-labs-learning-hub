/** Original artwork for the Administration Centre banner: a dashboard window, a graduation cap and a shield over a network of nodes. Decorative SVG, theme-token colours only. */
export function AdminHeroArt({ className = "" }: { className?: string }) {
  const line = { fill: "none", stroke: "hsl(var(--admin-cyan))", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 360 200" className={className} aria-hidden="true" focusable="false">
      <g opacity={0.5} {...line} strokeWidth={1.5}>
        <path d="M20 150l50-40 40 20 60-60 50 30 70-50" />
        <circle cx="20" cy="150" r="4" /><circle cx="70" cy="110" r="4" /><circle cx="110" cy="130" r="4" /><circle cx="170" cy="70" r="4" /><circle cx="220" cy="100" r="4" /><circle cx="290" cy="50" r="4" />
      </g>
      <g className="admin-float">
        <rect x="96" y="56" width="168" height="108" rx="12" fill="hsl(222 52% 12% / 0.9)" stroke="hsl(var(--primary))" strokeWidth={2.5} />
        <rect x="108" y="70" width="46" height="80" rx="6" fill="hsl(var(--primary) / 0.22)" />
        <rect x="162" y="70" width="90" height="22" rx="6" fill="hsl(var(--chart-3) / 0.3)" />
        <path d="M166 142v-22M184 142v-34M202 142v-14M220 142v-28M238 142v-40" stroke="hsl(var(--chart-5))" strokeWidth={6} strokeLinecap="round" />
      </g>
      <g className="admin-float" style={{ animationDelay: "-2s" }}>
        <path d="M180 8L132 28l48 20 48-20z" fill="hsl(var(--chart-2) / 0.4)" stroke="hsl(var(--chart-2))" strokeWidth={2.5} strokeLinejoin="round" />
        <path d="M150 38v14c0 6 12 10 30 10s30-4 30-10V38" {...line} stroke="hsl(var(--chart-2))" />
      </g>
      <g className="admin-float" style={{ animationDelay: "-4s" }}>
        <path d="M312 70l30 10v28c0 18-12 30-30 38-18-8-30-20-30-38V80z" fill="hsl(var(--chart-3) / 0.22)" stroke="hsl(var(--chart-3))" strokeWidth={2.5} strokeLinejoin="round" />
        <path d="M300 112l9 9 17-20" fill="none" stroke="hsl(var(--chart-3))" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
