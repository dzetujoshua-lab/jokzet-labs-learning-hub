import { ALL_MODULES, PATHWAYS, PROGRAMMES, RUBRICS, SHARED, moduleById, pathwayHours, pathwayModules, pathwaySequence } from "./index";
import { CAPABILITIES } from "./rubrics";
import { CONTENT_STATUSES, EVIDENCE_KINDS, LEVELS, RUBRIC_FAMILIES, type ModuleSpec } from "./types";

/**
 * Quality gates for the curriculum framework. Pure functions over the reviewed data, run by tests (and by the future import
 * step) so a structurally broken or vague module can never reach learners. Each returns human-readable problems; [] means valid.
 */

const ID = /^([A-Z]+)-L([0-4])-M(\d{2})$/;
/** Openers that describe studying rather than an observable result. */
const VAGUE_START = /^(learn|understand|know|study|be aware|become familiar|get to know|appreciate|explore)\b/i;
const VAGUE_ANYWHERE = /\b(learn about|understand how|be familiar with|have an understanding)\b/i;
/** Verbs that mean the security module is practising an attack technique. */
const OFFENSIVE = /\b(scan|exploit|penetration|attack|reconnaissance|vulnerabilit(y|ies)|intrusion|breach)\b/i;
/** Words that show the exercise is confined to an authorised environment. */
const AUTHORISED = /\b(lab|authoris|authoriz|scope|own|intentionally vulnerable|simulated|provided|written permission|disclosure policy|learner-owned)\b/i;

/** Words that show a cloud or server exercise runs on infrastructure the learner owns or is given, at a bounded cost. */
const CLOUD_RISK = /\b(server|vps|instance|cluster|cloud account|cloud provider|firewall|ssh|virtual machine)\b/i;
const CLOUD_BOUNDED = /\b(lab|virtual machine|your own|free[- ]tier|budget|cost cap|tear(s|ing)? (it )?down|local|provided|given|you control|you own)\b/i;

export function moduleProblems(m: ModuleSpec, ownCompetencies: Record<string, string>): string[] {
  const p: string[] = [];
  const at = (msg: string) => p.push(`${m.id}: ${msg}`);
  const match = ID.exec(m.id);
  if (!match) at("id must look like FSWD-L1-M03");
  else if (Number(match[2]) !== m.level) at(`id says level ${match[2]} but level is ${m.level}`);
  if (!LEVELS.includes(m.level)) at("level must be 0 to 4");
  if (!m.title.trim() || m.title.length > 90) at("title is required and at most 90 characters");
  if (m.outcome.trim().length < 60) at("outcome must be at least 60 characters and say what is built or shown");
  if (VAGUE_START.test(m.outcome.trim()) || VAGUE_ANYWHERE.test(m.outcome)) at("outcome is vague (it describes studying, not an observable result)");
  if (!Number.isInteger(m.hours) || m.hours < 4 || m.hours > 90) at("hours must be a whole number from 4 to 90");
  if (m.capstone && m.hours < 20) at("a capstone is a substantial project: at least 20 hours");
  if (new Set(m.prerequisites).size !== m.prerequisites.length) at("duplicate prerequisites");
  if (m.prerequisites.includes(m.id)) at("a module cannot require itself");
  if (!m.competencies.length) at("must develop at least one competency");
  for (const slug of m.competencies) if (!(slug in ownCompetencies)) at(`unknown competency "${slug}"`);
  if (!m.evidence.length) at("accepted evidence types are required");
  for (const e of m.evidence) if (!EVIDENCE_KINDS.includes(e)) at(`unknown evidence kind ${e}`);
  if (!RUBRIC_FAMILIES.includes(m.rubric)) at(`unknown rubric family ${m.rubric}`);
  if (!CONTENT_STATUSES.includes(m.status)) at(`unknown status ${m.status}`);
  if (m.id.startsWith("PHOTO-") && m.rubric === "PHOTO" && !m.evidence.includes("PHOTO")) at("a photography module scored on photographs must accept the learner's own PHOTO evidence");
  if (m.id.startsWith("VIDEO-") && m.level >= 1 && m.rubric === "VIDEO" && !m.evidence.some((e) => e === "VIDEO" || e === "AUDIO")) at("a video module must accept VIDEO or AUDIO evidence");
  if (m.id.startsWith("SEC-") && OFFENSIVE.test(m.outcome) && !AUTHORISED.test(m.outcome)) at("offensive-security outcome must state its authorised environment (lab, scope, own system)");
  if (m.id.startsWith("CLOUD-") && CLOUD_RISK.test(m.outcome) && !CLOUD_BOUNDED.test(m.outcome)) at("cloud outcome must say it runs in a lab, virtual machine, free-tier or budget-capped account the learner owns or is given");
  if (m.id.startsWith("CLOUD-") && /\b(client's|customer's|employer's|someone else's|third-party) (live |production )?(server|vps|site|account)/i.test(m.outcome) && !/\b(written permission|authoris)/i.test(m.outcome)) at("cloud module must not point learners at servers they do not own or are not authorised to administer");
  if (/\b(real|live|any|third-party|someone else's) (website|site|server|network|system|company)s?\b/i.test(m.outcome) && m.id.startsWith("SEC-") && !/\b(authoris|own|written permission|disclosure policy)\b/i.test(m.outcome)) {
    at("security module must not point learners at real third-party systems");
  }
  return p;
}

/** Programme prefixes whose modules need this module, directly or through a chain of prerequisites. */
export function programmesUsing(id: string): Set<string> {
  const users = new Set<string>();
  for (const m of ALL_MODULES) {
    if (m.id.startsWith("SH-")) continue;
    const stack = [...m.prerequisites];
    const seen = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      if (cur === id) users.add(m.id.split("-")[0]);
      stack.push(...(moduleById(cur)?.prerequisites ?? []));
    }
  }
  return users;
}

