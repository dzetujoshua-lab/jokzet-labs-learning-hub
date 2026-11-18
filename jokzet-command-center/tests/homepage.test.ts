import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

const read = (p: string) => readFileSync(path.resolve(import.meta.dirname, "..", p), "utf8");
const css = read("src/components/home/doodles.css");
const tsx = read("src/components/home/background-doodles.tsx");

describe("public homepage routing", () => {
  const req = (p: string, cookie = false) => new NextRequest(`https://example.test${p}`, cookie ? { headers: { cookie: `${SESSION_COOKIE}=abc` } } : undefined);
  const where = (res: Response) => (res.headers.get("location") ? new URL(res.headers.get("location")!).pathname : null);

  it("sends a signed-out visitor from the main address to the public homepage", () => {
    expect(where(proxy(req("/")))).toBe("/welcome");
  });
  it("still sends a signed-out visitor to sign in for any private page", () => {
    for (const p of ["/missions", "/departments", "/courses", "/timetable"]) expect(where(proxy(req(p))), p).toBe("/login");
  });
  it("lets anyone open the homepage, sign-in and sign-up", () => {
    for (const p of ["/welcome", "/login", "/register", "/privacy-policy"]) expect(proxy(req(p)).headers.get("location"), p).toBeNull();
  });
  it("leaves a signed-in visitor on the dashboard", () => {
    expect(proxy(req("/", true)).headers.get("location")).toBeNull();
  });
});

describe("bouncing doodle background", () => {
  const doodles = [...tsx.matchAll(/\{ icon: "(\w+)", x: (\d+), y: (\d+), s: (\d+), o: ([\d.]+), d: ([\d.]+), delay: (-?[\d.]+), h: (\d+), r: (-?\d+)/g)];

  it("has a lively set of varied doodles covering the requested themes", () => {
    expect(doodles.length).toBeGreaterThanOrEqual(18);
    const icons = new Set(doodles.map((m) => m[1]));
    for (const theme of ["code", "laptop", "bulb", "cap", "circuit", "pen", "triangle", "pi", "network"]) expect(icons.has(theme), theme).toBe(true);
    expect(new Set(doodles.map((m) => m[6])).size).toBeGreaterThanOrEqual(15); // many different durations
    expect(new Set(doodles.map((m) => m[7])).size).toBeGreaterThanOrEqual(15); // many different start offsets: never in step
    expect(new Set(doodles.map((m) => m[4])).size).toBeGreaterThanOrEqual(10); // many sizes
    const opacities = doodles.map((m) => Number(m[5]));
    expect(Math.min(...opacities)).toBeLessThan(0.2); // faint ones in the back
    expect(Math.max(...opacities)).toBeGreaterThan(0.28); // clearer ones in front
  });

  it("uses three different bounce patterns, with sideways drift, rotation, squash and a blue glow", () => {
    for (const k of ["bounce-a", "bounce-b", "bounce-c"]) expect(css).toContain(`@keyframes ${k}`);
    expect(css).toMatch(/translate3d\(calc\(var\(--w\)/); // horizontal movement
    expect(css).toMatch(/rotate\(/);
    expect(css).toMatch(/scale\(1\.1, 0\.88\)/); // squash on landing
    expect(css).toMatch(/rgb\(var\(--glow\)/);
    expect(css).toMatch(/--glow: 56 132 255/);
    expect(tsx).toMatch(/kind: "b"/);
    expect(tsx).toMatch(/kind: "c"/);
  });

  it("loops without a jump: every pattern ends where it started", () => {
    for (const k of ["bounce-a", "bounce-b", "bounce-c"]) {
      const block = css.slice(css.indexOf(`@keyframes ${k}`)).split("\n}\n")[0];
      const first = block.match(/0% \{ transform: ([^;]+);/)![1].replace(/\s+/g, " ");
      const last = block.match(/100% \{ transform: ([^;]+);/)![1].replace(/\s+/g, " ");
      expect(last, k).toBe(first);
    }
  });

  it("only animates transform and opacity, and runs no script", () => {
    const keyframes = css.match(/@keyframes[\s\S]*?\n\}\n/g)!.join("\n");
    expect(keyframes).not.toMatch(/\b(left|top|width|height|margin|box-shadow|filter)\s*:/);
    expect(tsx).not.toContain("use client");
    expect(tsx).not.toMatch(/useEffect|requestAnimationFrame|setInterval|addEventListener/);
  });

  it("calms down on phones and stops moving for people who ask for less motion", () => {
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*\.doodle\.lg \{ display: none; \}/);
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*calc\(var\(--h-base\) \* 0\.55\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/);
  });

  it("is decorative: hidden from assistive technology and never catches clicks", () => {
    expect(tsx).toContain('aria-hidden="true"');
    expect(css).toMatch(/\.doodles \{[^}]*pointer-events: none/);
  });
});
