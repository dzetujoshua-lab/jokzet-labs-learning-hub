/**
 * How much animated background each part of the product gets. The public homepage is rich; the learner's dashboard is medium;
 * pages for reading, scheduling and doing work are quiet; assessment, evidence and reviewer screens are almost still, so the
 * evidence, the rubric and the feedback stay in front. Anything not listed is "low".
 */
export type Atmosphere = "rich" | "medium" | "low" | "minimal";

const MINIMAL = ["/assessments", "/review", "/evidence", "/settings", "/privacy"];

export function atmosphereFor(pathname: string): Atmosphere {
  if (pathname === "/welcome") return "rich";
  if (pathname === "/" || pathname === "/login" || pathname === "/register") return "medium";
  if (MINIMAL.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "minimal";
  return "low"; // departments, courses, missions (learning materials), timetable, portfolio, onboarding and the rest
}
