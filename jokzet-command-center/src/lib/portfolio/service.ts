import { z } from "zod";
import type { ProjectStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DEPARTMENTS } from "@/lib/departments";
import { earnedMission } from "@/lib/missions/earned";
import { detectSecretInUrl, detectSecrets, secretMessage } from "@/lib/evidence/secrets";
import { dateToISO } from "@/lib/programme";

const codes = DEPARTMENTS.map((d) => d.code) as [string, ...string[]];

export const PIECE_STATUS = ["concept", "building", "shipped"] as const;
type PieceStatus = (typeof PIECE_STATUS)[number];
const STATUS_TO_DB: Record<PieceStatus, ProjectStatus> = { concept: "PLANNED", building: "IN_PROGRESS", shipped: "COMPLETED" };
const STATUS_FROM_DB: Record<ProjectStatus, PieceStatus> = { PLANNED: "concept", IN_PROGRESS: "building", COMPLETED: "shipped" };

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .default("")
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Enter a full link starting with http:// or https://");

/** Base44 stored tools as one text field ("React · Figma · Postgres"); we split it into a clean list. */
export function parseTools(value: string): string[] {
  return [...new Set(value.split(/[,·|;\n]/).map((t) => t.trim()).filter(Boolean))].slice(0, 12).map((t) => t.slice(0, 40));
}

export const pieceSchema = z.object({
  title: z.string().trim().min(1, "Give the piece a title").max(120, "Keep the title under 120 characters"),
  departmentCode: z.union([z.enum(codes), z.literal("")]).default(""),
  status: z.enum(PIECE_STATUS).default("concept"),
  summary: z.string().trim().max(2000, "Keep the summary under 2,000 characters").default(""),
  tools: z.string().trim().max(300).default(""),
  repoUrl: optionalUrl,
  liveUrl: optionalUrl,
  coverEvidenceId: z.string().max(64).default(""),
});
export type PieceInput = z.input<typeof pieceSchema>;

export const capstoneSchema = z.object({
  title: z.string().trim().min(1, "Name the capstone").max(120),
  summary: z.string().trim().max(2000).default(""),
  tools: z.string().trim().max(300).default(""),
  stages: z.coerce.number().int().min(1, "At least 1 stage").max(12, "At most 12 stages").default(8),
  repoUrl: optionalUrl,
  liveUrl: optionalUrl,
});
export type CapstoneInput = z.input<typeof capstoneSchema>;

export type PieceView = {
  id: string;
  title: string;
  departmentCode: string | null;
  summary: string;
  tools: string[];
  status: PieceStatus;
  repoUrl: string | null;
  liveUrl: string | null;
  completedDate: string | null;
  coverEvidenceId: string | null;
  missionCode: string | null;
  assessment: { percentage: number; attempt: number } | null;
};

export type CapstoneView = {
  id: string;
  title: string;
  summary: string;
  tools: string[];
  stage: number;
  stages: number;
  repoUrl: string | null;
  liveUrl: string | null;
};

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function checkText(...parts: string[]): string | null {
  const secrets = detectSecrets(parts.join("\n"));
  return secrets.length ? secretMessage(secrets) : null;
}
function checkUrls(...urls: string[]): string | null {
  return urls.some((u) => u && detectSecretInUrl(u)) ? "A link seems to contain a token or key. Remove it before saving." : null;
}

export async function listPortfolio(userId: string): Promise<{ pieces: PieceView[]; capstone: CapstoneView | null }> {
  const [rows, capstoneRow] = await Promise.all([
    db.portfolioProject.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { department: { select: { code: true } }, mission: { select: { id: true, code: true } } },
    }),
    db.capstoneProject.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, include: { milestones: { select: { status: true } } } }),
  ]);

  // Assessment result for mission-linked pieces: the latest assessment for that mission.
  const missionIds = rows.map((r) => r.missionId).filter((id): id is string => !!id);
  const assessments = missionIds.length
    ? await db.assessment.findMany({
        where: { userId, rubric: { missionId: { in: missionIds } } },
        orderBy: { assessedAt: "desc" },
        select: { percentage: true, rubric: { select: { missionId: true } }, submission: { select: { attempt: true } } },
      })
    : [];
  const latest = new Map<string, { percentage: number; attempt: number }>();
  for (const a of assessments) if (!latest.has(a.rubric.missionId)) latest.set(a.rubric.missionId, { percentage: a.percentage, attempt: a.submission.attempt });

  const pieces: PieceView[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    departmentCode: r.department?.code ?? null,
    summary: r.summary ?? "",
    tools: r.tools,
    status: STATUS_FROM_DB[r.status],
    repoUrl: r.repoUrl,
    liveUrl: r.liveUrl,
    completedDate: r.completedAt ? dateToISO(r.completedAt) : null,
    coverEvidenceId: r.coverEvidenceId,
    missionCode: r.mission?.code ?? null,
    assessment: r.missionId ? (latest.get(r.missionId) ?? null) : null,
  }));

  const capstone: CapstoneView | null = capstoneRow
    ? {
        id: capstoneRow.id,
        title: capstoneRow.name,
        summary: capstoneRow.summary ?? "",
        tools: capstoneRow.tools,
        stage: capstoneRow.milestones.filter((m) => m.status === "DONE").length,
        stages: capstoneRow.milestones.length || 8,
        repoUrl: capstoneRow.repoUrl,
        liveUrl: capstoneRow.liveUrl,
      }
    : null;
  return { pieces, capstone };
}

