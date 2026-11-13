import { createHash } from "node:crypto";
import { seatsFor, sessionInstant, sessionsPerDay } from "./availability";
import { allocateByWeight, phaseCount, reserves, slotDates, weekNumberOf } from "./capacity";

/**
 * The deterministic plan generator. A pure function: the same input always gives the same plan, nothing is random, nothing
 * reads the clock or the database, and it never awards anything (no XP, skills or mission status). Plans are never silently
 * rewritten: a change to the catalogue only changes `catalogVersion`, which the service offers as a regeneration.
 */
export const GENERATOR_VERSION = 1;
export const SUBMIT_UNIT_MINUTES = 15; // the real time submitting and self-assessing takes

export type CatalogStep = { position: number; phase: "WATCH" | "DO" | "EXPERIMENT" | "SHOW"; minutes: number | null };
export type CatalogMission = {
  id: string;
  code: string;
  departmentCode: string;
  level: number;
  sortOrder: number;
  role: "LESSON" | "BASELINE" | "CHECKPOINT";
  title: string;
  objective: string;
  minutes: number;
  steps: CatalogStep[];
};
export type PlanGoalInput = { departmentCode: string; weight: number; targetLevel: number };

export type GenerateInput = {
  timezone: string;
  startDate: string; // local ISO date
  durationDays: number;
  experience: "BEGINNER" | "IMPROVER" | "INTERMEDIATE" | "ADVANCED";
  sessionMinutes: number;
  dailyStudyMinutes: number; // study time available on a study day; 0 = one session a day
  breakMinutes: number; // gap between sessions on the same day
  weekdays: number[];
  startTime: string; // HH:mm
  goals: PlanGoalInput[]; // in department display order (used to break ties)
  placement: Record<string, number>; // placement level per department from a finished baseline
  baselinePending: string[]; // subjects whose baseline is neither assessed nor skipped
  catalog: CatalogMission[];
  catalogVersion: string;
  passed: string[]; // ids of missions the learner has already passed
};

export type ItemKind = "TEACHING" | "BASELINE" | "CHECKPOINT" | "PRACTICE" | "REVIEW" | "CATCH_UP";
export type DraftItem = {
  date: string;
  startAt: Date;
  position: number;
  slotIndex: number; // which session of the day (0 = first)
  phaseIndex: number;
  kind: ItemKind;
  minutes: number;
  title: string;
  objective: string;
  weekNumber: number;
  departmentCode: string | null;
  missionId: string | null;
  stepFrom: number | null;
  stepTo: number | null;
  continuesPrev: boolean;
};
export type DraftPhase = { position: number; kind: "FOUNDATION" | "BUILD" | "PROJECT" | "REVIEW"; title: string; objective: string; startDate: string; endDate: string };
export type PlanSummary = {
  capacityMinutes: number;
  scheduledMinutes: number;
  slots: number;
  sessionsPerDay: number;
  reserved: { baseline: number; review: number; checkpoint: number };
  shortfall: { departmentCode: string; sessions: number }[];
  coverage: { departmentCode: string; missionsPlanned: number; missionsAvailable: number }[];
  warnings: string[];
  stageMinutesSource: "authored" | "estimated";
};
export type PlanDraft = { phases: DraftPhase[]; items: DraftItem[]; weeks: { number: number; objective: string; minutes: number }[]; summary: PlanSummary; inputHash: string; generatorVersion: number };
export type GenerateResult = { ok: true; draft: PlanDraft } | { ok: false; error: string };

// ── canonical hash ──
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
export const inputHashOf = (input: GenerateInput): string => createHash("sha256").update(canonical({ ...input, generatorVersion: GENERATOR_VERSION })).digest("hex");