export function frameworkProblems(): string[] {
  const p: string[] = [];

  // Unique ids across everything, and every id belongs to the right file.
  const seen = new Set<string>();
  for (const m of ALL_MODULES) {
    if (seen.has(m.id)) p.push(`${m.id}: duplicate module id`);
    seen.add(m.id);
  }

  // A title may appear only once, so no two programmes quietly teach the same module under one name.
  const titles = new Map<string, string>();
  for (const m of ALL_MODULES) {
    const key = m.title.trim().toLowerCase();
    if (titles.has(key)) p.push(`${m.id}: same title as ${titles.get(key)}`);
    else titles.set(key, m.id);
  }

  // Rubric families: complete, weights total 100, every family defined and used.
  for (const family of RUBRIC_FAMILIES) {
    const r = RUBRICS.find((x) => x.family === family);
    if (!r) {
      p.push(`rubric family ${family} is not defined`);
      continue;
    }
    const total = r.criteria.reduce((s, c) => s + c.weight, 0);
    if (total !== 100) p.push(`rubric ${family}: weights sum to ${total}, expected 100`);
    if (r.criteria.length < 5) p.push(`rubric ${family}: needs at least five criteria`);
    for (const c of r.criteria) {
      if (!c.inspect.length) p.push(`rubric ${family} / ${c.name}: needs at least one inspection capability`);
      for (const cap of c.inspect) if (!CAPABILITIES.includes(cap)) p.push(`rubric ${family} / ${c.name}: unknown capability ${cap}`);
    }
  }
  if (!RUBRICS.find((r) => r.family === "SECURITY")?.gate) p.push("rubric SECURITY must define the scope-compliance gate");
  for (const family of RUBRIC_FAMILIES) if (!ALL_MODULES.some((m) => m.rubric === family)) p.push(`rubric family ${family} is used by no module`);

  const groups: { name: string; modules: ModuleSpec[]; competencies: Record<string, string>; prefix: string; requireLevels: boolean }[] = [
    { name: "shared core", modules: SHARED.modules, competencies: SHARED.competencies, prefix: "SH-", requireLevels: false },
    ...PROGRAMMES.map((pr) => ({ name: pr.name, modules: pr.modules, competencies: pr.competencies, prefix: `${pr.code.toUpperCase()}-`, requireLevels: true })),
  ];

  for (const g of groups) {
    for (const m of g.modules) {
      if (!m.id.startsWith(g.prefix)) p.push(`${m.id}: belongs in a ${g.prefix}* file, found in ${g.name}`);
      p.push(...moduleProblems(m, g.competencies));
      for (const pre of m.prerequisites) {
        const target = moduleById(pre);
        if (!target) {
          p.push(`${m.id}: prerequisite ${pre} does not exist`);
          continue;
        }
        if (target.level > m.level) p.push(`${m.id}: prerequisite ${pre} is a higher level (${target.level} > ${m.level})`);
        // Same programme and same level: the prerequisite must come earlier in the sequence.
        if (pre.slice(0, pre.indexOf("-")) === m.id.slice(0, m.id.indexOf("-")) && target.level === m.level && pre >= m.id) p.push(`${m.id}: prerequisite ${pre} is not earlier in the sequence`);
      }
    }
    // Every competency is taught somewhere (no orphan promises).
    const taught = new Set(g.modules.flatMap((m) => m.competencies));
    for (const slug of Object.keys(g.competencies)) if (!taught.has(slug)) p.push(`${g.name}: competency "${slug}" is taught by no module`);
    // Sequence numbers are contiguous per level and a module sits beside its own level.
    for (const level of LEVELS) {
      const nums = g.modules.filter((m) => m.level === level).map((m) => Number(ID.exec(m.id)?.[3])).sort((a, b) => a - b);
      nums.forEach((n, i) => {
        if (n !== i + 1) p.push(`${g.name}: level ${level} module numbers must run 01, 02, 03... (found ${nums.join(", ")})`);
      });
    }
    if (g.requireLevels) {
      for (const level of LEVELS) {
        const inLevel = g.modules.filter((m) => m.level === level);
        if (inLevel.length < 3) p.push(`${g.name}: level ${level} needs at least 3 modules (has ${inLevel.length})`);
      }
      const l0Hours = g.modules.filter((m) => m.level === 0).reduce((s, m) => s + m.hours, 0);
      if (l0Hours > 40) p.push(`${g.name}: Foundation level is ${l0Hours} hours; keep it to 40 or fewer for absolute beginners`);
      if (!g.modules.some((m) => m.capstone && m.level === 4)) p.push(`${g.name}: needs at least one Level 4 capstone`);
      if (!g.modules.some((m) => m.capstone && m.level <= 3)) p.push(`${g.name}: needs a capstone before Level 4 so progress is checked earlier`);
    }
  }

  // No circular prerequisites anywhere.
  const state = new Map<string, 1 | 2>();
  const dfs = (id: string, trail: string[]) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      p.push(`circular prerequisites: ${[...trail, id].join(" -> ")}`);
      return;
    }
    state.set(id, 1);
    for (const pre of moduleById(id)?.prerequisites ?? []) dfs(pre, [...trail, id]);
    state.set(id, 2);
  };
  ALL_MODULES.forEach((m) => dfs(m.id, []));

  // Shared modules must earn their place: needed (directly or through other modules) by at least two programmes.
  for (const s of SHARED.modules) {
    const users = programmesUsing(s.id);
    if (users.size < 2) p.push(`${s.id}: shared module is used by fewer than two programmes (${[...users].join(", ") || "none"})`);
  }

  // Pathways.
  for (const path of PATHWAYS) {
    const at = (msg: string) => p.push(`pathway ${path.code}: ${msg}`);
    if (!path.requiredProgrammes.length) at("needs at least one required programme");
    for (const code of path.requiredProgrammes) if (path.requiredLevels[code] === undefined) at(`no required level for ${code}`);
    for (const code of Object.keys(path.requiredLevels)) if (!path.requiredProgrammes.includes(code as never)) at(`required level given for ${code}, which is not required`);
    for (const code of path.optionalProgrammes) if (path.requiredProgrammes.includes(code)) at(`${code} is both required and optional`);
    const ids = new Set(pathwayModules(path).map((m) => m.id));
    for (const cap of path.capstones) {
      const m = moduleById(cap);
      if (!m) at(`capstone ${cap} does not exist`);
      else if (!m.capstone) at(`${cap} is not a capstone`);
      else if (!ids.has(cap)) at(`capstone ${cap} is outside the required programmes and levels`);
    }
    if (!path.capstones.length) at("needs at least one capstone");
    for (const req of path.competencyRequirements) {
      const [code, slug] = req.split(":");
      const prog = PROGRAMMES.find((x) => x.code === code);
      if (!prog || !(slug in prog.competencies)) at(`competency requirement ${req} does not exist`);
      else if (!pathwayModules(path).some((m) => m.competencies.includes(slug) && m.id.startsWith(`${code.toUpperCase()}-`))) at(`competency ${req} is not taught by any module in this pathway`);
    }
    try {
      const seq = pathwaySequence(path);
      const pos = new Map(seq.map((id, i) => [id, i]));
      for (const id of seq) for (const pre of moduleById(id)?.prerequisites ?? []) if ((pos.get(pre) ?? -1) >= (pos.get(id) ?? 0)) at(`${pre} must come before ${id}`);
      if (seq.length !== ids.size) at("sequence does not cover every module");
    } catch (e) {
      at((e as Error).message);
    }
    if (path.electives && path.electives.pick > path.electives.from.length) at("electives pick more programmes than are offered");
    if (pathwayHours(path) <= 0) at("has no hours");
  }
  return p;
}

export function frameworkStats() {
  const byStatus: Record<string, number> = {};
  for (const m of ALL_MODULES) byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
  return {
    programmes: PROGRAMMES.length,
    sharedModules: SHARED.modules.length,
    modules: ALL_MODULES.length,
    capstones: ALL_MODULES.filter((m) => m.capstone).length,
    byStatus,
    hoursByProgramme: Object.fromEntries(PROGRAMMES.map((pr) => [pr.code, pr.modules.reduce((s, m) => s + m.hours, 0)])),
    pathways: PATHWAYS.map((path) => ({ code: path.code, modules: pathwayModules(path).length, hours: pathwayHours(path) })),
  };
}
