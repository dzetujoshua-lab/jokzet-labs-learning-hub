import { AppFrame } from "@/components/layout/app-frame";

// Same blocking-by-design session lookup as the learning area (see (app)/layout.tsx).
export const instant = false;

/** Settings and Privacy: signed-in only, but never blocked by unfinished onboarding (a learner can always export or delete their data). */
export default function AccountLayout({ children }: LayoutProps<"/">) {
  return <AppFrame enforceOnboarding={false}>{children}</AppFrame>;
}
