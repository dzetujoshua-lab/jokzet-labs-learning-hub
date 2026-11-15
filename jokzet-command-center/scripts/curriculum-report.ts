// Prints the curriculum framework's validation result and statistics. Read-only: no database.
//   npx tsx scripts/curriculum-report.ts
import { frameworkProblems, frameworkStats } from "../prisma/curriculum/framework/validate";

const problems = frameworkProblems();
console.log(JSON.stringify(frameworkStats(), null, 2));
console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join("\n- ")}` : "\nValidation passed: 0 problems.");
process.exitCode = problems.length ? 1 : 0;
