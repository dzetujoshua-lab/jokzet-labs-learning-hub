import { describe, expect, it } from "vitest";
import nextConfig, { contentSecurityPolicy, HSTS_MAX_AGE_SECONDS, securityHeaders } from "../next.config";

const asMap = (production: boolean) => Object.fromEntries(securityHeaders(production).map((h) => [h.key, h.value]));
const directives = (production: boolean) => Object.fromEntries(contentSecurityPolicy(production).split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

describe("production security headers", () => {
  const h = asMap(true);

  it("enforces the Content-Security-Policy (not report-only)", () => {
    expect(h["Content-Security-Policy"]).toBeTruthy();
    expect(h["Content-Security-Policy-Report-Only"]).toBeUndefined();
  });

  it("sends HSTS for 180 days, without subdomains or preload", () => {
    expect(h["Strict-Transport-Security"]).toBe(`max-age=${HSTS_MAX_AGE_SECONDS}`);
    expect(HSTS_MAX_AGE_SECONDS).toBe(15_552_000);
    expect(h["Strict-Transport-Security"]).not.toMatch(/includeSubDomains|preload/i);
  });

  it("blocks framing, plugins, other form targets and base tags, and upgrades insecure requests", () => {
    const d = directives(true);
    expect(d["frame-ancestors"]).toEqual(["'none'"]);
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["form-action"]).toEqual(["'self'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
    expect(d["default-src"]).toEqual(["'self'"]);
    expect(d["frame-src"]).toEqual(["'self'", "https://www.youtube-nocookie.com"]);
    expect(Object.keys(d)).toContain("upgrade-insecure-requests");
  });

  it("allows no eval, no websockets, no wildcard and no insecure origin", () => {
    const d = directives(true);
    expect(d["script-src"]).toEqual(["'self'", "'unsafe-inline'"]); // inline only: Next.js bootstrap scripts; no eval
    expect(d["connect-src"]).toEqual(["'self'"]);
    for (const [name, values] of Object.entries(d)) expect(values.some((v) => v === "*" || v.startsWith("http:") || v.startsWith("ws:")), name).toBe(false);
  });

  it("keeps the other hardening headers", () => {
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    for (const feature of ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"]) expect(h["Permissions-Policy"]).toContain(feature);
  });

  it("never advertises the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe("development headers", () => {
  it("stay report-only, allow what the dev server needs, and send no HSTS", () => {
    const h = asMap(false);
    expect(h["Content-Security-Policy-Report-Only"]).toBeTruthy();
    expect(h["Content-Security-Policy"]).toBeUndefined();
    expect(h["Strict-Transport-Security"]).toBeUndefined();
    expect(directives(false)["script-src"]).toContain("'unsafe-eval'");
  });
});
