import { WatchPanel } from "@/components/missions/watch-panel";
import type { WatchResourceView } from "@/lib/resources/service";

/**
 * "Prepare for this assessment": the mission's approved learning resources, shown before an attempt and again on the result page.
 * Only approved resources ever reach this component (see getMissionWatch). When there are none, it says so plainly instead of
 * showing an empty box or a substitute; the gap is listed for staff on the review page.
 */
export function PreparePanel({ resources, retry = false, weakCriteria = [] }: { resources: WatchResourceView[]; retry?: boolean; weakCriteria?: string[] }) {
  const heading = retry ? "Before you resubmit · review these" : "Prepare for this assessment";
  return (
    <div className="space-y-3">
      {retry && weakCriteria.length ? (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          Your feedback points to: <span className="text-foreground">{weakCriteria.join(", ")}</span>. These are this mission&apos;s approved resources, which cover the whole mission.
        </p>
      ) : null}
      {resources.length ? (
        <WatchPanel resources={resources} heading={heading} />
      ) : (
        <section className="panel p-5" aria-labelledby="prep-empty-heading">
          <p id="prep-empty-heading" className="mono-label">{heading}</p>
          <p className="mt-3 text-sm text-foreground">Video resource not yet available.</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            No approved video or guide has been added for this mission yet. The brief, rubric and mission steps tell you what is expected. This is recorded as a content gap for the Academy team; nothing has been substituted.
          </p>
        </section>
      )}
    </div>
  );
}
