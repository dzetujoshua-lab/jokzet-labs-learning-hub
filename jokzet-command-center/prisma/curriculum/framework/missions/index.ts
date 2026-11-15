import { BIZ_L0 } from "./biz-l0";
import { BIZ_L1 } from "./biz-l1";
import { FSWD_L0 } from "./fswd-l0";
import { FSWD_L1 } from "./fswd-l1";
import { SHARED_L0 } from "./shared-l0";
import { SHARED_L1 } from "./shared-l1";
import type { MissionDraft } from "./types";

export * from "./types";

/**
 * Every mission draft written so far. Pilot programmes: Full-Stack Web Development and Business and Entrepreneurship, Levels 0 and 1,
 * plus the shared core modules those programmes depend on (computer and internet, digital safety, HTML, CSS, JavaScript,
 * accessibility and Git).
 */
export const MISSION_DRAFTS: MissionDraft[] = [...FSWD_L0, ...BIZ_L0, ...SHARED_L0, ...SHARED_L1, ...FSWD_L1, ...BIZ_L1];

export const missionsForModule = (moduleId: string) => MISSION_DRAFTS.filter((m) => m.moduleId === moduleId);
