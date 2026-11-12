import path from "node:path";
import type { NextConfig } from "next";

// Applied by Next.js itself so they cover server-rendered responses too (Netlify's [[headers]] only reach static files).
const securityHeaders = [
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
