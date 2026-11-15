import { BIZ_L0 } from "./biz-l0";
import { FSWD_L0 } from "./fswd-l0";
import type { MissionDraft } from "./types";

export * from "./types";

/** Every mission draft written so far. Pilot programmes first: Full-Stack Web Development and Business and Entrepreneurship, Level 0. */
export const MISSION_DRAFTS: MissionDraft[] = [...FSWD_L0, ...BIZ_L0];

export const missionsForModule = (moduleId: string) => MISSION_DRAFTS.filter((m) => m.moduleId === moduleId);
