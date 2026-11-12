import { z } from "zod";
import { DEPARTMENTS } from "@/lib/departments";
import { secretIssue } from "@/lib/evidence/secrets";
import { EVIDENCE_TYPES, MISSION_KINDS } from "@/lib/programme";

/** Learner free text must never hold passwords, keys or tokens (same rule as evidence, feedback and submissions). */
const noSecrets = (value: string, ctx: z.RefinementCtx) => {
  const message = secretIssue(value);
  if (message) ctx.addIssue({ code: "custom", message });
};

const departmentCodes = DEPARTMENTS.map((d) => d.code) as [string, ...string[]];

export const MAX_CUSTOM_XP = 50; // Base44 let the client set any XP; the server now caps self-made missions.

export const createMissionSchema = z.object({
  title: z.string().trim().min(1, "Describe what you will do").max(120, "Keep the title under 120 characters").superRefine(noSecrets),
  departmentCode: z.enum(departmentCodes, { error: "Pick a department" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  minutes: z.coerce.number().int().min(5).max(480).default(45),
  kind: z.enum(MISSION_KINDS),
  evidenceType: z.enum(EVIDENCE_TYPES),
  xpReward: z.coerce.number().int().min(5).max(MAX_CUSTOM_XP).default(25),
  notes: z.string().trim().max(500).superRefine(noSecrets).optional().default(""),
});
export type CreateMissionInput = z.infer<typeof createMissionSchema>;

export const milestoneSchema = z.string().trim().max(200, "Keep the milestone under 200 characters").superRefine(noSecrets);
