import { z } from "zod";
import { db } from "@/lib/db";
import { bucketKey, rateLimitHit } from "@/lib/ratelimit";
import { parseResourceUrl } from "@/lib/resources/embed";
import { listContentGaps, type ContentGap } from "@/lib/resources/gaps";

/**
 * Content-quality checks for Academy Admins: what stops the curriculum being ready for learners. Everything is derived from the
 * stored data each time. The acting account is re-read and must be an ADMIN right now.
 */
export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
export const STALE_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export const filterShape = z.object({
  programme: z.string().trim().toLowerCase().max(40).optional(),
  status: z.enum(["APPROVED", "PENDING_REVIEW", "DRAFT", "REJECTED", "ARCHIVED"]).optional(),
  kind: z.enum(["VIDEO", "PLAYLIST", "DOCUMENTATION", "INTERACTIVE", "ORIGINAL", "DEMONSTRATION"]).optional(),
});
export type QualityFilter = z.infer<typeof filterShape>;

export type ProgrammeQuality = { code: string; name: string; lessons: number; withPrimary: number; withRubric: number; onlyLevelZero: boolean };
export type ResourceRow = { id: string; title: string; provider: string; kind: string; status: string; lessons: number; approvedBy: string | null; approvedAt: Date | null; lastVerifiedAt: Date | null; stale: boolean };
export type Quality = {
  programmes: ProgrammeQuality[];
  noPublishedLessons: { code: string; name: string }[];
  gaps: ContentGap[];
  noRubric: { code: string; title: string; programme: string }[];
  resources: ResourceRow[];
  awaiting: ResourceRow[];
  unverified: ResourceRow[];
  departments: { code: string; name: string }[];
  filter: { programme: string; status: string; kind: string };
  generatedAt: Date;
};

async function admin(actorId: string) {
  const a = await db.user.findUnique({ where: { id: actorId }, select: { role: true } });
  return a?.role === "ADMIN";
}

