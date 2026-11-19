/**
 * An original JOKZET illustration for the welcome banner: a laptop with a graduation cap, a light bulb and a small circuit. Pure
 * SVG in the existing theme colours (no image file, no script). The pieces drift gently with CSS only (see doodles.css, `.hero-*`);
 * reduced motion stops them. Decorative, so hidden from assistive technology.
 */
export function HeroIllustration({ className = "" }: { className?: string }) {
  const line = { fill: "none", stroke: "hsl(var(--primary))", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 320 220" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="160" cy="196" rx="118" ry="12" fill="hsl(var(--primary) / 0.10)" />
      {/* circuit lines */}
      <g className="hero-b" {...line} strokeWidth={2} opacity={0.55}>
        <path d="M18 150h42l14-22h30" />
        <circle cx="18" cy="150" r="4" />
        <circle cx="104" cy="128" r="4" />
        <path d="M302 96h-40l-12 18h-26" />
        <circle cx="302" cy="96" r="4" />
        <circle cx="224" cy="114" r="4" />
      </g>
      {/* laptop */}
      <g className="hero-a">
        <rect x="82" y="86" width="156" height="98" rx="10" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth={3} />
        <rect x="94" y="98" width="132" height="74" rx="5" fill="hsl(var(--primary) / 0.10)" />
        <path d="M66 190h188l-10-10H76z" fill="hsl(var(--secondary))" stroke="hsl(var(--primary))" strokeWidth={3} strokeLinejoin="round" />
        {/* code on the screen */}
        <path d="M114 124l-14 12 14 12M206 124l14 12-14 12M168 118l-16 36" {...line} />
      </g>
      {/* graduation cap */}
      <g className="hero-c">
        <path d="M160 18 100 44l60 26 60-26z" fill="hsl(var(--primary) / 0.22)" stroke="hsl(var(--primary))" strokeWidth={3} strokeLinejoin="round" />
        <path d="M126 58v20c0 8 15 14 34 14s34-6 34-14V58" {...line} />
        <path d="M220 44v26" {...line} />
        <circle cx="220" cy="74" r="4" fill="hsl(var(--primary))" />
      </g>
      {/* light bulb */}
      <g className="hero-b">
        <path d="M268 40a20 20 0 1 0-30 17c3 3 4 6 4 10h22c0-4 1-7 4-10a20 20 0 0 0 0-17z" fill="hsl(var(--primary) / 0.12)" stroke="hsl(var(--primary))" strokeWidth={3} strokeLinejoin="round" transform="translate(-6 0)" />
        <path d="M244 76h20M248 84h12" {...line} />
      </g>
    </svg>
  );
}
