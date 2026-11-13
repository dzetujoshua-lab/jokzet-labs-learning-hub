import { detectSecrets } from "../../src/lib/evidence/secrets";
import { EVIDENCE_TYPES, MISSION_KINDS, toEnum } from "../../src/lib/programme";
import type { DepartmentSpec, MissionSpec } from "./level0";

/**
 * Quality gates for curriculum-as-code. Pure functions (no database), used by the seed so a bad mission can never be
 * published, and by the tests. Each function returns human-readable problems; an empty list means valid.
 */

export const MISSION_CODE = /^[A-Z]+-L\d+-\d{2}$/; // same shape the mission route and actions accept
const KINDS = new Set(MISSION_KINDS.map(toEnum));
const EVIDENCE = new Set(EVIDENCE_TYPES.map(toEnum));

const blank = (v: unknown) => typeof v !== "string" || v.trim() === "";

function textOf(m: MissionSpec): string[] {
  return [
    m.title, m.objective, m.experiment, m.show, m.remediation,
    ...m.tools, ...m.skills, ...m.watch, ...m.doSteps,
    ...m.rubric.flatMap(([name, description]) => [name, description]),
  ];
}

export function missionProblems(m: MissionSpec): string[] {
  const p: string[] = [];
  const at = (msg: string) => p.push(`${m.code}: ${msg}`);

  if (!MISSION_CODE.test(m.code)) at(`code must look like FSWD-L0-01`);
  if (blank(m.title) || m.title.length > 120) at("title is required and at most 120 characters");
  if (blank(m.objective)) at("objective is required");
  if (!Number.isInteger(m.minutes) || m.minutes < 5 || m.minutes > 480) at("minutes must be a whole number from 5 to 480");
  if (!KINDS.has(m.kind)) at(`kind must be one of ${[...KINDS].join(", ")}`);
  if (!EVIDENCE.has(m.evidence)) at(`evidence must be one of ${[...EVIDENCE].join(", ")}`);
  if (!Number.isInteger(m.xp) || m.xp < 0 || m.xp > 200) at("xp must be a whole number from 0 to 200");

  // All four learning stages must exist and carry real instructions (WATCH, DO, EXPERIMENT, SHOW).
  if (!m.watch.length || m.watch.some(blank)) at("missing WATCH instructions");
  if (!m.doSteps.length || m.doSteps.some(blank)) at("missing DO steps");
  if (blank(m.experiment)) at("missing EXPERIMENT challenge");
  if (blank(m.show)) at("missing SHOW deliverable");
  if (blank(m.remediation)) at("missing remediation advice");

  if (m.role === "BASELINE") {
    // A baseline is placement only: it can never carry XP or skills, so it can never be mistaken for earned work.
    if (m.xp !== 0) at("a baseline mission must have xp 0");
    if (m.skills.length) at("a baseline mission must not teach skills");
  } else if (!m.skills.length) at("at least one skill is required");
  if (new Set(m.skills).size !== m.skills.length) at("skills list has duplicates");

  // Rubric: complete, positive, totalling exactly 100.
  if (m.rubric.length < 2) at("rubric needs at least two criteria");
  for (const [i, [name, description, points]] of m.rubric.entries()) {
    if (blank(name) || blank(description)) at(`rubric criterion ${i + 1} needs a name and a description`);
    if (!Number.isInteger(points) || points <= 0) at(`rubric criterion ${i + 1} needs positive whole points`);
  }
  const total = m.rubric.reduce((sum, [, , points]) => sum + (Number.isFinite(points) ? points : 0), 0);
  if (total !== 100) at(`rubric points sum to ${total}, expected 100`);

  // No credentials in published content (the repository is public).
  for (const t of textOf(m)) {
    const found = detectSecrets(t);
    if (found.length) {
      at(`content contains ${found[0]}`);
      break;
    }
  }
  return p;
}

export function curriculumProblems(specs: DepartmentSpec[]): string[] {
  const p: string[] = [];
  const codes = new Set<string>();
  const departments = new Set<string>();
  for (const spec of specs) {
    if (departments.has(spec.code)) p.push(`${spec.code}: department listed twice`);
    departments.add(spec.code);
    if (blank(spec.milestone)) p.push(`${spec.code}: level milestone is required`);
    const skillNames = spec.skills.map(([name]) => name);
    if (new Set(skillNames).size !== skillNames.length) p.push(`${spec.code}: duplicate skill names`);
    for (const m of spec.missions) {
      if (codes.has(m.code)) p.push(`${m.code}: mission code used twice`);
      codes.add(m.code);
      p.push(...missionProblems(m));
      for (const s of m.skills) if (!skillNames.includes(s)) p.push(`${m.code}: unknown skill "${s}" (declare it in the department's skills)`);
    }
  }
  return p;
}

export function assertValidCurriculum(specs: DepartmentSpec[]): void {
  const problems = curriculumProblems(specs);
  if (problems.length) throw new Error(`Curriculum failed validation, nothing was seeded:\n - ${problems.join("\n - ")}`);
}

/**
 * Did the rubric (criteria text, points, order or passing score) change from what is stored? A change bumps the rubric
 * version, so scores given earlier keep their meaning (they also carry their own criterion snapshots).
 */
export function rubricChanged(
  existing: { passingScore: number; criteria: { name: string; description: string; maxPoints: number }[] },
  spec: { passingScore: number; rubric: [string, string, number][] },
): boolean {
  if (existing.passingScore !== spec.passingScore) return true;
  if (existing.criteria.length !== spec.rubric.length) return true;
  return spec.rubric.some(([name, description, maxPoints], i) => {
    const c = existing.criteria[i];
    return !c || c.name !== name || c.description !== description || c.maxPoints !== maxPoints;
  });
}
