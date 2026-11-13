import type { PrismaClient } from "../../src/generated/prisma/client";
import { parseResourceUrl } from "../../src/lib/resources/embed";
import type { MissionResourceSpec, ResourceSpec } from "./resources";

export type ResourceSyncResult = { resources: number; links: number; reviews: number; archived: number };

/**
 * Brings the database catalogue in line with the reviewed file. Safe and repeatable:
 *  - resources are upserted by canonical URL (never deleted; ones that left the file are ARCHIVED, history is kept);
 *  - reviews are append-only (unique per resource, reviewer and date);
 *  - mission links are synced only for the missions the file mentions, switching a PRIMARY without ever having two.
 * Legacy `Resource` placeholders are not touched.
 */
export async function syncResourceCatalogue(prisma: PrismaClient, resources: ResourceSpec[], links: MissionResourceSpec[]): Promise<ResourceSyncResult> {
  const result: ResourceSyncResult = { resources: 0, links: 0, reviews: 0, archived: 0 };
  const idByCanonical = new Map<string, string>();

  for (const r of resources) {
    const parsed = parseResourceUrl(r.url);
    if (!parsed.ok) throw new Error(`${r.url}: ${parsed.error}`);
    const data = {
      provider: parsed.provider,
      kind: r.kind,
      title: r.title,
      durationMinutes: r.durationMinutes ?? null,
      language: r.language ?? "en",
      level: r.level ?? null,
      embeddable: r.embeddable ?? false,
      status: r.status,
      approvedBy: r.approvedBy ?? null,
      approvedAt: r.approvedAt ? new Date(r.approvedAt) : null,
      lastVerifiedAt: r.lastVerifiedAt ? new Date(r.lastVerifiedAt) : null,
      licenceNote: r.licenceNote ?? null,
    };
    const row = await prisma.learningResource.upsert({
      where: { canonicalUrl: parsed.canonicalUrl },
      update: data,
      create: { canonicalUrl: parsed.canonicalUrl, ...data },
    });
    idByCanonical.set(parsed.canonicalUrl, row.id);
    result.resources += 1;
    if (r.reviews?.length) {
      const { count } = await prisma.resourceReview.createMany({
        data: r.reviews.map((x) => ({ resourceId: row.id, reviewerName: x.reviewerName, decision: x.decision, note: x.note ?? null, at: new Date(x.at) })),
        skipDuplicates: true,
      });
      result.reviews += count;
    }
  }

  // Resources that are no longer in the file are archived, never deleted.
  const archived = await prisma.learningResource.updateMany({
    where: { canonicalUrl: { notIn: [...idByCanonical.keys()] }, status: { not: "ARCHIVED" } },
    data: { status: "ARCHIVED" },
  });
  result.archived = archived.count;

  const byMission = new Map<string, { resourceId: string; role: string; position: number }[]>();
  for (const l of links) {
    const parsed = parseResourceUrl(l.url);
    if (!parsed.ok) throw new Error(`${l.missionCode} -> ${l.url}: ${parsed.error}`);
    const resourceId = idByCanonical.get(parsed.canonicalUrl);
    if (!resourceId) throw new Error(`${l.missionCode} -> ${l.url}: the resource is not in the catalogue`);
    const list = byMission.get(l.missionCode) ?? [];
    list.push({ resourceId, role: l.role, position: l.position ?? list.length });
    byMission.set(l.missionCode, list);
  }
  for (const [code, desired] of byMission) {
    const mission = await prisma.mission.findUnique({ where: { code }, select: { id: true } });
    if (!mission) throw new Error(`${code}: unknown mission`);
    const wantedIds = desired.map((d) => d.resourceId);
    // 1) demote anything that is not wanted as the primary, 2) drop what is not wanted at all, 3) upsert the wanted links.
    await prisma.missionResource.updateMany({ where: { missionId: mission.id, role: "PRIMARY", NOT: { resourceId: { in: desired.filter((d) => d.role === "PRIMARY").map((d) => d.resourceId) } } }, data: { role: "SUPPLEMENTARY" } });
    await prisma.missionResource.deleteMany({ where: { missionId: mission.id, resourceId: { notIn: wantedIds } } });
    for (const d of desired.filter((x) => x.role !== "PRIMARY")) {
      await prisma.missionResource.upsert({ where: { missionId_resourceId: { missionId: mission.id, resourceId: d.resourceId } }, update: { role: d.role, position: d.position }, create: { missionId: mission.id, resourceId: d.resourceId, role: d.role, position: d.position } });
      result.links += 1;
    }
    for (const d of desired.filter((x) => x.role === "PRIMARY")) {
      await prisma.missionResource.upsert({ where: { missionId_resourceId: { missionId: mission.id, resourceId: d.resourceId } }, update: { role: "PRIMARY", position: d.position }, create: { missionId: mission.id, resourceId: d.resourceId, role: "PRIMARY", position: d.position } });
      result.links += 1;
    }
  }
  return result;
}
