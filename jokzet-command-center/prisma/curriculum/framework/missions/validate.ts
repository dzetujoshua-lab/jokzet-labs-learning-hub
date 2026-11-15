import { detectSecrets } from "../../../../src/lib/evidence/secrets";
import { LEVEL0 } from "../../level0";
import { ALL_MODULES, PROGRAMMES, RUBRICS, moduleById } from "../index";
import type { ModuleSpec } from "../types";
import type { MissionDraft } from "./types";

/**
 * Quality gates for mission drafts, in the same spirit as prisma/curriculum/validate.ts (pure functions that return readable
 * problems; [] means valid). A mission that fails any gate can never be approved.
 */

const CODE = /^([A-Z]+)-L([0-4])-(\d{2})$/;
const KINDS = ["BUILD", "DESIGN", "DRILL", "STUDY", "SHOOT", "EDIT", "WRITE", "SHIP"];
const EVIDENCE = ["SCREENSHOT", "PHOTO", "VIDEO", "CODE", "DOCUMENT", "LINK"];
const VAGUE_START = /^(learn|understand|know|study|be aware|become familiar|get to know|appreciate|explore)\b/i;
/** A URL anywhere in a draft would mean someone pasted an unverified resource. */
const URL = /\bhttps?:\/\/|\bwww\./i;
/** Share of a mission's points that must come from its rubric family at each level (the rest may be mission-specific). */
const FAMILY_SHARE = [30, 50, 60, 60, 60];

/** Mission-code prefix used by the existing platform for each programme. */
export const MISSION_PREFIX: Record<string, string> = { fswd: "FSWD", uxui: "UXUI", sec: "SEC", cloud: "CLOUD", ai: "AI", photo: "PHOTO", video: "VID", gfx: "GFX", biz: "BIZ", sh: "SH" };

const blank = (v: unknown) => typeof v !== "string" || v.trim() === "";

/** Screenshots and documents are always acceptable supporting evidence; other kinds need the module to accept something compatible. */
function evidenceCompatible(m: MissionDraft, mod: ModuleSpec): boolean {
  if (m.evidence === "SCREENSHOT" || m.evidence === "DOCUMENT") return true;
  const accepts = new Set(mod.evidence);
  if (m.evidence === "LINK") return ["LIVE_SITE", "REPOSITORY", "DESIGN_FILE"].some((k) => accepts.has(k as never));
  if (m.evidence === "CODE") return accepts.has("REPOSITORY");
  if (m.evidence === "VIDEO") return accepts.has("VIDEO") || accepts.has("AUDIO");
  if (m.evidence === "PHOTO") return accepts.has("PHOTO");
  return false;
}

