import { z } from "zod";
import { db } from "@/lib/db";
import { LIMITS, bucketKey, rateLimitHit } from "@/lib/ratelimit";
import { parseResourceUrl } from "./embed";

/**
 * WATCH resources for a mission, and the learner's advisory interaction with them.
 *
 * Engagement is reported by the browser, so it can be forged: it is stored as "latest state per learner and resource",
 * is never used to gate submission, assessment, credit or plan progress, and opening a link is never treated as watching.
 */

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Client-reported playback at or above this percentage may be recorded as "completed". It is a hint, not proof. */
export const COMPLETION_THRESHOLD = 90;

export const ENGAGEMENT_EVENTS = ["STARTED", "PROGRESS_UPDATED", "COMPLETED", "BOOKMARKED", "UNBOOKMARKED", "EXTERNAL_OPENED"] as const;
export type EngagementEvent = (typeof ENGAGEMENT_EVENTS)[number];

export const engagementSchema = z.object({
  resourceId: z.string().min(1).max(64),
  event: z.enum(ENGAGEMENT_EVENTS),
  progressPct: z.number().int().min(0).max(100).optional(),
});

export type WatchResourceView = {
  id: string;
  title: string;
  kind: string;
  provider: string;
  role: "PRIMARY" | "SUPPLEMENTARY";
  durationMinutes: number | null;
  level: string | null;
  url: string;
  embedUrl: string | null; // only when our player is allowed to show it
  bookmarked: boolean;
  started: boolean;
  progressPct: number | null;
};

/** Approved resources for a mission, the primary first, with the learner's own advisory state. Drafts and rejected ones are never returned. */
export async function getMissionWatch(userId: string, missionId: string): Promise<WatchResourceView[]> {
  const rows = await db.missionResource.findMany({
    where: { missionId, resource: { status: "APPROVED" } },
    orderBy: { position: "asc" },
    include: { resource: { include: { engagements: { where: { userId } } } } },
  });
  // The primary resource first, then the rest in their catalogue order.
  rows.sort((a, b) => (a.role === b.role ? a.position - b.position : a.role === "PRIMARY" ? -1 : 1));
  return rows.map((r) => {
    const parsed = parseResourceUrl(r.resource.canonicalUrl);
    const engagement = r.resource.engagements[0];
    return {
      id: r.resource.id,
      title: r.resource.title,
      kind: r.resource.kind,
      provider: r.resource.provider,
      role: r.role === "PRIMARY" ? "PRIMARY" : "SUPPLEMENTARY",
      durationMinutes: r.resource.durationMinutes,
      level: r.resource.level,
      url: r.resource.canonicalUrl,
      embedUrl: r.resource.embeddable && parsed.ok ? parsed.embedUrl : null,
      bookmarked: engagement?.bookmarked ?? false,
      started: !!engagement?.startedAt,
      progressPct: engagement?.progressPct ?? null,
    };
  });
}

/** Does the mission have an approved PRIMARY instructional resource? The plan generator uses this to report shortfall. */
export async function hasApprovedPrimary(missionId: string): Promise<boolean> {
  return (await db.missionResource.count({ where: { missionId, role: "PRIMARY", resource: { status: "APPROVED" } } })) > 0;
}

/**
 * Records one interaction. Only APPROVED resources can be engaged with. COMPLETED needs a reported progress at or above
 * the threshold; opening an external link records EXTERNAL_OPENED and never completes anything.
 */
export async function recordEngagement(userId: string, input: z.input<typeof engagementSchema>): Promise<Result> {
  const parsed = engagementSchema.safeParse(input);
  if (!parsed.success) return fail("That interaction is not valid.");
  const { resourceId, event, progressPct } = parsed.data;

  const limit = await rateLimitHit(bucketKey("resource:engage", userId), LIMITS.resourceEngagementUser);
  if (!limit.ok) return fail("Please slow down.");

  const resource = await db.learningResource.findFirst({ where: { id: resourceId, status: "APPROVED" }, select: { id: true } });
  if (!resource) return fail("This resource is not available.");

  if ((event === "PROGRESS_UPDATED" || event === "COMPLETED") && progressPct === undefined) return fail("Progress is required for that event.");
  if (event === "COMPLETED" && (progressPct ?? 0) < COMPLETION_THRESHOLD) return fail(`Completion needs at least ${COMPLETION_THRESHOLD}% reported progress.`);

  const now = new Date();
  const existing = await db.resourceEngagement.findUnique({ where: { userId_resourceId: { userId, resourceId } } });
  const best = Math.max(existing?.progressPct ?? 0, progressPct ?? 0); // progress only moves forward
  const data = {
    lastEvent: event,
    startedAt: existing?.startedAt ?? (event === "STARTED" || event === "PROGRESS_UPDATED" || event === "COMPLETED" ? now : null),
    progressPct: progressPct !== undefined ? best : (existing?.progressPct ?? null),
    completedAt: event === "COMPLETED" ? (existing?.completedAt ?? now) : (existing?.completedAt ?? null),
    externalOpenedAt: event === "EXTERNAL_OPENED" ? now : (existing?.externalOpenedAt ?? null),
    bookmarked: event === "BOOKMARKED" ? true : event === "UNBOOKMARKED" ? false : (existing?.bookmarked ?? false),
  };
  await db.resourceEngagement.upsert({
    where: { userId_resourceId: { userId, resourceId } },
    update: data,
    create: { userId, resourceId, ...data },
  });
  return { ok: true };
}
