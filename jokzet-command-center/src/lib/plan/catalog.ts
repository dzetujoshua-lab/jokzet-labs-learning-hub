import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { CatalogMission } from "./generate";

/**
 * The published curriculum as plain data for the generator, plus a version hash. A plan records the version it was built
 * from; when the catalogue later changes the learner is offered a regeneration, plans are never silently rewritten.
 */
export async function loadCatalog(): Promise<{ catalog: CatalogMission[]; catalogVersion: string }> {
  const rows = await db.mission.findMany({
    where: { createdById: null, isPublished: true, category: "CURRICULUM_MISSION" },
    orderBy: [{ departmentId: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    select: {
      id: true, code: true, role: true, title: true, objective: true, durationMinutes: true, sortOrder: true,
      department: { select: { code: true } },
      level: { select: { number: true } },
      steps: { orderBy: { position: "asc" }, select: { position: true, phase: true, minutes: true } },
    },
  });
  const catalog: CatalogMission[] = rows
    .filter((r) => r.code)
    .map((r) => ({
      id: r.id, code: r.code!, departmentCode: r.department.code, level: r.level?.number ?? 0, sortOrder: r.sortOrder, role: r.role,
      title: r.title, objective: r.objective ?? "", minutes: r.durationMinutes, steps: r.steps.map((s) => ({ position: s.position, phase: s.phase, minutes: s.minutes })),
    }));
  const catalogVersion = createHash("sha256")
    .update(JSON.stringify(catalog.map((m) => [m.id, m.code, m.level, m.sortOrder, m.role, m.minutes, m.steps.map((s) => [s.position, s.phase, s.minutes])])))
    .digest("hex")
    .slice(0, 16);
  return { catalog, catalogVersion };
}
