import type { Prisma } from "@/generated/prisma/client";

/**
 * "Earned" work: missions that count towards XP, skills, the portfolio, analytics and the dashboard. A baseline mission
 * is a placement exercise: it is assessed and recorded, but it must never appear in anything that measures achievement.
 * Every query that counts or lists achievement applies this fragment (and each has a test).
 */
export const earnedMission = { role: { not: "BASELINE" } } as const satisfies Prisma.MissionWhereInput;
