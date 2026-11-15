// Generates the mission review documents from the mission drafts, so reviewers read exactly what the validator checked.
//   npx tsx scripts/mission-docs.ts      (writes ../docs/curriculum/missions/*.md)
// Read-only with respect to the app and database.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { moduleById } from "../prisma/curriculum/framework";
import { LEVEL0 } from "../prisma/curriculum/level0";
import { MISSION_DRAFTS, type MissionDraft } from "../prisma/curriculum/framework/missions";
import { missionSetProblems, missionStats } from "../prisma/curriculum/framework/missions/validate";

const out = path.resolve(import.meta.dirname, "../../docs/curriculum/missions");
mkdirSync(out, { recursive: true });
const write = (name: string, body: string) => writeFileSync(path.join(out, name), body.trimEnd() + "\n");
const DATE = "2026-11-15";

function missionBlock(m: MissionDraft): string {
  const mod = moduleById(m.moduleId)!;
  return [
    `### ${m.code} — ${m.title}`,
    "",
    `Module ${m.moduleId} (${mod.title}) · ${m.minutes} minutes (WATCH ${m.watch.minutes}) · ${m.kind} · evidence: ${m.evidence} · ${m.xp} XP · status: ${m.status}`,
    "",
    `**Objective.** ${m.objective}`,
    "",
    `**Competencies.** ${m.competencies.map((c) => `\`${c}\``).join(", ")}. **Tools.** ${m.tools.join("; ")}.`,
    "",
    `**WATCH (${m.watch.minutes} min): resource brief for the curator, no resource approved yet.** ${m.watch.brief}`,
    "",
    "The resource must show:",
    ...m.watch.mustShow.map((s) => `- ${s}`),
    "",
    "**DO.**",
    ...m.doSteps.map((s, i) => `${i + 1}. ${s}`),
    "",
    `**EXPERIMENT.** ${m.experiment}`,
    "",
    `**SHOW.** ${m.show}`,
    "",
    "**GET ASSESSED: objective checks.**",
    ...m.verification.map((s) => `- ${s}`),
    "",
    `**If it does not pass.** ${m.remediation}`,
    "",
    "| Rubric criterion | Points | What good looks like |",
    "|---|---|---|",
    ...m.rubric.map((r) => `| ${r.criterion} | ${r.points} | ${r.description} |`),
    "",
  ].join("\n");
}

function doc(file: string, title: string, intro: string, drafts: MissionDraft[]) {
  const modules = [...new Set(drafts.map((m) => m.moduleId))];
  write(
    file,
    [
      `# ${title}`,
      "",
      `Generated ${DATE} from \`prisma/curriculum/framework/missions/\`. Status of every mission: **DRAFT**, awaiting review by a named subject reviewer. ${intro}`,
      "",
      "Reviewer checklist: Is the objective observable? Is each step doable by a beginner with the stated free tools? Is the time realistic? Is the rubric fair and does it match the checks? Is anything unsafe, unfair, culturally wrong or too expensive? Does the WATCH brief describe a resource you could actually find?",
      "",
      `${drafts.length} missions, ${drafts.reduce((s, m) => s + m.minutes, 0)} minutes, ${drafts.reduce((s, m) => s + m.xp, 0)} XP.`,
      "",
      ...modules.flatMap((id) => {
        const mod = moduleById(id)!;
        const list = drafts.filter((m) => m.moduleId === id);
        return [`## ${id} ${mod.title}`, "", `Module outcome: ${mod.outcome}`, "", `Planned ${mod.hours} hours; missions total ${list.reduce((s, m) => s + m.minutes, 0)} minutes.`, "", ...list.map(missionBlock)];
      }),
    ].join("\n"),
  );
}

