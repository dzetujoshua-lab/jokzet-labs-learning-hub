// Prints the validation result and statistics for the mission drafts. Read-only: no database.
//   npx tsx scripts/mission-report.ts
import { MISSION_DRAFTS } from "../prisma/curriculum/framework/missions";
import { missionSetProblems, missionStats } from "../prisma/curriculum/framework/missions/validate";

const problems = missionSetProblems(MISSION_DRAFTS);
console.log(JSON.stringify(missionStats(MISSION_DRAFTS), null, 2));
console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join("\n- ")}` : "\nValidation passed: 0 problems.");
process.exitCode = problems.length ? 1 : 0;
