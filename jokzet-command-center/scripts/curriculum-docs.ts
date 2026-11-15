// Generates the curriculum documents from the framework data so the documents can never disagree with it.
//   npx tsx scripts/curriculum-docs.ts            (writes ../docs/curriculum/*.md)
// Read-only with respect to the app and database. Run it again after any change to prisma/curriculum/framework.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ALL_MODULES, PATHWAYS, PROGRAMMES, RUBRICS, SHARED, moduleById, pathwayHours, pathwaySequence } from "../prisma/curriculum/framework";
import { frameworkProblems, frameworkStats, programmesUsing } from "../prisma/curriculum/framework/validate";
import type { ModuleSpec, ProgrammeSpec } from "../prisma/curriculum/framework";

const out = path.resolve(import.meta.dirname, "../../docs/curriculum");
mkdirSync(out, { recursive: true });
const write = (name: string, body: string) => writeFileSync(path.join(out, name), body.trimEnd() + "\n");

const LEVEL_NAMES = ["Level 0 — Foundation", "Level 1 — Beginner", "Level 2 — Intermediate", "Level 3 — Advanced", "Level 4 — Expert"];
const DATE = "2026-11-15";
const row = (m: ModuleSpec) =>
  `| ${m.id}${m.capstone ? " (capstone)" : ""} | ${m.title} | ${m.hours} | ${m.prerequisites.join(", ") || "none"} | ${m.evidence.join(", ")} | ${m.rubric} |`;

function programmeDoc(p: ProgrammeSpec, file: string) {
  const lines = [
    `# ${p.name} curriculum`,
    "",
    `Generated ${DATE} from \`prisma/curriculum/framework/${p.code}.ts\`. Status of every module: **DRAFT** (not assigned to learners). Hours are planning estimates to be calibrated by a pilot. Mission-level instructions (WATCH, DO, EXPERIMENT, SHOW) and approved resources are **not yet written** for Levels 1 to 4; see the integration plan.`,
    "",
    "## Level outcomes",
    ...p.levelOutcomes.map((o, i) => `- **${LEVEL_NAMES[i]}:** ${o}`),
    "",
    `Total module hours: ${p.modules.reduce((s, m) => s + m.hours, 0)} (excluding shared modules).`,
    "",
  ];
  for (const level of [0, 1, 2, 3, 4] as const) {
    const mods = p.modules.filter((m) => m.level === level);
    lines.push(`## ${LEVEL_NAMES[level]}`, "", `${mods.reduce((s, m) => s + m.hours, 0)} hours across ${mods.length} modules.`, "", "| Module | Title | Hours | Prerequisites | Evidence | Rubric |", "|---|---|---|---|---|---|", ...mods.map(row), "");
    for (const m of mods) lines.push(`**${m.id} ${m.title}.** ${m.outcome}`, "", `Competencies: ${m.competencies.map((c) => `\`${c}\``).join(", ")}.`, "");
  }
  lines.push("## Competencies", "", "| Competency | What the learner can do |", "|---|---|", ...Object.entries(p.competencies).map(([k, v]) => `| \`${k}\` | ${v} |`));
  write(file, lines.join("\n"));
}

programmeDoc(PROGRAMMES[0], "WEB_DEVELOPMENT_CURRICULUM.md");
programmeDoc(PROGRAMMES[1], "UI_UX_DESIGN_CURRICULUM.md");
programmeDoc(PROGRAMMES[2], "CYBERSECURITY_CURRICULUM.md");
programmeDoc(PROGRAMMES[3], "PHOTOGRAPHY_CURRICULUM.md");
programmeDoc(PROGRAMMES[4], "VIDEO_EDITING_CURRICULUM.md");
programmeDoc(PROGRAMMES[5], "GRAPHIC_DESIGN_CURRICULUM.md");
programmeDoc(PROGRAMMES[6], "AI_AUTOMATION_CURRICULUM.md");
programmeDoc(PROGRAMMES[7], "BUSINESS_ENTREPRENEURSHIP_CURRICULUM.md");
programmeDoc(PROGRAMMES[8], "CLOUD_SERVER_ADMINISTRATION_CURRICULUM.md");

