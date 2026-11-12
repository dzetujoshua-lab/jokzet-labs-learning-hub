import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

/** Honest placeholder for modules whose build phase has not started. Uses the Base44 header + empty state. */
export function ComingSoon({ eyebrow, title, description, phase }: { eyebrow: string; title: string; description: string; phase: number }) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState icon={Hammer} title="Not built yet" hint={`Scheduled for Phase ${phase}. Nothing on this page is functional yet.`} />
    </div>
  );
}