export function missionDraftProblems(m: MissionDraft): string[] {
  const p: string[] = [];
  const at = (msg: string) => p.push(`${m.code}: ${msg}`);
  const mod = moduleById(m.moduleId);
  const code = CODE.exec(m.code);

  if (!code) at("code must look like FSWD-L0-03");
  if (!mod) {
    at(`module ${m.moduleId} does not exist`);
    return p;
  }
  const programme = PROGRAMMES.find((pr) => m.moduleId.startsWith(`${pr.code.toUpperCase()}-`));
  if (code) {
    if (Number(code[2]) !== mod.level) at(`code says level ${code[2]} but module ${mod.id} is level ${mod.level}`);
    if (programme && code[1] !== MISSION_PREFIX[programme.code]) at(`code prefix must be ${MISSION_PREFIX[programme.code]} for the ${programme.name} programme`);
    if (m.moduleId.startsWith("SH-") && code[1] !== MISSION_PREFIX.sh) at(`code prefix must be ${MISSION_PREFIX.sh} for a shared module`);
  }
  if (m.status !== "DRAFT") at("status must be DRAFT until a reviewer approves it");

  if (blank(m.title) || m.title.length > 80) at("title is required and at most 80 characters");
  if (m.objective.trim().length < 40 || VAGUE_START.test(m.objective.trim())) at("objective must be at least 40 characters and describe an observable result");
  if (!Number.isInteger(m.minutes) || m.minutes < 20 || m.minutes > 240) at("minutes must be a whole number from 20 to 240 (one sitting)");
  if (!KINDS.includes(m.kind)) at(`kind must be one of ${KINDS.join(", ")}`);
  if (!EVIDENCE.includes(m.evidence)) at(`evidence must be one of ${EVIDENCE.join(", ")}`);
  else if (!evidenceCompatible(m, mod)) at(`evidence ${m.evidence} does not fit module ${mod.id}, which accepts ${mod.evidence.join(", ")}`);
  if (!Number.isInteger(m.xp) || m.xp % 5 !== 0 || m.xp < Math.floor(m.minutes * 0.35) - 2 || m.xp > Math.ceil(m.minutes * 0.5)) {
    at(`xp must be a multiple of 5 between ${(m.minutes * 0.35).toFixed(0)} and ${(m.minutes * 0.5).toFixed(0)} for ${m.minutes} minutes (no inflated XP)`);
  }
  if (!m.tools.length || m.tools.some(blank)) at("tools are required (and free options named where a paid tool is the norm)");
  if (!m.competencies.length) at("at least one competency is required");
  for (const c of m.competencies) if (!mod.competencies.includes(c)) at(`competency "${c}" is not one of module ${mod.id}'s competencies (${mod.competencies.join(", ")})`);

  // WATCH: a brief, never a link, and a minority of the time.
  if (!Number.isInteger(m.watch.minutes) || m.watch.minutes < 5) at("watch minutes must be a whole number of at least 5");
  else if (m.watch.minutes > m.minutes * 0.35) at(`WATCH is ${m.watch.minutes} of ${m.minutes} minutes: practical work must be at least 65% of a mission`);
  if (m.watch.brief.trim().length < 40) at("WATCH brief must say what the resource has to demonstrate");
  if (m.watch.mustShow.length < 2 || m.watch.mustShow.some((s) => s.trim().length < 15)) at("WATCH must list at least two specific things the resource must show");

  // DO, EXPERIMENT, SHOW, verification, remediation.
  if (m.doSteps.length < 3 || m.doSteps.some((s) => s.trim().length < 20)) at("DO needs at least three concrete steps of at least 20 characters each");
  if (m.experiment.trim().length < 50) at("EXPERIMENT must describe an independent challenge in at least 50 characters");
  if (m.show.trim().length < 50 || !/\b(submit|upload|share|send)\b/i.test(m.show)) at("SHOW must say exactly what to submit");
  if (m.verification.length < 3 || m.verification.some((s) => s.trim().length < 20)) at("verification needs at least three objective checks");
  if (m.remediation.trim().length < 40) at("remediation advice is required");

  // Rubric: names from the family for most points, total exactly 100, no duplicates.
  const family = RUBRICS.find((r) => r.family === mod.rubric);
  const familyNames = new Set(family?.criteria.map((c) => c.name));
  if (m.rubric.length < 3 || m.rubric.length > 6) at("rubric needs 3 to 6 criteria");
  const names = m.rubric.map((r) => r.criterion);
  if (new Set(names).size !== names.length) at("rubric has duplicate criteria");
  for (const r of m.rubric) {
    if (!Number.isInteger(r.points) || r.points < 5) at(`rubric criterion "${r.criterion}" needs whole points of at least 5`);
    if (r.description.trim().length < 20) at(`rubric criterion "${r.criterion}" needs a description of at least 20 characters`);
  }
  const total = m.rubric.reduce((s, r) => s + (Number.isFinite(r.points) ? r.points : 0), 0);
  if (total !== 100) at(`rubric points sum to ${total}, expected 100`);
  const fromFamily = m.rubric.filter((r) => familyNames.has(r.criterion)).reduce((s, r) => s + r.points, 0);
  if (fromFamily < FAMILY_SHARE[mod.level]) at(`only ${fromFamily} rubric points use ${mod.rubric} family criteria (${[...familyNames].join(", ")}); at level ${mod.level} at least ${FAMILY_SHARE[mod.level]} are required`);

  // Nothing unverified or secret in the content.
  const texts = [m.title, m.objective, m.watch.brief, ...m.watch.mustShow, ...m.doSteps, m.experiment, m.show, ...m.verification, m.remediation, ...m.rubric.flatMap((r) => [r.criterion, r.description]), ...m.tools];
  for (const t of texts) {
    if (URL.test(t)) {
      at("content contains a link: resources are approved separately, never written into a mission draft");
      break;
    }
  }
  for (const t of texts) {
    const found = detectSecrets(t);
    if (found.length) {
      at(`content contains ${found[0]}`);
      break;
    }
  }
  return p;
}