// Programme catalogue
const DEPARTMENT: Record<string, string> = {
  fswd: "fswd (existing)", uxui: "uxui (existing)", sec: "sec (existing)", photo: "photo (existing)", video: "video (existing)",
  gfx: "gfx (NEW department needed)", ai: "ai (existing)", biz: "biz (existing, 'Business and Career Development')",
  cloud: "cloud (existing); the existing 'sysadmin' department is folded into this programme, pending an owner decision",
};
write(
  "PROGRAMME_CATALOGUE.md",
  [
    "# Programme catalogue",
    "",
    `Generated ${DATE}. Nine official programmes. Every module is DRAFT; no programme is open to learners through this curriculum yet.`,
    "",
    "| Programme | Code | Department in the database | Modules | Capstones | Module hours | Level 0 hours |",
    "|---|---|---|---|---|---|---|",
    ...PROGRAMMES.map(
      (p) =>
        `| ${p.name} | ${p.code} | ${DEPARTMENT[p.code]} | ${p.modules.length} | ${p.modules.filter((m) => m.capstone).length} | ${p.modules.reduce((x, m) => x + m.hours, 0)} | ${p.modules.filter((m) => m.level === 0).reduce((x, m) => x + m.hours, 0)} |`,
    ),
    `| Shared core | sh | n/a (referenced as prerequisites) | ${SHARED.modules.length} | 0 | ${SHARED.modules.reduce((x, m) => x + m.hours, 0)} | ${SHARED.modules.filter((m) => m.level === 0).reduce((x, m) => x + m.hours, 0)} |`,
    "",
    "Any programme can be taken on its own or combined with any other; learners are never required to take all nine. The Cloud and Server Administration programme additionally supports Full-Stack Web Development, Cybersecurity and Ethical Hacking, AI and Automation, and Business and Entrepreneurship (see LEARNING_PATHWAYS.md).",
    "",
    "Cloud and Server Administration is larger than the others because the brief lists many practical areas; it can be taken in stages (Levels 0 to 2 are a complete hosting skill set).",
  ].join("\n"),
);

// Shared core
write(
  "SHARED_CORE_MODULES.md",
  [
    "# Shared core modules",
    "",
    `Generated ${DATE}. These modules are taught once and reused as prerequisites, so a learner who has demonstrated one never repeats it.`,
    "",
    "| Module | Title | Hours | Used by programmes |",
    "|---|---|---|---|",
    ...SHARED.modules.map((m) => `| ${m.id} | ${m.title} | ${m.hours} | ${[...programmesUsing(m.id)].sort().join(", ")} |`),
    "",
    ...SHARED.modules.flatMap((m) => [`**${m.id} ${m.title}.** ${m.outcome}`, ""]),
  ].join("\n"),
);

// Pathways
write(
  "LEARNING_PATHWAYS.md",
  [
    "# Learning pathways",
    "",
    `Generated ${DATE}. A pathway lists what to complete; the module list and recommended order are derived from the programmes, so shared modules are never repeated. Learners are never required to take all eight programmes, and can combine programmes freely instead of using a pathway. Hours are planning estimates (including prerequisites and shared modules). At 10 study hours a week, divide by 10 for weeks.`,
    "",
    ...PATHWAYS.flatMap((p) => {
      const seq = pathwaySequence(p);
      const hours = pathwayHours(p);
      return [
        `## ${p.name}`,
        "",
        `**Target outcome:** ${p.targetOutcome}`,
        "",
        `- Required programmes and highest level: ${p.requiredProgrammes.map((c) => `${c} to Level ${p.requiredLevels[c]}`).join("; ")}`,
        `- Optional programmes: ${p.optionalProgrammes.join(", ") || "none"}`,
        p.electives ? `- Electives: choose ${p.electives.pick} of ${p.electives.from.join(", ")} to Level ${p.electives.level} (not counted in the totals below)` : "- Electives: none",
        `- Shared core modules used: ${seq.filter((id) => id.startsWith("SH-")).join(", ") || "none"}`,
        `- Capstones: ${p.capstones.join(", ")}`,
        `- Competencies to demonstrate: ${p.competencyRequirements.join(", ")}`,
        `- Size: ${seq.length} modules, about ${hours} hours (${Math.round(hours / 10)} weeks at 10 hours a week)`,
        "",
        "Recommended sequence:",
        "",
        seq.map((id, i) => `${i + 1}. ${id} ${moduleById(id)!.title} (${moduleById(id)!.hours} h)`).join("\n"),
        "",
      ];
    }),
  ].join("\n"),
);

