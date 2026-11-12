import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // The parent directory holds the archived Base44 export (own lockfile and
    // postcss config). Pin the root to this app so it is never picked up.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