// ── units of work ──
type Unit = { minutes: number; step: number | null; label: string };
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** The units of a mission: one per step (authored minutes preferred, else a documented estimate) plus the submit unit. */
export function missionUnits(m: CatalogMission): { units: Unit[]; authored: boolean } {
  const steps = [...m.steps].sort((a, b) => a.position - b.position);
  const authored = steps.length > 0 && steps.every((s) => s.minutes !== null);
  let minutes: number[];
  if (authored) {
    minutes = steps.map((s) => s.minutes as number);
  } else {
    // Estimate: WATCH 15%, DO 50% (shared by its DO steps), EXPERIMENT 20%, SHOW 15% (the remainder).
    const total = m.minutes;
    const doSteps = steps.filter((s) => s.phase === "DO").length || 1;
    const watch = round5(total * 0.15);
    const doEach = round5((total * 0.5) / doSteps);
    const exp = round5(total * 0.2);
    const usedBeforeShow = watch + doEach * doSteps + exp;
    const show = Math.max(5, total - usedBeforeShow);
    minutes = steps.map((s) => (s.phase === "WATCH" ? watch : s.phase === "DO" ? doEach : s.phase === "EXPERIMENT" ? exp : show));
  }
  const units: Unit[] = steps.map((s, i) => ({ minutes: minutes[i], step: s.position, label: `step ${s.position}` }));
  units.push({ minutes: SUBMIT_UNIT_MINUTES, step: null, label: "submit and self-assess" });
  return { units, authored };
}

type Session = {
  missionId: string;
  minutes: number;
  stepFrom: number | null;
  stepTo: number | null;
  continuesPrev: boolean;
  submit: boolean; // this session also carries the submit-and-self-assess unit
  mission: CatalogMission;
};

const labelOf = (s: Session): string => {
  const steps = s.stepFrom === null || s.stepTo === null ? "" : s.stepFrom === s.stepTo ? `step ${s.stepFrom}` : `steps ${s.stepFrom}-${s.stepTo}`;
  if (!steps) return "submit and self-assess";
  return s.submit ? `${steps} + submit` : steps;
};

/** Packs a mission's units into sessions of at most `limit` minutes; a unit longer than a session spans several. */
export function packMission(m: CatalogMission, limit: number): { sessions: Session[]; authored: boolean } {
  const { units, authored } = missionUnits(m);
  const sessions: Session[] = [];
  let cur: Session | null = null;
  const flush = () => {
    if (cur) sessions.push(cur);
    cur = null;
  };
  for (const u of units) {
    if (u.minutes > limit) {
      flush();
      const parts = Math.ceil(u.minutes / limit);
      for (let p = 0; p < parts; p += 1) {
        const minutes = p < parts - 1 ? limit : u.minutes - limit * (parts - 1);
        sessions.push({ missionId: m.id, minutes, stepFrom: u.step, stepTo: u.step, continuesPrev: p > 0, submit: u.step === null, mission: m });
      }
      continue;
    }
    const open = cur as Session | null;
    if (open && open.minutes + u.minutes <= limit) {
      open.minutes += u.minutes;
      if (u.step === null) open.submit = true;
      else {
        open.stepFrom = open.stepFrom === null ? u.step : Math.min(open.stepFrom, u.step);
        open.stepTo = open.stepTo === null ? u.step : Math.max(open.stepTo, u.step);
      }
      continue;
    }
    flush();
    cur = { missionId: m.id, minutes: u.minutes, stepFrom: u.step, stepTo: u.step, continuesPrev: false, submit: u.step === null, mission: m };
  }
  flush();
  return { sessions, authored };
}

const PHASE_KINDS = (n: number): DraftPhase["kind"][] => {
  if (n === 1) return ["FOUNDATION"];
  const kinds: DraftPhase["kind"][] = ["FOUNDATION"];
  for (let i = 1; i < n - 1; i += 1) kinds.push(i % 2 === 1 ? "BUILD" : "PROJECT");
  kinds.push("REVIEW");
  return kinds;
};
const PHASE_OBJECTIVE: Record<DraftPhase["kind"], string> = {
  FOUNDATION: "Learn the basics and find your footing.",
  BUILD: "Build skills with focused practice and real missions.",
  PROJECT: "Apply what you have learned to a larger piece of work.",
  REVIEW: "Consolidate, fix gaps and show your best work.",
};

