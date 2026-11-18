"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { atmosphereFor, type Atmosphere } from "@/lib/atmosphere";

/** Tells the shared background how strong to be on this page (html[data-atmosphere]). Renders nothing. */
export function RouteAtmosphere({ fixed }: { fixed?: Atmosphere }) {
  const pathname = usePathname();
  const level = fixed ?? atmosphereFor(pathname);
  useEffect(() => {
    document.documentElement.dataset.atmosphere = level;
    return () => {
      delete document.documentElement.dataset.atmosphere;
    };
  }, [level]);
  return null;
}