/** Cross-mission checks for a set of drafts: unique and contiguous codes, and complete coverage of each module they claim to teach. */
export function missionSetProblems(drafts: MissionDraft[]): string[] {
  const p: string[] = [];
  const legacy = new Set(LEVEL0.flatMap((d) => d.missions.map((m) => m.code)));
  const seen = new Set<string>();
  for (const m of drafts) {
    if (seen.has(m.code)) p.push(`${m.code}: used twice`);
    seen.add(m.code);
    if (legacy.has(m.code)) p.push(`${m.code}: collides with an existing mission code`);
    p.push(...missionDraftProblems(m));
  }

  // Codes continue the numbering of each programme and level without gaps, after any legacy missions.
  const groups = new Map<string, number[]>();
  for (const m of drafts) {
    const c = CODE.exec(m.code);
    if (c) groups.set(`${c[1]}-L${c[2]}`, [...(groups.get(`${c[1]}-L${c[2]}`) ?? []), Number(c[3])]);
  }
  for (const [key, nums] of groups) {
    const legacyMax = Math.max(0, ...[...legacy].filter((l) => l.startsWith(`${key}-`)).map((l) => Number(l.slice(-2))));
    const sorted = [...nums].sort((a, b) => a - b);
    sorted.forEach((n, i) => {
      if (n !== legacyMax + 1 + i) p.push(`${key}: new mission numbers must continue from ${String(legacyMax + 1).padStart(2, "0")} without gaps (found ${sorted.join(", ")})`);
    });
  }

  // Each module with missions is fully and realistically covered; missions of one module are contiguous in order.
  const byModule = new Map<string, MissionDraft[]>();
  for (const m of drafts) byModule.set(m.moduleId, [...(byModule.get(m.moduleId) ?? []), m]);
  for (const [id, list] of byModule) {
    const mod = moduleById(id);
    if (!mod) continue;
    const minutes = list.reduce((s, m) => s + m.minutes, 0);
    const target = mod.hours * 60;
    if (!mod.capstone && Math.abs(minutes - target) / target > 0.4) p.push(`${id}: missions total ${minutes} minutes but the module is planned at ${target} (${mod.hours} h); they should be within 40%`);
    for (const c of mod.competencies) if (!list.some((m) => m.competencies.includes(c))) p.push(`${id}: no mission develops competency "${c}"`);
    const nums = list.map((m) => Number(m.code.slice(-2))).sort((a, b) => a - b);
    if (nums.some((n, i) => i > 0 && n !== nums[i - 1] + 1)) p.push(`${id}: its missions must have consecutive codes (found ${nums.join(", ")})`);
    if (list.length > 8) p.push(`${id}: more than 8 missions; split the module`);
  }
  return p;
}

export function missionStats(drafts: MissionDraft[]) {
  return {
    missions: drafts.length,
    modules: new Set(drafts.map((m) => m.moduleId)).size,
    minutes: drafts.reduce((s, m) => s + m.minutes, 0),
    xp: drafts.reduce((s, m) => s + m.xp, 0),
    watchMinutes: drafts.reduce((s, m) => s + m.watch.minutes, 0),
    withApprovedResource: 0,
    modulesWithoutMissions: ALL_MODULES.filter((m) => !m.id.startsWith("SH-") && !drafts.some((d) => d.moduleId === m.id)).length,
  };
}