export async function getQuality(actorId: string, input: unknown, now: Date = new Date()): Promise<Result<{ quality: Quality }>> {
  if (!(await admin(actorId))) return { ok: false, error: "Only an Academy Admin can open the content-quality checks." };
  const parsed = filterShape.safeParse(input ?? {});
  const f = parsed.success ? parsed.data : {};
  const staleBefore = new Date(now.getTime() - STALE_DAYS * DAY);

  const [departments, missions, gapsAll, resourcesAll] = await Promise.all([
    db.department.findMany({ select: { code: true, name: true }, orderBy: { sortOrder: "asc" } }),
    db.mission.findMany({
      where: { createdById: null, isPublished: true, category: "CURRICULUM_MISSION", code: { not: null } },
      select: { code: true, title: true, role: true, department: { select: { code: true, name: true } }, level: { select: { number: true } }, rubric: { select: { id: true } } },
      orderBy: [{ department: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    listContentGaps(),
    db.learningResource.findMany({
      orderBy: [{ status: "asc" }, { title: "asc" }], take: 300,
      select: { id: true, title: true, provider: true, kind: true, status: true, approvedBy: true, approvedAt: true, lastVerifiedAt: true, _count: { select: { missions: true } }, missions: { select: { mission: { select: { department: { select: { code: true } } } } } } },
    }),
  ]);

  const programmes: ProgrammeQuality[] = departments.map((d) => {
    const mine = missions.filter((m) => m.department.code === d.code);
    const lessons = mine.filter((m) => m.role === "LESSON" || m.role === "CHECKPOINT");
    return {
      code: d.code, name: d.name, lessons: lessons.length,
      withPrimary: lessons.filter((m) => !gapsAll.some((g) => g.code === m.code)).length,
      withRubric: lessons.filter((m) => m.rubric).length,
      onlyLevelZero: lessons.length > 0 && lessons.every((m) => (m.level?.number ?? 0) === 0),
    };
  });
  const toRow = (r: (typeof resourcesAll)[number]): ResourceRow => ({
    id: r.id, title: r.title, provider: r.provider, kind: r.kind, status: r.status, lessons: r._count.missions, approvedBy: r.approvedBy, approvedAt: r.approvedAt, lastVerifiedAt: r.lastVerifiedAt,
    stale: r.status === "APPROVED" && (!r.lastVerifiedAt || r.lastVerifiedAt < staleBefore),
  });
  const rows = resourcesAll.map((r) => ({ raw: r, row: toRow(r) }));
  const keep = rows.filter(({ raw, row }) =>
    (!f.status || row.status === f.status) && (!f.kind || row.kind === f.kind) && (!f.programme || raw.missions.some((m) => m.mission.department.code === f.programme)));

  return {
    ok: true,
    quality: {
      programmes,
      noPublishedLessons: programmes.filter((p) => p.lessons === 0).map((p) => ({ code: p.code, name: p.name })),
      gaps: f.programme ? gapsAll.filter((g) => g.departmentCode === f.programme) : gapsAll,
      noRubric: missions.filter((m) => !m.rubric && (!f.programme || m.department.code === f.programme)).map((m) => ({ code: m.code!, title: m.title, programme: m.department.name })),
      resources: keep.map((k) => k.row),
      awaiting: rows.filter((r) => r.row.status === "PENDING_REVIEW").map((r) => r.row),
      unverified: rows.filter((r) => r.row.stale).map((r) => r.row),
      departments, filter: { programme: f.programme ?? "", status: f.status ?? "", kind: f.kind ?? "" }, generatedAt: now,
    },
  };
}

export type LinkCheck = { checked: number; ok: number; failed: { title: string; reason: string }[]; at: Date } | { limited: true };
type Fetch = typeof fetch;
const MAX_LINKS = 80;

/**
 * Opens each APPROVED resource's link once and records the date for the ones that answer. Only links that already passed the
 * host allow-list are requested, to the same host, with redirects never followed, a short time limit and no body read, so it
 * cannot be pointed anywhere else. At most once every ten minutes per administrator. A link that does not answer is reported,
 * never silently approved or removed.
 */
export async function verifyResourceLinks(actorId: string, now: Date = new Date(), fetchImpl: Fetch = fetch): Promise<Result<{ result: LinkCheck }>> {
  if (!(await admin(actorId))) return { ok: false, error: "Only an Academy Admin can verify links." };
  const hit = await rateLimitHit(bucketKey("resources:verify", actorId), { limit: 1, windowSeconds: 10 * 60 }, now);
  if (!hit.ok) return { ok: true, result: { limited: true } };
  const rows = await db.learningResource.findMany({ where: { status: "APPROVED" }, orderBy: { lastVerifiedAt: "asc" }, take: MAX_LINKS, select: { id: true, title: true, canonicalUrl: true, kind: true } });
  const failed: { title: string; reason: string }[] = [];
  let ok = 0;

  const check = async (r: (typeof rows)[number]) => {
    const parsed = parseResourceUrl(r.canonicalUrl);
    if (!parsed.ok) return failed.push({ title: r.title, reason: "The link is no longer on an approved host." });
    // YouTube videos: ask YouTube's own lookup (200 means the video exists and is public); everything else: the page itself.
    const target = parsed.provider === "youtube" ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(parsed.canonicalUrl)}` : parsed.canonicalUrl;
    const host = new URL(target).hostname;
    if (host !== new URL(parsed.canonicalUrl).hostname) return failed.push({ title: r.title, reason: "Unexpected host." });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetchImpl(target, { method: "GET", redirect: "manual", signal: controller.signal, headers: { "user-agent": "JOKZET-Academy-link-check" } });
      void res.body?.cancel().catch(() => undefined);
      if (res.status >= 200 && res.status < 400) {
        await db.learningResource.update({ where: { id: r.id }, data: { lastVerifiedAt: now } });
        ok += 1;
      } else failed.push({ title: r.title, reason: `The page answered ${res.status}.` });
    } catch {
      failed.push({ title: r.title, reason: "The page did not answer." });
    } finally {
      clearTimeout(timer);
    }
  };
  // Four at a time.
  for (let i = 0; i < rows.length; i += 4) await Promise.all(rows.slice(i, i + 4).map(check));
  return { ok: true, result: { checked: rows.length, ok, failed, at: now } };
}
