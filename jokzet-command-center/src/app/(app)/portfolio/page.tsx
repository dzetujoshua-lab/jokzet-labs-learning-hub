import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Portfolio" };

export default function Page() {
  return <ComingSoon eyebrow="Portfolio" title="Portfolio" description="Completed projects, skills, repository links and live demonstrations." phase={8} />;
}
