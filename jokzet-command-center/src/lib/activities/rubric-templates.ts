/**
 * Rubric templates for personal activities. A learner-defined activity is only assessable once it has a rubric, and the
 * rubric must come from here (reviewed, versioned content) rather than from free text. Each template totals exactly
 * 100 points, like curriculum rubrics, and passes at 70%. Pure data: safe on server and client.
 *
 * Bump `version` when a template's criteria change; activities copy the criteria at creation, so existing activities keep
 * the wording they were created with.
 */

export type RubricTemplate = {
  key: string;
  label: string;
  suits: string;
  version: number;
  passingScore: number;
  criteria: [name: string, description: string, points: number][];
};

export const RUBRIC_TEMPLATES: RubricTemplate[] = [
  {
    key: "build",
    label: "Build something that works",
    suits: "Websites, apps, scripts and tools",
    version: 1,
    passingScore: 70,
    criteria: [
      ["Working result", "The deliverable runs and does what the objective says, shown with evidence.", 35],
      ["Quality of the work", "Structure, naming and clarity make it understandable and maintainable.", 25],
      ["Testing and edge cases", "You tried it with unusual input and fixed or noted what broke.", 20],
      ["Explanation", "You can explain how it works and what you would change next.", 20],
    ],
  },
  {
    key: "design",
    label: "Design and present",
    suits: "Interfaces, layouts, posters and brand work",
    version: 1,
    passingScore: 70,
    criteria: [
      ["Meets the brief", "The design answers the objective for a clear audience.", 30],
      ["Visual hierarchy and layout", "Spacing, size and contrast guide the eye to what matters.", 25],
      ["Accessibility", "Colour contrast, text size and structure work for people with different needs.", 20],
      ["Rationale", "You explain the choices you made and what you rejected.", 25],
    ],
  },
  {
    key: "security-lab",
    label: "Authorised security lab",
    suits: "Cybersecurity exercises on your own lab or with written permission",
    version: 1,
    passingScore: 70,
    criteria: [
      ["Authorised scope", "Everything was done only on systems you own or have written permission to test, and the scope is stated.", 30],
      ["Method and evidence", "Steps are documented with screenshots or logs that someone else could follow.", 25],
      ["Findings and impact", "Findings are accurate and the risk of each is explained.", 25],
      ["Fixes and safe handling", "You recommend practical fixes and describe how you cleaned up and protected data.", 20],
    ],
  },
  {
    key: "automation",
    label: "Automate a task",
    suits: "Scripts, workflows and AI-assisted tools",
    version: 1,
    passingScore: 70,
    criteria: [
      ["Automation works", "The task runs end to end and produces the expected result, shown with evidence.", 35],
      ["Reliability and limits", "You tested failures, wrong input and the limits of the tool, and wrote them down.", 25],
      ["Safety and secrets", "No keys or private data are exposed; permissions are minimal.", 20],
      ["Documentation", "Someone else could run it from your notes.", 20],
    ],
  },
  {
    key: "study",
    label: "Study and apply",
    suits: "Learning a concept, tool or framework and using it once",
    version: 1,
    passingScore: 70,
    criteria: [
      ["Understanding", "You explain the idea in your own words and get the key points right.", 35],
      ["Application", "You used it in a small practical example, shown with evidence.", 25],
      ["Examples and sources", "You name what you learned from and give at least one concrete example.", 20],
      ["Reflection", "You say what was hard, what you would do differently, and what to learn next.", 20],
    ],
  },
  {
    key: "creative",
    label: "Photo, video or media piece",
    suits: "Photography, video, audio and written pieces",
    version: 1,
    passingScore: 70,
    criteria: [
      ["Meets the brief", "The piece answers the objective and stays on subject.", 30],
      ["Technical quality", "Exposure, focus, audio and export are handled well for the medium.", 25],
      ["Composition and storytelling", "Framing, pacing and choices make the piece engaging.", 25],
      ["Notes on process", "You explain your settings, tools and what you would improve.", 20],
    ],
  },
];

export const RUBRIC_TEMPLATE_KEYS = RUBRIC_TEMPLATES.map((t) => t.key) as [string, ...string[]];

export const getRubricTemplate = (key: string) => RUBRIC_TEMPLATES.find((t) => t.key === key) ?? null;

/** Problems with a template (empty = valid). Used by the tests so a bad template can never ship. */
export function templateProblems(t: RubricTemplate): string[] {
  const p: string[] = [];
  const total = t.criteria.reduce((s, [, , points]) => s + points, 0);
  if (total !== 100) p.push(`${t.key}: points sum to ${total}, expected 100`);
  if (t.criteria.length < 3) p.push(`${t.key}: needs at least three criteria`);
  for (const [name, description, points] of t.criteria) {
    if (!name.trim() || !description.trim()) p.push(`${t.key}: every criterion needs a name and description`);
    if (!Number.isInteger(points) || points <= 0) p.push(`${t.key}: "${name}" needs positive whole points`);
  }
  return p;
}