/** The user's own image evidence that can be used as a cover (owner-scoped). */
export async function listCoverChoices(userId: string) {
  const rows = await db.evidenceItem.findMany({
    where: { userId, file: { kind: { in: ["IMAGE", "SCREENSHOT"] } } },
    orderBy: { capturedDate: "desc" },
    take: 50,
    select: { id: true, title: true },
  });
  return rows;
}

async function resolveCover(userId: string, coverEvidenceId: string): Promise<Result<{ id: string | null }>> {
  if (!coverEvidenceId) return { ok: true, id: null };
  const item = await db.evidenceItem.findFirst({ where: { id: coverEvidenceId, userId, file: { kind: { in: ["IMAGE", "SCREENSHOT"] } } }, select: { id: true } });
  return item ? { ok: true, id: item.id } : { ok: false, error: "Pick one of your own image evidence items as the cover." };
}

/** Creates or updates a piece. `id` is checked against the owner, so another user's piece can never be edited. */
export async function savePiece(userId: string, id: string | null, input: PieceInput): Promise<Result<{ id: string }>> {
  const parsed = pieceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const d = parsed.data;
  const problem = checkText(d.title, d.summary, d.tools) ?? checkUrls(d.repoUrl, d.liveUrl);
  if (problem) return { ok: false, error: problem };
  const cover = await resolveCover(userId, d.coverEvidenceId);
  if (!cover.ok) return cover;

  const department = d.departmentCode ? await db.department.findUnique({ where: { code: d.departmentCode }, select: { id: true } }) : null;
  const data = {
    title: d.title,
    departmentId: department?.id ?? null,
    summary: d.summary || null,
    tools: parseTools(d.tools),
    status: STATUS_TO_DB[d.status],
    repoUrl: d.repoUrl || null,
    liveUrl: d.liveUrl || null,
    coverEvidenceId: cover.id,
  };

  if (id) {
    const existing = await db.portfolioProject.findFirst({ where: { id, userId } });
    if (!existing) return { ok: false, error: "Piece not found." };
    const completedAt = d.status === "shipped" ? (existing.completedAt ?? new Date()) : null;
    await db.portfolioProject.update({ where: { id }, data: { ...data, completedAt } });
    return { ok: true, id };
  }
  const created = await db.portfolioProject.create({ data: { userId, ...data, completedAt: d.status === "shipped" ? new Date() : null } });
  return { ok: true, id: created.id };
}

export async function deletePiece(userId: string, id: string): Promise<boolean> {
  const { count } = await db.portfolioProject.deleteMany({ where: { id, userId } });
  return count > 0;
}

export type Suggestion = { missionCode: string; title: string; departmentCode: string; percentage: number | null };

/** Passed missions that are not yet in the portfolio: one click turns them into a shipped piece. */
export async function listSuggestions(userId: string): Promise<Suggestion[]> {
  const passed = await db.learnerMission.findMany({
    where: { userId, status: "PASSED", mission: { createdById: null, code: { not: null }, ...earnedMission } },
    include: { mission: { select: { id: true, code: true, title: true, department: { select: { code: true } } } } },
    orderBy: { completedAt: "desc" },
  });
  if (!passed.length) return [];
  const used = new Set(
    (await db.portfolioProject.findMany({ where: { userId, missionId: { in: passed.map((p) => p.missionId) } }, select: { missionId: true } })).map((p) => p.missionId),
  );
  const scores = await db.assessment.findMany({
    where: { userId, outcome: "PASS", rubric: { missionId: { in: passed.map((p) => p.missionId) } } },
    select: { percentage: true, rubric: { select: { missionId: true } } },
    orderBy: { assessedAt: "desc" },
  });
  const best = new Map<string, number>();
  for (const s of scores) if (!best.has(s.rubric.missionId)) best.set(s.rubric.missionId, s.percentage);
  return passed
    .filter((p) => !used.has(p.missionId))
    .map((p) => ({ missionCode: p.mission.code!, title: p.mission.title, departmentCode: p.mission.department.code, percentage: best.get(p.missionId) ?? null }));
}

