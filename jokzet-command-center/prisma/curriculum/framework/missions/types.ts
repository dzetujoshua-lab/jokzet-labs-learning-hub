/**
 * Mission drafts: the mission-level content under a framework module. Each follows WATCH, DO, EXPERIMENT, SHOW, GET ASSESSED.
 *
 * Differences from the legacy mission format (prisma/curriculum/level0.ts), on purpose:
 *  - a mission belongs to a module (`moduleId`) and develops that module's competencies, not free-text skills;
 *  - WATCH describes what an approved resource MUST show (a brief to a curator). It never contains a URL: no resource is invented,
 *    and the mission stays out of learner plans until a named reviewer approves a real resource for it;
 *  - `verification` lists objective checks an assessor (human today, the Assessment Engine later) can make on the submitted work;
 *  - the rubric uses the module's rubric-family criteria for most of its points so scores map to what can actually be inspected.
 *
 * Everything is DRAFT. Pure data, no database access.
 */

export type MissionKind = "BUILD" | "DESIGN" | "DRILL" | "STUDY" | "SHOOT" | "EDIT" | "WRITE" | "SHIP";
export type MissionEvidence = "SCREENSHOT" | "PHOTO" | "VIDEO" | "CODE" | "DOCUMENT" | "LINK";

export type MissionDraft = {
  /** Same shape the platform accepts today: PROGRAMME-Ln-NN. New codes continue after the legacy ones; codes are never reused. */
  code: string;
  moduleId: string;
  title: string;
  /** What the learner can do afterwards, observably. */
  objective: string;
  /** Total learner minutes including WATCH. A single sitting: 20 to 240. */
  minutes: number;
  kind: MissionKind;
  /** The kind of evidence the learner submits for this mission. */
  evidence: MissionEvidence;
  /** Whole number, in fives; about 0.35 to 0.5 per minute. Never inflated. */
  xp: number;
  tools: string[];
  /** Competency slugs, a subset of the module's competencies. */
  competencies: string[];
  watch: {
    /** Minutes the resource should take. Practical work must dominate, so at most 35% of the mission. */
    minutes: number;
    /** What the demonstration must show, written for the person who will find and approve the resource. */
    brief: string;
    /** Specific things the resource must show or explain, so a curator can check it against the mission. */
    mustShow: string[];
  };
  /** Ordered, imperative, guided practical steps. */
  doSteps: string[];
  /** An independent challenge that encourages exploring and problem solving. */
  experiment: string;
  /** The tangible deliverable and exactly what to submit. */
  show: string;
  /** Objective checks an assessor can make on the submission. */
  verification: string[];
  /** What to do when the work does not pass. */
  remediation: string;
  /** Criteria names come from the module's rubric family where they fit; points total 100. */
  rubric: { criterion: string; description: string; points: number }[];
  status: "DRAFT";
};