const fswd = MISSION_DRAFTS.filter((m) => m.code.startsWith("FSWD-"));
const biz = MISSION_DRAFTS.filter((m) => m.code.startsWith("BIZ-"));
const shared = MISSION_DRAFTS.filter((m) => m.code.startsWith("SH-"));
doc("FSWD_MISSIONS.md", "Full-Stack Web Development: Level 0 and Level 1 missions", "Level 0 numbering continues after the legacy missions FSWD-L0-01 and FSWD-L0-02. Level 1 builds on the shared core missions (SHARED_CORE_MISSIONS.md).", fswd);
doc("SHARED_CORE_MISSIONS.md", "Shared core missions", "Shared modules are prerequisites of several programmes and are written once under the SH prefix: computer and internet fundamentals, digital safety, HTML, CSS, JavaScript, accessibility and Git.", shared);
doc("BIZ_MISSIONS.md", "Business and Entrepreneurship: Level 0 and Level 1 missions", "Level 0 numbering continues after the legacy missions BIZ-L0-01 and BIZ-L0-02. Money is in Ghana cedis and pesewas; the method works in any currency.", biz);

// Legacy reconciliation
const FIT: Record<string, [string, string]> = {
  "FSWD-L0-01": ["SH-L1-M02", "Responsive page layout is a Level 1 shared module in the framework. Keep as a legacy bridge mission or move under SH-L1-M02."],
  "FSWD-L0-02": ["SH-L1-M01", "HTML form with validation belongs with HTML5 and semantic structure (Level 1)."],
  "UXUI-L0-01": ["UXUI-L1-M04", "Wireframing a flow is Level 1 in the framework."],
  "UXUI-L0-02": ["UXUI-L0-M03", "Fits: redesign one weak screen."],
  "SEC-L0-01": ["SEC-L0-M02", "Fits: build an isolated practice lab (ethics, law and safe labs)."],
  "SEC-L0-02": ["SEC-L0-M03", "Fits: map a lab network (how networks work), with SH-L0-M04 as prerequisite."],
  "CLOUD-L0-01": ["CLOUD-L0-M03", "Fits: secure a cloud account and set a billing alert (cloud concepts and a first cloud server)."],
  "CLOUD-L0-02": ["CLOUD-L0-M03", "Fits: launch and destroy a small virtual machine."],
  "SYS-L0-01": ["CLOUD-L1-M01", "Linux command line on a server; the framework places it at Level 1 (shared SH-L1-M07 teaches the command line)."],
  "SYS-L0-02": ["CLOUD-L1-M03", "Users and permissions are Level 1 in the framework."],
  "AI-L0-01": ["AI-L0-M02", "Fits: using AI tools responsibly (testing prompts), with structured outputs later at AI-L1-M02."],
  "AI-L0-02": ["AI-L1-M01", "Scripted automation is Python for automation at Level 1."],
  "PHOTO-L0-01": ["PHOTO-L1-M01", "Three exposures is the exposure module at Level 1."],
  "PHOTO-L0-02": ["PHOTO-L0-M03", "Fits: composition practice (photo walk), with PHOTO-L1-M03 for deeper composition."],
  "VID-L0-01": ["VIDEO-L0-M03", "Fits: first edit."],
  "VID-L0-02": ["VIDEO-L1-M05", "Audio editing is Level 1 in the framework."],
  "BIZ-L0-01": ["none", "A one-page CV is career preparation, not covered by any framework module. Keep as a legacy mission, or add a career-readiness module."],
  "BIZ-L0-02": ["BIZ-L1-M03", "Value proposition is Level 1 in the framework."],
};
const legacy = LEVEL0.flatMap((d) => d.missions.map((m) => ({ dept: d.code, ...m })));
write(
  "MISSION_RECONCILIATION.md",
  [
    "# Legacy Level 0 missions versus the framework",
    "",
    `Generated ${DATE}. The platform already holds ${legacy.length} Level 0 missions (2 per department). They are untouched, live, and carry learner progress, so this is a mapping proposal, **not** a change.`,
    "",
    "| Legacy mission | Title | Best-fit module | Note |",
    "|---|---|---|---|",
    ...legacy.map((m) => {
      const [mod, note] = FIT[m.code] ?? ["unmapped", "Not yet reviewed."];
      return `| ${m.code} | ${m.title} | ${mod} | ${note} |`;
    }),
    "",
    "## What this shows",
    "",
    `- ${legacy.filter((m) => FIT[m.code]?.[0] !== "none" && FIT[m.code]?.[1].startsWith("Fits")).length} legacy missions fit a framework module well; the rest sit one level higher in the framework (for example responsive layout or Linux users are Level 1 there) or have no home.`,
    "- The legacy department list differs from the programme list: `sysadmin` (prefix `SYS`) is folded into Cloud and Server Administration, `video` uses the prefix `VID` while framework modules use `VIDEO`, and there is no Graphic Design department yet.",
    "- Mission codes are permanent, so nothing is renamed. Recommendation: keep every legacy mission as it is, link it to its best-fit module at import time (a `moduleId` on the mission), and write new missions with continuing numbers (as the pilot drafts do). The two places where the framework and the legacy level disagree need an owner decision on whether the legacy mission is shown at its legacy level or its framework level.",
  ].join("\n"),
);

