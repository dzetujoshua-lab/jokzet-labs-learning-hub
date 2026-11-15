import { AI } from "./ai";
import { BIZ } from "./biz";
import { CLOUD } from "./cloud";
import { FSWD } from "./fswd";
import { GFX } from "./gfx";
import { PATHWAYS } from "./pathways";
import { PHOTO } from "./photo";
import { RUBRICS } from "./rubrics";
import { SEC } from "./sec";
import { SHARED } from "./shared";
import type { ModuleSpec, PathwaySpec, ProgrammeCode, ProgrammeSpec, SharedSpec } from "./types";
import { UXUI } from "./uxui";
import { VIDEO } from "./video";

export * from "./types";
export { PATHWAYS, RUBRICS, SHARED };

export const PROGRAMMES: ProgrammeSpec[] = [FSWD, UXUI, SEC, PHOTO, VIDEO, GFX, AI, BIZ, CLOUD];

export const ALL_MODULES: ModuleSpec[] = [...SHARED.modules, ...PROGRAMMES.flatMap((p) => p.modules)];

export const moduleById = (id: string): ModuleSpec | undefined => ALL_MODULES.find((m) => m.id === id);
export const programmeOf = (id: string): ProgrammeSpec | SharedSpec | undefined => (id.startsWith("SH-") ? SHARED : PROGRAMMES.find((p) => id.startsWith(`${p.code.toUpperCase()}-`)));

/** Every module needed to finish a pathway: the required programmes up to their required levels, plus all prerequisites they pull in. */
export function pathwayModules(path: PathwaySpec): ModuleSpec[] {
  const wanted = new Set<string>();
  const add = (id: string) => {
    if (wanted.has(id)) return;
    const m = moduleById(id);
    if (!m) return;
    wanted.add(id);
    m.prerequisites.forEach(add);
  };
  for (const code of path.requiredProgrammes) {
    const top = path.requiredLevels[code] ?? 0;
    PROGRAMMES.find((p) => p.code === code)?.modules.filter((m) => m.level <= top).forEach((m) => add(m.id));
  }
  return ALL_MODULES.filter((m) => wanted.has(m.id));
}

/** Recommended order: lowest level first, shared core before programme modules, every prerequisite before its dependants. */
export function pathwaySequence(path: PathwaySpec): string[] {
  const mods = pathwayModules(path);
  const ids = new Set(mods.map((m) => m.id));
  const out: string[] = [];
  const done = new Set<string>();
  const order = (a: ModuleSpec, b: ModuleSpec) => a.level - b.level || Number(!a.id.startsWith("SH-")) - Number(!b.id.startsWith("SH-")) || a.id.localeCompare(b.id);
  const visit = (m: ModuleSpec, trail: string[]) => {
    if (done.has(m.id)) return;
    if (trail.includes(m.id)) throw new Error(`Circular prerequisites: ${[...trail, m.id].join(" -> ")}`);
    for (const p of [...m.prerequisites].map((id) => moduleById(id)).filter((x): x is ModuleSpec => !!x && ids.has(x.id)).sort(order)) visit(p, [...trail, m.id]);
    done.add(m.id);
    out.push(m.id);
  };
  [...mods].sort(order).forEach((m) => visit(m, []));
  return out;
}

export const pathwayHours = (path: PathwaySpec) => pathwayModules(path).reduce((sum, m) => sum + m.hours, 0);

/** Modules that more than one programme in the pathway depends on: taught once, never repeated. */
export function sharedInPathway(path: PathwaySpec): string[] {
  return pathwayModules(path).filter((m) => m.id.startsWith("SH-")).map((m) => m.id);
}

export const programmeByCode = (code: ProgrammeCode) => PROGRAMMES.find((p) => p.code === code);
