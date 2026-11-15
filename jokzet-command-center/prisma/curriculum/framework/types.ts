/**
 * Curriculum framework: programmes, levels, modules, competencies and pathways, as reviewed code.
 *
 * This is the layer ABOVE missions. Missions (prisma/curriculum/level0.ts and later files) stay as they are; a module groups
 * the missions that build one coherent capability, and says what must be demonstrated, not what must be read.
 *
 * Nothing here is published to learners. Every module starts as DRAFT; only APPROVED content may be assigned, and the
 * status changes in the pull request that approves it (see docs/curriculum/MASTER_CURRICULUM_ARCHITECTURE.md).
 *
 * Pure data and types, no database access, so tests and scripts can import it.
 */

export const LEVELS = [0, 1, 2, 3, 4] as const;
export type Level = (typeof LEVELS)[number];

/** DRAFT then IN_REVIEW then APPROVED then PUBLISHED, and RETIRED at the end (maps to the platform's ARCHIVED). */
export const CONTENT_STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "RETIRED"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Programme codes. `fswd`, `uxui`, `sec`, `photo`, `video`, `ai`, `biz` and `cloud` are existing department codes (the `sysadmin` department is folded into `cloud`, pending an owner decision); `gfx` (Graphic Design) is new; `sh` is the shared core. */
export const PROGRAMME_CODES = ["fswd", "uxui", "sec", "photo", "video", "gfx", "ai", "biz", "cloud"] as const;
export type ProgrammeCode = (typeof PROGRAMME_CODES)[number];

/** What a learner hands in. Matches the platform's evidence types (src/lib/programme.ts) plus kinds the engine will inspect. */
export const EVIDENCE_KINDS = ["SCREENSHOT", "PHOTO", "VIDEO", "CODE", "DOCUMENT", "LINK", "REPOSITORY", "LIVE_SITE", "DESIGN_FILE", "AUDIO"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Rubric families, defined in rubrics.ts. A module names the family its missions are scored with. */
export const RUBRIC_FAMILIES = ["WEB", "UXUI", "SECURITY", "PHOTO", "VIDEO", "GRAPHIC", "AI_AUTOMATION", "BUSINESS", "CLOUD_INFRA"] as const;
export type RubricFamily = (typeof RUBRIC_FAMILIES)[number];

export type ModuleSpec = {
  /** e.g. FSWD-L1-M03 (programme, level, sequence). Shared modules use SH-. Never reused, never renumbered. */
  id: string;
  level: Level;
  title: string;
  /** An observable outcome: what the learner can do and show afterwards. Not "understand" or "learn". */
  outcome: string;
  /** Realistic learner hours for the whole module, including practice and the submission. A planning estimate, to be calibrated by a pilot. */
  hours: number;
  /** Module ids that must be demonstrated first. May point at shared modules or, rarely, at another programme. */
  prerequisites: string[];
  /** Competency slugs from the owning programme's `competencies` table. */
  competencies: string[];
  evidence: EvidenceKind[];
  rubric: RubricFamily;
  /** A substantial integrating project rather than a skill module. */
  capstone?: boolean;
  /** Always DRAFT in this phase. */
  status: ContentStatus;
};

export type ProgrammeSpec = {
  code: ProgrammeCode;
  name: string;
  /** The five level outcomes, index = level. Each says what the learner can demonstrate at that level. */
  levelOutcomes: [string, string, string, string, string];
  /** slug -> what the learner can do. Slugs are unique within a programme. */
  competencies: Record<string, string>;
  modules: ModuleSpec[];
};

export type SharedSpec = {
  code: "sh";
  name: string;
  competencies: Record<string, string>;
  modules: ModuleSpec[];
};

export type PathwaySpec = {
  code: string;
  name: string;
  /** The job or capability the learner can show at the end. */
  targetOutcome: string;
  requiredProgrammes: ProgrammeCode[];
  optionalProgrammes: ProgrammeCode[];
  /** Highest level required in each required programme (a pathway rarely needs Level 4 everywhere). */
  requiredLevels: Partial<Record<ProgrammeCode, Level>>;
  /** Choose some programmes from a list instead of requiring them all (custom combinations stay possible). */
  electives?: { pick: number; from: ProgrammeCode[]; level: Level };
  /** Capstone module ids that finish the pathway. Each must be inside the required programmes and levels. */
  capstones: string[];
  /** What must be demonstrated (competency slugs, written programme:slug), not hours spent. */
  competencyRequirements: string[];
};

/** Concise builder so programme files stay readable. Status is always DRAFT. */
export function mod(
  id: string,
  level: Level,
  title: string,
  outcome: string,
  hours: number,
  prerequisites: string[],
  competencies: string[],
  evidence: EvidenceKind[],
  rubric: RubricFamily,
  capstone = false,
): ModuleSpec {
  return { id, level, title, outcome, hours, prerequisites, competencies, evidence, rubric, ...(capstone ? { capstone } : {}), status: "DRAFT" };
}