export function generatePlan(input: GenerateInput): GenerateResult {
  const L = input.sessionMinutes;
  const perDay = sessionsPerDay(input.dailyStudyMinutes, L, input.breakMinutes);
  const seats = seatsFor(slotDates(input.startDate, input.durationDays, input.weekdays), perDay);
  const slots = seats.map((s) => s.date); // one entry per seat (a study day repeats once per session of that day)
  const S = slots.length;
  if (S < 2) return { ok: false, error: "Choose more days or a longer duration: this plan has fewer than two study sessions." };
  if (!input.goals.length) return { ok: false, error: "Choose at least one subject." };

  const warnings: string[] = [];
  const nPhases = phaseCount(input.durationDays, S);
  const phaseOfSlot = (i: number) => Math.floor((i * nPhases) / S);
  const caps = reserves(S, nPhases);
  const passed = new Set(input.passed);
  const byDept = (code: string) => input.catalog.filter((m) => m.departmentCode === code);

  const taken = new Map<number, Pick<DraftItem, "kind" | "minutes" | "title" | "objective" | "departmentCode" | "missionId" | "stepFrom" | "stepTo" | "continuesPrev">>();
  const free = () => slots.map((_, i) => i).filter((i) => !taken.has(i));

  // 1. Baselines first: one session per chosen subject (highest weight first), capped at 20% of the slots.
  const baselineCandidates = input.goals
    .map((g, order) => ({ g, order, mission: byDept(g.departmentCode).find((m) => m.role === "BASELINE") }))
    .filter((x) => x.mission && input.baselinePending.includes(x.g.departmentCode))
    .sort((a, b) => b.g.weight - a.g.weight || a.order - b.order);
  const baselineUse = baselineCandidates.slice(0, caps.baselineCap);
  if (baselineCandidates.length > baselineUse.length) warnings.push("Not every subject could have a baseline in this plan: the others start at Level 0.");
  baselineUse.forEach((x, k) => {
    const m = x.mission!;
    taken.set(k, { kind: "BASELINE", minutes: Math.min(L, Math.max(5, m.minutes)), title: `Baseline: ${m.title}`, objective: m.objective, departmentCode: x.g.departmentCode, missionId: m.id, stepFrom: null, stepTo: null, continuesPrev: false });
  });

  // 2. Weekly reviews (last free slot of a week), evenly chosen up to the cap; checkpoints take the review slot of a phase's last week.
  const weekOf = slots.map((d) => weekNumberOf(d, input.startDate));
  const lastOfWeek: number[] = [];
  for (let i = 0; i < S; i += 1) if (i === S - 1 || weekOf[i + 1] !== weekOf[i]) if (!taken.has(i)) lastOfWeek.push(i);
  let reviewSlots: number[] = [];
  if (caps.reviewCap > 0 && lastOfWeek.length) {
    const m = lastOfWeek.length;
    reviewSlots = m <= caps.reviewCap ? lastOfWeek : Array.from({ length: caps.reviewCap }, (_, k) => lastOfWeek[Math.floor(((k + 1) * m) / caps.reviewCap) - 1]);
  }
  const checkpointMissions = input.goals
    .map((g) => ({ g, mission: byDept(g.departmentCode).filter((m) => m.role === "CHECKPOINT" && !passed.has(m.id)).sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder)[0] }))
    .filter((x) => x.mission)
    .sort((a, b) => b.g.weight - a.g.weight);
  let checkpointCount = 0;
  if (caps.checkpointCap > 0) {
    if (!checkpointMissions.length) warnings.push("No checkpoint is available yet for the chosen subjects, so a review session is used instead.");
    for (let p = 0; p < nPhases && checkpointCount < caps.checkpointCap && checkpointMissions.length; p += 1) {
      const inPhase = slots.map((_, i) => i).filter((i) => phaseOfSlot(i) === p && !taken.has(i));
      if (!inPhase.length) continue;
      // Prefer merging with that phase's last review slot; otherwise the phase's last free slot.
      const merged = [...reviewSlots].reverse().find((i) => phaseOfSlot(i) === p);
      const at = merged ?? inPhase[inPhase.length - 1];
      const pick = checkpointMissions[checkpointCount % checkpointMissions.length];
      const m = pick.mission!;
      reviewSlots = reviewSlots.filter((i) => i !== at);
      taken.set(at, { kind: "CHECKPOINT", minutes: Math.min(L, Math.max(5, m.minutes)), title: `Checkpoint: ${m.title}`, objective: m.objective, departmentCode: pick.g.departmentCode, missionId: m.id, stepFrom: null, stepTo: null, continuesPrev: false });
      checkpointCount += 1;
    }
  }
  for (const i of reviewSlots) {
    if (taken.has(i)) continue;
    taken.set(i, { kind: "REVIEW", minutes: L, title: "Weekly review", objective: "Look back over the week: fix open corrections and finish anything unfinished.", departmentCode: null, missionId: null, stepFrom: null, stepTo: null, continuesPrev: false });
  }
  const reservedBaseline = baselineUse.length;
  const reservedCheckpoint = [...taken.values()].filter((t) => t.kind === "CHECKPOINT").length;
  const reservedReview = [...taken.values()].filter((t) => t.kind === "REVIEW").length;

  // 3. Teaching slots, shared out by weight.
  const teachSlots = free();
  const alloc = allocateByWeight(teachSlots.length, input.goals.map((g) => g.weight));

  // 4. Content per subject, then surplus as bounded practice and review.
  let allAuthored = true;
  let anyMission = false;
  const sequences: { goal: PlanGoalInput; items: Seq[] }[] = [];
  const shortfall: PlanSummary["shortfall"] = [];
  const coverage: PlanSummary["coverage"] = [];
  type Seq = Pick<DraftItem, "kind" | "minutes" | "title" | "objective" | "departmentCode" | "missionId" | "stepFrom" | "stepTo" | "continuesPrev">;
  function toItem(goal: PlanGoalInput, s: Session): Seq {
    return { kind: "TEACHING", minutes: s.minutes, title: `${s.mission.title}: ${labelOf(s)}`, objective: s.mission.objective, departmentCode: goal.departmentCode, missionId: s.missionId, stepFrom: s.stepFrom, stepTo: s.stepTo, continuesPrev: s.continuesPrev };
  }

  input.goals.forEach((goal, gi) => {
    const start = input.experience === "BEGINNER" ? 0 : (input.placement[goal.departmentCode] ?? 0);
    const top = Math.max(goal.targetLevel, start);
    const pool = byDept(goal.departmentCode)
      .filter((m) => m.role === "LESSON" && m.level >= start && m.level <= top && !passed.has(m.id))
      .sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder);
    const sessions: Seq[] = [];
    const missionsPlanned = new Set<string>();
    for (const m of pool) {
      if (sessions.length >= alloc[gi]) break;
      const packed = packMission(m, L);
      if (!packed.authored) allAuthored = false;
      anyMission = true;
      for (const s of packed.sessions) {
        if (sessions.length >= alloc[gi]) break;
        sessions.push(toItem(goal, s));
        missionsPlanned.add(m.id);
      }
    }
    coverage.push({ departmentCode: goal.departmentCode, missionsPlanned: missionsPlanned.size, missionsAvailable: pool.length });

    // Surplus: practice (repeat the experiment of a passed mission) and review, each capped at 25% of the subject's time.
    let surplus = alloc[gi] - sessions.length;
    if (surplus > 0) {
      const cap = Math.floor((25 * alloc[gi]) / 100);
      const passedHere = byDept(goal.departmentCode).filter((m) => m.role === "LESSON" && passed.has(m.id));
      const practice = passedHere.length ? Math.min(cap, surplus) : 0;
      for (let k = 0; k < practice; k += 1) {
        const m = passedHere[k % passedHere.length];
        sessions.push({ kind: "PRACTICE", minutes: Math.min(L, 30), title: `Practice: ${m.title}`, objective: "Repeat the experiment to make it stick. This is not assessed and earns nothing.", departmentCode: goal.departmentCode, missionId: m.id, stepFrom: null, stepTo: null, continuesPrev: false });
      }
      surplus -= practice;
      const review = Math.min(cap, surplus);
      for (let k = 0; k < review; k += 1) {
        sessions.push({ kind: "REVIEW", minutes: L, title: `Review: ${goal.departmentCode}`, objective: "Go back over open corrections and anything unfinished in this subject.", departmentCode: goal.departmentCode, missionId: null, stepFrom: null, stepTo: null, continuesPrev: false });
      }
      surplus -= review;
      if (surplus > 0) shortfall.push({ departmentCode: goal.departmentCode, sessions: surplus });
    }
    sequences.push({ goal, items: sessions });
  });
  if (shortfall.length) warnings.push("Some subjects do not have enough published content to fill the plan. Shorten the plan, extend it when more content is published, or add your own mission.");

  // 5. Interleave with smooth weighted round-robin.
  const counts = sequences.map((s) => s.items.length);
  const totalItems = counts.reduce((a, b) => a + b, 0);
  const cursor = sequences.map(() => 0);
  const current = counts.map(() => 0);
  const order: number[] = [];
  for (let n = 0; n < totalItems; n += 1) {
    let best = -1;
    counts.forEach((c, i) => {
      if (cursor[i] >= c) return;
      current[i] += c;
      if (best === -1 || current[i] > current[best]) best = i;
    });
    current[best] -= counts.reduce((a, c, i) => (cursor[i] < c ? a + c : a), 0);
    order.push(best);
    cursor[best] += 1;
  }
  const seqCursor = sequences.map(() => 0);
  teachSlots.slice(0, totalItems).forEach((slotIndex, n) => {
    const g = order[n];
    taken.set(slotIndex, sequences[g].items[seqCursor[g]]);
    seqCursor[g] += 1;
  });

  // 6. Assemble phases, items and weekly totals.
  const kinds = PHASE_KINDS(nPhases);
  const phases: DraftPhase[] = kinds.map((kind, p) => {
    const idx = slots.map((_, i) => i).filter((i) => phaseOfSlot(i) === p);
    return { position: p + 1, kind, title: `${kind[0]}${kind.slice(1).toLowerCase()}`, objective: PHASE_OBJECTIVE[kind], startDate: slots[idx[0]], endDate: slots[idx[idx.length - 1]] };
  });
  const items: DraftItem[] = [];
  slots.forEach((date, i) => {
    const t = taken.get(i);
    if (!t) return;
    items.push({ date, startAt: sessionInstant(date, seats[i].index, input.startTime, L, input.breakMinutes, input.timezone), slotIndex: seats[i].index, position: items.length + 1, phaseIndex: phaseOfSlot(i), weekNumber: weekOf[i], ...t });
  });
  const weekMap = new Map<number, { minutes: number; first: string }>();
  for (const it of items) {
    const w = weekMap.get(it.weekNumber) ?? { minutes: 0, first: it.title };
    w.minutes += it.minutes;
    weekMap.set(it.weekNumber, w);
  }
  const weeks = [...weekMap.entries()].sort((a, b) => a[0] - b[0]).map(([number, w]) => ({ number, objective: w.first, minutes: w.minutes }));

  const summary: PlanSummary = {
    capacityMinutes: S * L,
    scheduledMinutes: items.reduce((a, i) => a + i.minutes, 0),
    slots: S,
    sessionsPerDay: perDay,
    reserved: { baseline: reservedBaseline, review: reservedReview, checkpoint: reservedCheckpoint },
    shortfall,
    coverage,
    warnings,
    stageMinutesSource: anyMission && allAuthored ? "authored" : "estimated",
  };
  return { ok: true, draft: { phases, items, weeks, summary, inputHash: inputHashOf(input), generatorVersion: GENERATOR_VERSION } };
}

