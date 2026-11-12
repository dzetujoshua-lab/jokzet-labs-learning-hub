import { z } from "zod";
import type { EvidenceType, FileKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DEPARTMENTS } from "@/lib/departments";
import { attachToDraft } from "@/lib/missions/submissions";
import { dateToISO, EVIDENCE_TYPES, isoToDate, toEnum, toLabel } from "@/lib/programme";
import { getStorage } from "@/lib/storage";
import { checkUpload, MAX_USER_STORAGE_BYTES, newStorageKey, type StoredKind } from "./files";
import { detectSecretInUrl, detectSecrets, secretMessage } from "./secrets";

const codes = DEPARTMENTS.map((d) => d.code) as [string, ...string[]];

export const evidenceInputSchema = z.object({
  title: z.string().trim().min(1, "Say what this proves").max(120, "Keep the title under 120 characters"),
  departmentCode: z.enum(codes, { error: "Pick a department" }),
  kind: z.enum(EVIDENCE_TYPES),
  description: z.string().trim().max(2000, "Keep the notes under 2,000 characters").default(""),
  linkUrl: z
    .string()
    .trim()
    .max(500)
    .default("")
    .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Enter a full link starting with http:// or https://"),
  capturedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  missionCode: z.string().max(40).optional(),
});
export type EvidenceInput = z.input<typeof evidenceInputSchema>;

/** Which stored file kinds are acceptable for each evidence type. */
const ALLOWED_FILE: Record<EvidenceType, StoredKind[]> = {
  SCREENSHOT: ["IMAGE"],
  PHOTO: ["IMAGE"],
  VIDEO: ["VIDEO"],
  CODE: ["CODE"],
  DOCUMENT: ["PDF", "CODE"],
  LINK: [],
};

export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

export type Upload = { name: string; data: Buffer };

/** Creates a vault entry (file, link and/or written explanation). Files are validated and stored privately. */
export async function createEvidence(
  userId: string, input: EvidenceInput, upload?: Upload, attachToLearnerMissionId?: string,
): Promise<CreateResult> {
  const parsed = evidenceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const data = parsed.data;
  const kind = toEnum(data.kind) as EvidenceType;

  // At least one real piece of proof.
  if (!upload && !data.linkUrl && data.description.length < 30) {
    return { ok: false, error: "Add a file, a link, or a written explanation of at least 30 characters." };
  }
  if (kind === "LINK" && !data.linkUrl) return { ok: false, error: "A link evidence entry needs a link." };

  // No secrets in text or links.
  const textSecrets = detectSecrets(`${data.title}\n${data.description}`);
  if (textSecrets.length) return { ok: false, error: secretMessage(textSecrets) };
  if (data.linkUrl && detectSecretInUrl(data.linkUrl)) return { ok: false, error: "This link seems to contain a token or key. Remove it before saving." };

  const department = await db.department.findUnique({ where: { code: data.departmentCode } });
  if (!department) return { ok: false, error: "Unknown department." };
  let missionId: string | null = null;
  if (data.missionCode) {
    const mission = await db.mission.findFirst({ where: { code: data.missionCode, createdById: null } });
    if (!mission) return { ok: false, error: "Unknown mission." };
    missionId = mission.id;
  }

  let stored: { key: string; check: Extract<ReturnType<typeof checkUpload>, { ok: true }> } | null = null;
  if (upload) {
    const check = checkUpload(upload.name, upload.data);
    if (!check.ok) return { ok: false, error: check.error };
    if (!ALLOWED_FILE[kind].includes(check.kind)) {
      return { ok: false, error: `A ${check.kind.toLowerCase()} file does not fit the "${toLabel(kind)}" evidence type. Pick a matching type.` };
    }
    const used = await db.submissionFile.aggregate({ where: { userId }, _sum: { sizeBytes: true } });
    if ((used._sum.sizeBytes ?? 0) + check.size > MAX_USER_STORAGE_BYTES) {
      return { ok: false, error: "You have reached your storage limit. Delete some evidence first." };
    }
    stored = { key: newStorageKey(), check };
    await getStorage().put(stored.key, upload.data);
  }

  try {
    const item = await db.$transaction(async (tx) => {
      const file = stored
        ? await tx.submissionFile.create({
            data: {
              userId, storageKey: stored.key, originalName: stored.check.safeName, mimeType: stored.check.mime,
              sizeBytes: stored.check.size, kind: stored.check.kind as FileKind, sha256: stored.check.sha256,
            },
          })
        : null;
      return tx.evidenceItem.create({
        data: {
          userId, departmentId: department.id, missionId, title: data.title, kind,
          description: data.description || null, linkUrl: data.linkUrl || null,
          capturedDate: isoToDate(data.capturedDate), fileId: file?.id ?? null,
        },
      });
    });
    if (attachToLearnerMissionId) {
      const attached = await attachToDraft(userId, attachToLearnerMissionId, item.id);
      if (!attached.ok) return { ok: false, error: attached.error };
    }
    return { ok: true, id: item.id };
  } catch (error) {
    if (stored) await getStorage().delete(stored.key).catch(() => undefined); // never leave an orphaned file behind
    throw error;
  }
}

export type EvidenceView = {
  id: string;
  title: string;
  kind: string; // label, e.g. "Screenshot"
  description: string | null;
  linkUrl: string | null;
  capturedDate: string;
  status: "logged" | "verified";
  departmentCode: string;
  fileName: string | null;
  fileKind: FileKind | null;
  sizeBytes: number | null;
  missionTitle: string | null;
  attached: boolean;
  locked: boolean; // attached to a submission that was already sent: cannot be deleted
};

export async function listEvidence(userId: string): Promise<EvidenceView[]> {
  const rows = await db.evidenceItem.findMany({
    where: { userId },
    orderBy: [{ capturedDate: "desc" }, { createdAt: "desc" }],
    include: {
      department: { select: { code: true } },
      file: { select: { originalName: true, kind: true, sizeBytes: true } },
      mission: { select: { title: true } },
      submission: { select: { status: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    kind: toLabel(r.kind),
    description: r.description,
    linkUrl: r.linkUrl,
    capturedDate: dateToISO(r.capturedDate),
    status: r.status === "VERIFIED" ? "verified" : "logged",
    departmentCode: r.department.code,
    fileName: r.file?.originalName ?? null,
    fileKind: r.file?.kind ?? null,
    sizeBytes: r.file?.sizeBytes ?? null,
    missionTitle: r.mission?.title ?? null,
    attached: r.submissionId !== null,
    locked: r.submission !== null && r.submission.status !== "DRAFT",
  }));
}

/** Deletes an entry and its stored file. Evidence in a sent submission is kept (it backs an assessment). */
export async function deleteEvidence(userId: string, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const item = await db.evidenceItem.findFirst({ where: { id, userId }, include: { file: true, submission: { select: { status: true } } } });
  if (!item) return { ok: false, error: "Evidence not found." };
  if (item.submission && item.submission.status !== "DRAFT") {
    return { ok: false, error: "This evidence is part of a submitted mission and cannot be deleted." };
  }
  await db.$transaction(async (tx) => {
    await tx.evidenceItem.delete({ where: { id: item.id } });
    if (item.fileId) await tx.submissionFile.delete({ where: { id: item.fileId } });
  });
  if (item.file) await getStorage().delete(item.file.storageKey).catch(() => undefined);
  return { ok: true };
}

/** The stored file behind an evidence entry, only for its owner. */
export async function getEvidenceFile(userId: string, id: string) {
  const item = await db.evidenceItem.findFirst({ where: { id, userId }, include: { file: true } });
  return item?.file ?? null;
}