// Rubrics
write(
  "CURRICULUM_ASSESSMENT_RUBRICS.md",
  [
    "# Curriculum assessment rubrics",
    "",
    `Generated ${DATE} from \`prisma/curriculum/framework/rubrics.ts\`. Each module names one rubric family; a mission's own rubric (criteria and points) is authored at mission level and must follow its family. Weights total 100.`,
    "",
    "**Inspection rule:** each criterion lists the capabilities that can judge it. If a criterion lists only HUMAN, or its capabilities do not exist yet, a reviewer scores it. The AI is never asked to judge evidence it cannot actually inspect. Capabilities that do not exist yet: GITHUB_REPOSITORY, LIVE_SITE_BROWSER, IMAGE_VISION, SANDBOX_EXECUTION, MEDIA_ANALYSIS (the Assessment Engine is not built); DOCUMENT_TEXT and FILE_INSPECTION are the only ones close to existing.",
    "",
    ...RUBRICS.flatMap((r) => [
      `## ${r.name} (${r.family})`,
      "",
      r.gate ? `**Gate:** ${r.gate}` : "",
      "",
      "| Criterion | Weight | What good looks like | Can be judged by |",
      "|---|---|---|---|",
      ...r.criteria.map((c) => `| ${c.name} | ${c.weight} | ${c.description} | ${c.inspect.join(", ")} |`),
      "",
      `Used by ${ALL_MODULES.filter((m) => m.rubric === r.family).length} modules.`,
      "",
    ]),
  ].join("\n"),
);

// Resource catalogue (honest: nothing verified)
const perProgramme = PROGRAMMES.map((p) => `| ${p.name} | ${p.modules.length} | 0 | ${p.modules.length} |`);
write(
  "CURRICULUM_RESOURCE_CATALOG.md",
  [
    "# Curriculum resource catalogue",
    "",
    `Generated ${DATE}.`,
    "",
    "## Status: no resource is verified",
    "",
    "**0 resources are approved. No link has been invented, and none is claimed to be verified.** The platform's catalogue (`prisma/curriculum/resources.ts`) is empty by design: an entry needs a named human reviewer who has opened the link, plus an approval record. This document defines what must be curated; it does not contain URLs.",
    "",
    "| Programme | Modules | Modules with an approved primary WATCH resource | Modules still needing curation |",
    "|---|---|---|---|",
    ...perProgramme,
    `| Shared core | ${SHARED.modules.length} | 0 | ${SHARED.modules.length} |`,
    "",
    "## Record required for every resource",
    "",
    "Title, provider, URL, resource type (video, playlist, documentation, interactive, demonstration, starter repository, dataset, template), programme, module and mission, difficulty, language, duration where known, attribution and licence note, verification status, last-checked date, approver and approval date.",
    "",
    "## Curation rules",
    "",
    "1. Prefer high-quality video lessons and demonstrations for WATCH; official documentation is supplementary only.",
    "2. A reviewer opens the link, confirms it teaches the module's outcome at the right level, and records the date. Links are re-checked on a schedule.",
    "3. A mission with no approved primary resource is flagged for curation and shown to learners as such; it is never filled with a guess.",
    "4. Free and open resources first; any resource requiring payment is marked and never the only route.",
    "5. Content for Ghanaian and international contexts (business, law, payments) is reviewed by someone qualified in that context.",
    "",
    "## Curation workload (Recommendation)",
    "",
    `Each module needs at least one primary resource and ideally one supplementary one: about ${ALL_MODULES.length} primary resources for ${ALL_MODULES.length} modules, more once missions are written (each mission needs its own WATCH resource). Treat curation as a human editorial task with named reviewers, run in the order the pilot programmes need.`,
  ].join("\n"),
);