/** Adds a passed mission to the portfolio as a shipped piece, using the evidence and links from its passing attempt. */
export async function addFromMission(userId: string, missionCode: string): Promise<Result<{ id: string }>> {
  const lm = await db.learnerMission.findFirst({
    where: { userId, status: "PASSED", mission: { code: missionCode, createdById: null, ...earnedMission } },
    include: { mission: { include: { department: { select: { id: true } } } } },
  });
  if (!lm) return { ok: false, error: "Only missions you have passed can be added." };
  if (await db.portfolioProject.findFirst({ where: { userId, missionId: lm.missionId }, select: { id: true } })) {
    return { ok: false, error: "This mission is already in your portfolio." };
  }
  const passing = await db.submission.findFirst({
    where: { learnerMissionId: lm.id, userId, status: "ASSESSED", assessment: { outcome: "PASS" } },
    orderBy: { attempt: "desc" },
    include: { evidence: { where: { file: { kind: { in: ["IMAGE", "SCREENSHOT"] } } }, orderBy: { createdAt: "asc" }, take: 1, select: { id: true } } },
  });
  const created = await db.portfolioProject.create({
    data: {
      userId,
      departmentId: lm.mission.department.id,
      missionId: lm.missionId,
      title: lm.mission.title,
      summary: lm.mission.objective,
      tools: lm.mission.requiredTools,
      status: "COMPLETED",
      repoUrl: passing?.githubUrl ?? null,
      liveUrl: passing?.liveUrl ?? null,
      coverEvidenceId: passing?.evidence[0]?.id ?? null,
      completedAt: lm.completedAt ?? new Date(),
    },
  });
  return { ok: true, id: created.id };
}

/** Skills earned through passed missions, grouped by department. */
export async function listSkills(userId: string) {
  const rows = await db.userSkill.findMany({
    where: { userId },
    orderBy: { earnedAt: "desc" },
    include: { skill: { select: { name: true, department: { select: { code: true } } } } },
  });
  const byDept = new Map<string, string[]>();
  for (const r of rows) {
    const list = byDept.get(r.skill.department.code) ?? [];
    list.push(r.skill.name);
    byDept.set(r.skill.department.code, list);
  }
  return [...byDept.entries()].map(([departmentCode, skills]) => ({ departmentCode, skills }));
}

// ── Capstone (the Base44 "main capstone" piece with a stage bar) ──

function capstoneStatus(done: number, total: number): ProjectStatus {
  return done === 0 ? "PLANNED" : done >= total ? "COMPLETED" : "IN_PROGRESS";
}

/** Creates or updates the user's single capstone and keeps its milestones in step with the requested stage count. */
export async function saveCapstone(userId: string, input: CapstoneInput): Promise<Result> {
  const parsed = capstoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const d = parsed.data;
  const problem = checkText(d.title, d.summary, d.tools) ?? checkUrls(d.repoUrl, d.liveUrl);
  if (problem) return { ok: false, error: problem };

  await db.$transaction(async (tx) => {
    const existing = await tx.capstoneProject.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, include: { milestones: { orderBy: { position: "asc" } } } });
    const base = { name: d.title, summary: d.summary || null, tools: parseTools(d.tools), repoUrl: d.repoUrl || null, liveUrl: d.liveUrl || null };
    const capstone = existing
      ? await tx.capstoneProject.update({ where: { id: existing.id }, data: base })
      : await tx.capstoneProject.create({ data: { userId, ...base } });

    const current = existing?.milestones ?? [];
    if (current.length < d.stages) {
      await tx.capstoneMilestone.createMany({
        data: Array.from({ length: d.stages - current.length }, (_, i) => ({
          capstoneId: capstone.id, position: current.length + i + 1, title: `Stage ${current.length + i + 1}`,
        })),
      });
    } else if (current.length > d.stages) {
      // Never delete finished stages: only trailing PENDING ones can be dropped.
      const removable = [...current].reverse().filter((m) => m.status === "PENDING").slice(0, current.length - d.stages);
      if (removable.length) await tx.capstoneMilestone.deleteMany({ where: { id: { in: removable.map((m) => m.id) } } });
    }
    const all = await tx.capstoneMilestone.findMany({ where: { capstoneId: capstone.id } });
    await tx.capstoneProject.update({ where: { id: capstone.id }, data: { status: capstoneStatus(all.filter((m) => m.status === "DONE").length, all.length) } });
  });
  return { ok: true };
}

/** Advances (+1) or steps back (-1) one stage, like the Base44 "advance / back" buttons. */
export async function moveCapstoneStage(userId: string, delta: 1 | -1, now: Date = new Date()): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const capstone = await tx.capstoneProject.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, include: { milestones: { orderBy: { position: "asc" } } } });
    if (!capstone) return false;
    const target = delta === 1 ? capstone.milestones.find((m) => m.status !== "DONE") : [...capstone.milestones].reverse().find((m) => m.status === "DONE");
    if (!target) return false;
    await tx.capstoneMilestone.update({
      where: { id: target.id },
      data: delta === 1 ? { status: "DONE", completedAt: now } : { status: "PENDING", completedAt: null },
    });
    const done = capstone.milestones.filter((m) => m.status === "DONE").length + delta;
    await tx.capstoneProject.update({ where: { id: capstone.id }, data: { status: capstoneStatus(done, capstone.milestones.length) } });
    return true;
  });
}