// Authoring report
const problems = missionSetProblems(MISSION_DRAFTS);
const s = missionStats(MISSION_DRAFTS);
write(
  "MISSION_AUTHORING_REPORT.md",
  [
    "# Mission authoring report (pilot: Levels 0 and 1)",
    "",
    `Generated ${DATE}.`,
    "",
    `**Validation: ${problems.length === 0 ? "PASSED, 0 problems" : `${problems.length} problem(s)`}.** ${problems.map((p) => `\n- ${p}`).join("")}`,
    "",
    "## Written so far",
    "",
    `- ${s.missions} mission drafts under ${s.modules} modules: Full-Stack Web Development and Business and Entrepreneurship Levels 0 and 1, plus the 7 shared core modules they depend on (computer and internet, digital safety, HTML, CSS, JavaScript, accessibility, Git).`,
    `- ${s.minutes} learner minutes (${(s.minutes / 60).toFixed(1)} hours), of which ${s.watchMinutes} are WATCH (${Math.round((s.watchMinutes / s.minutes) * 100)}%), and ${s.xp} XP in total.`,
    `- Modules in the framework with no missions yet: ${s.modulesWithoutMissions} (all other programmes, Levels 2 to 4 of the pilot programmes, and the remaining shared modules: design principles, networks, Python, Linux, typography, composition, APIs and freelance business).`,
    "",
    "## Not done, stated plainly",
    "",
    "- **Resources: 0 approved.** Every WATCH entry is a brief for a curator. No mission can be shown to learners until a named reviewer approves a real resource for it.",
    "- **Review: none yet.** No subject reviewer has read these missions. They were written from general professional knowledge and need a practitioner's check for accuracy, level and realistic timing, and a local check of the Ghana-specific business examples.",
    "- **Not tested with a learner.** Times and XP are estimates. A pilot learner should attempt a few missions before they are approved.",
    "- **Not in the platform.** Nothing is imported into the database; the import step (integration plan, C3) does not exist yet.",
    "- **Assessment mapping.** Rubric criteria use the module's rubric family so they map to what can be inspected. Until the Assessment Engine exists, a person scores them.",
    "",
    "## What the validator enforces on every mission",
    "",
    "Valid code and prefix; level agrees with the module; objective observable and not vague; one sitting (20 to 240 minutes); WATCH at most 35% of the time so practical work dominates; at least three concrete DO steps; an EXPERIMENT and a SHOW that says what to submit; at least three objective checks; remediation advice; a 3 to 6 criterion rubric totalling 100 with a minimum share from the rubric family; honest XP (0.35 to 0.5 per minute, in fives); evidence compatible with the module; no links and no secrets; status DRAFT; unique, contiguous codes that continue after the legacy ones; and every module competency covered with minutes within 40% of the module plan.",
  ].join("\n"),
);
console.log(`Wrote mission documents to ${out}`);