// Validation report
const problems = frameworkProblems();
const stats = frameworkStats();
write(
  "CURRICULUM_VALIDATION_REPORT.md",
  [
    "# Curriculum validation report",
    "",
    `Generated ${DATE} by \`npx tsx scripts/curriculum-report.ts\` logic (\`prisma/curriculum/framework/validate.ts\`), also enforced by \`tests/curriculum-framework.test.ts\`.`,
    "",
    `**Result: ${problems.length === 0 ? "PASSED, 0 problems" : `${problems.length} problem(s)`}.**`,
    problems.length ? "\n" + problems.map((p) => `- ${p}`).join("\n") : "",
    "",
    "## What was measured (Verified by running the validator)",
    "",
    `- Programmes: ${stats.programmes}. Shared core modules: ${stats.sharedModules}. Total modules: ${stats.modules}. Capstones: ${stats.capstones}.`,
    `- Status: ${Object.entries(stats.byStatus).map(([k, v]) => `${v} ${k}`).join(", ")} (nothing approved or published).`,
    `- Module hours by programme: ${Object.entries(stats.hoursByProgramme).map(([k, v]) => `${k} ${v}`).join(", ")}.`,
    "",
    "## Checks the validator performs",
    "",
    "unique module ids and titles; id format and level agreement; valid prerequisites; no circular prerequisites; no prerequisite at a higher level; same-level prerequisites earlier in the sequence; contiguous module numbering; all five levels in every programme with at least three modules each; Foundation level at most 40 hours; a capstone before Level 4 and at Level 4; capstones at least 20 hours; observable (non-vague) outcomes; realistic hours; competencies defined and each taught by some module; evidence kinds and rubric families valid; rubric weights total 100 with inspection capabilities; photography modules accept the learner's own photographs; security outcomes confined to authorised environments; shared modules needed by at least two programmes; pathways reference real programmes, capstones and competencies and have a valid prerequisite-first sequence.",
    "",
    "## Not yet validated (Not done)",
    "",
    "- **Resources:** none exist, so resource availability cannot pass.",
    "- **Missions:** module-level only. Mission specifications (WATCH, DO, EXPERIMENT, SHOW, remediation, rubric points) for Levels 1 to 4 are not written, so mission-level checks do not yet apply to them. Existing Level 0 missions are validated by the existing mission validator.",
    "- **Timetable compatibility:** modules carry hours, not missions, so generating a plan from this framework is untested. See the integration plan.",
    "- **Subject-matter accuracy:** the module outcomes were written from general professional knowledge and have not been reviewed by a practitioner in each field. Each programme needs a named subject reviewer before any module is APPROVED.",
    "- **Realism of hours:** planning estimates only; calibrate with a pilot.",
    "- **Infrastructure labs:** no lab environment has been provisioned and no server, cloud, container or cPanel exercise has been run or verified. Every Cloud and Server Administration module is DRAFT and must stay so until its exercise has been executed end to end in a real lab by a reviewer. cPanel and WHM exercises are pending lab access (they need a licence or trial). Cloud exercises need cost caps confirmed against current provider free tiers, which have not been checked.",
  ].join("\n"),
);

console.log(`Wrote documents to ${out}`);
