import type { CSSProperties, ReactNode } from "react";
import "./doodles.css";

/**
 * Educational and technology symbols that bounce around behind the homepage. Decorative only (hidden from screen readers and
 * never clickable). All motion is CSS (see doodles.css); this component renders no script and needs no client JavaScript.
 */
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const Svg = ({ children, box = 48 }: { children: ReactNode; box?: number }) => (
  <svg viewBox={`0 0 ${box} ${box}`} {...stroke} aria-hidden="true" focusable="false">{children}</svg>
);

const ICONS: Record<string, ReactNode> = {
  code: <Svg><path d="M17 14 7 24l10 10M31 14l10 10-10 10M27 10l-6 28" /></Svg>,
  laptop: <Svg><rect x="9" y="11" width="30" height="21" rx="2.5" /><path d="M4 38h40l-3-6H7zM20 35h8" /></Svg>,
  bulb: <Svg><path d="M18 33v-3.2C13.6 27 11 23 11 18.5 11 12.2 16.8 8 24 8s13 4.2 13 10.5c0 4.5-2.6 8.5-7 11.3V33zM19 38h10M21 42h6" /></Svg>,
  cap: <Svg><path d="M24 10 3 20l21 10 21-10zM11 25v9c0 3 6 6 13 6s13-3 13-6v-9M45 20v12" /></Svg>,
  circuit: <Svg><path d="M6 24h12M30 24h12M18 24l4-9h10M18 24l4 9h10" /><circle cx="35" cy="15" r="3" /><circle cx="35" cy="33" r="3" /><circle cx="6" cy="24" r="2" /><circle cx="42" cy="24" r="2" /></Svg>,
  pen: <Svg><path d="M8 40 12 28 34 6l8 8-22 22zM30 10l8 8M12 28l8 8" /></Svg>,
  ruler: <Svg><rect x="5" y="17" width="38" height="14" rx="2" transform="rotate(-30 24 24)" /><path d="m14 27 3 1.7M20 23.5l2.2 1.3M26 20l3 1.7M32 16.5l2.2 1.3" /></Svg>,
  triangle: <Svg><path d="M24 7 43 39H5z" /></Svg>,
  hexagon: <Svg><path d="M24 5 41 15v18L24 43 7 33V15z" /></Svg>,
  circle: <Svg><circle cx="24" cy="24" r="16" /><circle cx="24" cy="24" r="5" /></Svg>,
  square: <Svg><rect x="9" y="9" width="30" height="30" rx="4" transform="rotate(12 24 24)" /></Svg>,
  pi: <Svg><path d="M9 14h30M17 14c0 12-1 18-4 24M31 14v21c0 3 2 4 5 3" /></Svg>,
  sigma: <Svg><path d="M36 10H12l14 14-14 14h24" /></Svg>,
  plus: <Svg><path d="M24 9v30M9 24h30" /></Svg>,
  root: <Svg><path d="M5 26h7l7 14 10-32h14" /></Svg>,
  divide: <Svg><path d="M9 24h30" /><circle cx="24" cy="12" r="2.5" /><circle cx="24" cy="36" r="2.5" /></Svg>,
  network: <Svg><circle cx="24" cy="9" r="4" /><circle cx="9" cy="35" r="4" /><circle cx="39" cy="35" r="4" /><circle cx="24" cy="26" r="3" /><path d="m22 12-11 20M26 12l11 20M13 35h22M24 13v10" /></Svg>,
  brackets: <Svg><path d="M18 8h-6v32h6M30 8h6v32h-6" /></Svg>,
  cursor: <Svg><path d="m10 6 26 14-11 3-5 11z" /></Svg>,
};

type Doodle = {
  icon: keyof typeof ICONS;
  x: number; // left, % of the screen
  y: number; // top, %
  s: number; // size, px
  o: number; // opacity (depth: small and faint = far away)
  d: number; // seconds per bounce
  delay: number; // seconds (negative = already part-way through)
  h: number; // bounce height, px
  r: number; // rotation at the bottom of the bounce, degrees
  w?: number; // sideways drift, px (only for the "b" and "c" patterns)
  kind: "a" | "b" | "c";
  glow?: "glow" | "blue";
  pulse?: boolean;
  large?: boolean; // hidden on phones
};

