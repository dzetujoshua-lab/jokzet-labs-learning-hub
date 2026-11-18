import path from "node:path";
import type { NextConfig } from "next";

// Security headers, applied by Next.js itself so they cover server-rendered responses too.
//
// In production the Content-Security-Policy is ENFORCED and Strict-Transport-Security is sent. In development the policy stays
// report-only (the dev server needs 'unsafe-eval' and websockets) and HSTS is not sent. The only third-party origin allowed is the
// video provider's privacy-enhanced embed host, and only as a frame. 'unsafe-inline' scripts remain because Next.js writes small
// inline bootstrap scripts; replacing that with per-request nonces is a separate piece of work. Everything else is locked down:
// no other script, frame, object, form or base address, and no other site may frame this one (frame-ancestors).
export function contentSecurityPolicy(production: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${production ? "" : " ws: wss:"}`,
    "frame-src 'self' https://www.youtube-nocookie.com",
    "media-src 'self' blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

// 180 days. No includeSubDomains and no preload on purpose: this host shares a parent domain with other sites, and neither can be
// undone quickly. To back out, send max-age=0 over HTTPS and the browser forgets it.
export const HSTS_MAX_AGE_SECONDS = 15_552_000;

export function securityHeaders(production: boolean): { key: string; value: string }[] {
  return [
    { key: production ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", value: contentSecurityPolicy(production) },
    ...(production ? [{ key: "Strict-Transport-Security", value: `max-age=${HSTS_MAX_AGE_SECONDS}` }] : []),
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}

// Public address of the deployment (for example https://jokzet-labs.iipghstudent.com). Behind a reverse proxy the Host header the
// server sees can differ from the address in the browser, so Server Actions are told which host to trust. Unset on Netlify.
const publicHost = (() => {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).host : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  poweredByHeader: false, // do not advertise the framework on every response
  // A self-contained server folder (.next/standalone) for hosts that run plain Node, such as cPanel. Off by default so the Netlify build is unchanged.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
  ...(publicHost ? { experimental: { serverActions: { allowedOrigins: [publicHost] } } } : {}),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV === "production") }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // The parent directory holds the archived Base44 export (own lockfile and
    // postcss config). Pin the root to this app so it is never picked up.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
