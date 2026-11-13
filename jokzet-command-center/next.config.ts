import path from "node:path";
import type { NextConfig } from "next";

// Applied by Next.js itself so they cover server-rendered responses too (Netlify's [[headers]] only reach static files).
// Content-Security-Policy, in REPORT-ONLY mode: browsers log violations in the console but block nothing, so we can see what
// a strict policy would break before enforcing it. The only third-party origin allowed is the video provider's
// privacy-enhanced embed host, and only as a frame. 'unsafe-inline' is needed for Next.js's own inline scripts until a
// nonce-based policy is added; 'unsafe-eval' is development-only (React refresh).
const isDev = process.env.NODE_ENV !== "production";
export const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-src 'self' https://www.youtube-nocookie.com",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