// Positions leave the middle column calmer; sizes and opacity vary to give depth. No two share timing.
const DOODLES: Doodle[] = [
  { icon: "code", x: 6, y: 12, s: 64, o: 0.34, d: 4.2, delay: -1.1, h: 26, r: 8, kind: "a", glow: "blue" },
  { icon: "laptop", x: 84, y: 10, s: 72, o: 0.3, d: 5.6, delay: -3.2, h: 22, r: -6, w: 26, kind: "b", glow: "glow" },
  { icon: "bulb", x: 18, y: 66, s: 58, o: 0.36, d: 3.6, delay: -0.4, h: 30, r: -10, kind: "a", glow: "blue", pulse: true },
  { icon: "cap", x: 76, y: 72, s: 70, o: 0.28, d: 6.4, delay: -2.5, h: 28, r: 9, w: -30, kind: "b" },
  { icon: "circuit", x: 46, y: 6, s: 54, o: 0.24, d: 4.8, delay: -4.1, h: 18, r: 5, kind: "a", glow: "blue", large: true },
  { icon: "network", x: 92, y: 42, s: 60, o: 0.3, d: 5.2, delay: -1.9, h: 24, r: 7, w: -22, kind: "c", glow: "blue" },
  { icon: "pen", x: 3, y: 42, s: 52, o: 0.26, d: 4.4, delay: -2.8, h: 24, r: -12, w: 18, kind: "b" },
  { icon: "pi", x: 30, y: 24, s: 38, o: 0.2, d: 3.9, delay: -1.5, h: 20, r: 14, kind: "a", large: true },
  { icon: "sigma", x: 64, y: 18, s: 34, o: 0.18, d: 4.6, delay: -3.6, h: 16, r: -9, kind: "a", large: true },
  { icon: "triangle", x: 12, y: 86, s: 44, o: 0.22, d: 5.0, delay: -0.9, h: 22, r: 16, w: 20, kind: "b", large: true },
  { icon: "hexagon", x: 56, y: 84, s: 62, o: 0.16, d: 7.2, delay: -5.0, h: 34, r: 20, w: 36, kind: "c", glow: "glow", large: true },
  { icon: "circle", x: 38, y: 90, s: 36, o: 0.2, d: 3.4, delay: -2.2, h: 18, r: -6, kind: "a" },
  { icon: "square", x: 88, y: 88, s: 46, o: 0.22, d: 4.9, delay: -1.3, h: 20, r: 12, w: -16, kind: "b" },
  { icon: "plus", x: 24, y: 8, s: 30, o: 0.2, d: 3.2, delay: -2.0, h: 14, r: 24, kind: "a" },
  { icon: "root", x: 70, y: 56, s: 42, o: 0.18, d: 5.8, delay: -4.4, h: 22, r: -8, w: 24, kind: "c", large: true },
  { icon: "divide", x: 8, y: 28, s: 30, o: 0.18, d: 3.7, delay: -0.2, h: 16, r: 10, kind: "a", large: true },
  { icon: "brackets", x: 94, y: 22, s: 40, o: 0.2, d: 4.3, delay: -3.0, h: 18, r: -7, kind: "a" },
  { icon: "cursor", x: 50, y: 70, s: 34, o: 0.22, d: 3.8, delay: -1.0, h: 22, r: 12, w: 14, kind: "b", glow: "blue", large: true },
  { icon: "ruler", x: 80, y: 34, s: 56, o: 0.14, d: 6.8, delay: -2.6, h: 30, r: 10, w: -28, kind: "c", large: true },
  { icon: "code", x: 34, y: 54, s: 28, o: 0.14, d: 4.0, delay: -3.3, h: 14, r: -5, kind: "a", large: true },
];

/** Four tiers: the first three doodles are the only ones that stay on the quietest pages; the last ones appear on the richest. */
const tierOf = (i: number) => (i < 3 ? "t0" : i < 6 ? "t1" : i < 13 ? "t2" : "t3");
const PARTICLES = [
  { x: 14, y: 60, s: 4, d: 11, delay: -2, w: 18 }, { x: 33, y: 82, s: 3, d: 14, delay: -7, w: -14 }, { x: 52, y: 70, s: 5, d: 12, delay: -4, w: 22 },
  { x: 70, y: 88, s: 3, d: 16, delay: -9, w: -20 }, { x: 86, y: 64, s: 4, d: 13, delay: -1, w: 12 }, { x: 24, y: 40, s: 3, d: 15, delay: -11, w: -10 },
];

/**
 * The shared background. `behind` puts it under the page content with z-index -1 (for pages whose content is not positioned);
 * the public pages put their content above it instead. How much of it shows, and how hard it bounces, is decided by
 * html[data-atmosphere] (see RouteAtmosphere), so one markup serves every page.
 */
export function BackgroundDoodles({ behind = false }: { behind?: boolean }) {
  return (
    <div className={`doodles${behind ? " behind" : ""}`} aria-hidden="true">
      <div className="atmos" />
      {PARTICLES.map((p, i) => (
        <span key={i} className="particle" style={{ "--x": `${p.x}%`, "--y": `${p.y}%`, "--s": `${p.s}px`, "--d": `${p.d}s`, "--delay": `${p.delay}s`, "--w": `${p.w}px` } as CSSProperties} />
      ))}
      {DOODLES.map((d, i) => {
        const style = { "--x": `${d.x}%`, "--y": `${d.y}%`, "--s": `${d.s}px`, "--o": d.o, "--d": `${d.d}s`, "--delay": `${d.delay}s`, "--h-base": `${d.h}px`, "--r": `${d.r}deg`, "--w-base": `${d.w ?? 0}px` } as CSSProperties;
        return (
          <span key={i} className={`doodle ${d.kind} ${tierOf(i)} ${d.glow ?? ""} ${d.pulse ? "pulse" : ""} ${d.large ? "lg" : ""}`.replace(/\s+/g, " ").trim()} style={style}>
            {ICONS[d.icon]}
          </span>
        );
      })}
    </div>
  );
}
