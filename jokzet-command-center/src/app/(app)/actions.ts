"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { setCorrectionResolved, assessSubmission, type AssessResult } from "@/lib/assessments/service";
import { deleteEvidence } from "@/lib/evidence/service";
import { attachToDraft, detachFromDraft } from "@/lib/missions/submissions";
import { createMissionSchema } from "@/lib/missions/schema";
import { saveProgress, saveProgressSchema, startMission, submitMission } from "@/lib/missions/progress";
import { milestoneSchema } from "@/lib/missions/schema";
import { createCustomMission, deleteMission, saveNextMilestone, setMissionDone } from "@/lib/missions/service";
import { createTestNotification, markAllRead } from "@/lib/notifications/engine";
import { setDailyStatus, USER_SETTABLE } from "@/lib/schedule/daily";
import { confirmImport, previewImport, type ImportPreview, type ImportResult } from "@/lib/schedule/importer";
import { MAX_IMPORT_BYTES } from "@/lib/schedule/constants";
import { addFromMission, deletePiece, moveCapstoneStage, saveCapstone, savePiece, type CapstoneInput, type PieceInput } from "@/lib/portfolio/service";
import {
  adjustStock, createSale, deleteContact, deleteExpense, deleteProduct, recordPayment, restock, saveContact, saveExpense, saveProduct, voidSale,
  type ContactInput, type ExpenseInput, type ProductInput, type RestockInput, type SaleInput,
} from "@/lib/businessos/service";
import { LIMITS, bucketKey, rateLimitHit } from "@/lib/ratelimit";
import { setChannelFlag, updateSettings, type SettingsInput, type SettingsResult } from "@/lib/schedule/settings";

const idSchema = z.string().min(1).max(64);

function refresh() {
  revalidatePath("/", "layout");
}

/** Every action re-verifies the session and scopes by the session user; ids from the client are never trusted. */
export async function toggleMission(learnerMissionId: string, done: boolean) {
  const user = await requireUser();
  await setMissionDone(user.id, idSchema.parse(learnerMissionId), done);
  refresh();
}

export async function removeMission(learnerMissionId: string) {
  const user = await requireUser();
  await deleteMission(user.id, idSchema.parse(learnerMissionId));
  refresh();
}

export type MissionFormState = { ok?: boolean; error?: string } | undefined;

export async function createMission(_prev: MissionFormState, formData: FormData): Promise<MissionFormState> {
  const user = await requireUser();
  const parsed = createMissionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  await createCustomMission(user.id, parsed.data);
  refresh();
  return { ok: true };
}

export async function updateMilestone(departmentId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const checked = milestoneSchema.safeParse(text);
  if (!checked.success) return { ok: false, error: checked.error.issues[0]?.message ?? "Check the milestone and try again." };
  try {
    const saved = await saveNextMilestone(user.id, idSchema.parse(departmentId), text);
    refresh();
    return saved ? { ok: true } : { ok: false, error: "Department not found." };
  } catch {
    return { ok: false, error: "Keep the milestone under 200 characters." };
  }
}

// ── Mission workflow: start, save progress, submit ──

const codeSchema = z.string().regex(/^[A-Z]+-L\d+-\d{2}$/);

export async function startMissionAction(code: string) {
  const user = await requireUser();
  await startMission(user.id, codeSchema.parse(code));
  refresh();
}

export type WorkflowState = { ok?: boolean; error?: string; message?: string } | undefined;

export async function saveProgressAction(learnerMissionId: string, _prev: WorkflowState, formData: FormData): Promise<WorkflowState> {
  const user = await requireUser();
  const input = { completedSteps: formData.getAll("step").map(String), notes: String(formData.get("notes") ?? "") };
  const checked = saveProgressSchema.safeParse(input);
  if (!checked.success) return { error: checked.error.issues[0]?.message ?? "Check your notes and try again." };
  const saved = await saveProgress(user.id, idSchema.parse(learnerMissionId), input);
  if (!saved) return { error: "Mission not found." };
  refresh();
  return { ok: true, message: "Progress saved" };
}

export async function submitMissionAction(learnerMissionId: string, _prev: WorkflowState, formData: FormData): Promise<WorkflowState> {
  const user = await requireUser();
  const result = await submitMission(user.id, idSchema.parse(learnerMissionId), {
    explanation: String(formData.get("explanation") ?? ""),
    githubUrl: String(formData.get("githubUrl") ?? ""),
    liveUrl: String(formData.get("liveUrl") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, message: `Attempt ${result.attempt} submitted` };
}

// ── Imported schedule, daily missions, reminders ──

const importText = z.string().min(1).max(MAX_IMPORT_BYTES);

export async function previewScheduleAction(text: string): Promise<ImportPreview> {
  const user = await requireUser();
  const parsed = importText.safeParse(text);
  if (!parsed.success) return { ok: false, errors: ["The file is empty or larger than 200 KB."] };
  return previewImport(user.id, parsed.data);
}

export async function confirmScheduleAction(text: string): Promise<ImportResult> {
  const user = await requireUser();
  const parsed = importText.safeParse(text);
  if (!parsed.success) return { ok: false, errors: ["The file is empty or larger than 200 KB."] };
  const result = await confirmImport(user.id, parsed.data);
  refresh();
  return result;
}

export async function saveSettingsAction(input: SettingsInput): Promise<SettingsResult> {
  const user = await requireUser();
  const result = await updateSettings(user.id, input);
  refresh();
  return result;
}

/** Called after the user explicitly grants (or revokes) browser permission from the Settings page. */
export async function setBrowserEnabledAction(enabled: boolean): Promise<void> {
  const user = await requireUser();
  await setChannelFlag(user.id, "browserEnabled", z.boolean().parse(enabled));
  refresh();
}

export async function setDailyStatusAction(instanceId: string, status: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const target = z.enum(USER_SETTABLE as [string, ...string[]]).safeParse(status);
  if (!target.success) return { ok: false, error: "That status cannot be set manually." };
  const result = await setDailyStatus(user.id, idSchema.parse(instanceId), target.data as (typeof USER_SETTABLE)[number]);
  refresh();
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function sendTestNotificationAction(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const allowed = await rateLimitHit(bucketKey("testnotif:user", user.id), LIMITS.testNotificationUser);
  if (!allowed.ok) return { ok: false };
  const key = await createTestNotification(user.id);
  refresh();
  return { ok: key !== null };
}

export async function markNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await markAllRead(user.id);
  refresh();
}

// ── Evidence vault, assessments, corrections ──

export async function deleteEvidenceAction(evidenceId: string): Promise<void> {
  const user = await requireUser();
  await deleteEvidence(user.id, idSchema.parse(evidenceId));
  refresh();
}

export async function attachEvidenceAction(learnerMissionId: string, evidenceId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const result = await attachToDraft(user.id, idSchema.parse(learnerMissionId), idSchema.parse(evidenceId));
  refresh();
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function detachEvidenceAction(evidenceId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const done = await detachFromDraft(user.id, idSchema.parse(evidenceId));
  refresh();
  return { ok: done };
}

export async function assessSubmissionAction(
  submissionId: string, scores: { criterionId: string; points: number; comment?: string }[], feedback: string,
): Promise<AssessResult> {
  const user = await requireUser();
  const result = await assessSubmission(user.id, idSchema.parse(submissionId), { scores, feedback: feedback || undefined });
  refresh();
  return result;
}

export async function resolveCorrectionAction(feedbackId: string, resolved: boolean): Promise<void> {
  const user = await requireUser();
  await setCorrectionResolved(user.id, idSchema.parse(feedbackId), z.boolean().parse(resolved));
  refresh();
}

// ── Portfolio ──

export async function savePieceAction(id: string | null, input: PieceInput): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const result = await savePiece(user.id, id === null ? null : idSchema.parse(id), input);
  if (result.ok) refresh();
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function deletePieceAction(id: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const ok = await deletePiece(user.id, idSchema.parse(id));
  refresh();
  return { ok };
}

export async function addFromMissionAction(missionCode: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const result = await addFromMission(user.id, z.string().min(1).max(64).parse(missionCode));
  if (result.ok) refresh();
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function saveCapstoneAction(input: CapstoneInput): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const result = await saveCapstone(user.id, input);
  if (result.ok) refresh();
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function moveCapstoneAction(delta: 1 | -1): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const ok = await moveCapstoneStage(user.id, z.union([z.literal(1), z.literal(-1)]).parse(delta));
  refresh();
  return { ok };
}

// ── BusinessOS Ghana (capstone workspace) ──

type Done = { ok: boolean; error?: string };
const done = (r: { ok: boolean; error?: string }): Done => {
  if (r.ok) refresh();
  return r.ok ? { ok: true } : { ok: false, error: (r as { error: string }).error };
};
const kindSchema = z.enum(["customer", "supplier"]);

export async function saveContactAction(kind: "customer" | "supplier", recordId: string | null, input: ContactInput): Promise<Done> {
  const user = await requireUser();
  return done(await saveContact(user.id, kindSchema.parse(kind), recordId === null ? null : idSchema.parse(recordId), input));
}
export async function deleteContactAction(kind: "customer" | "supplier", recordId: string): Promise<Done> {
  const user = await requireUser();
  return done({ ok: await deleteContact(user.id, kindSchema.parse(kind), idSchema.parse(recordId)), error: "Not found." });
}
export async function saveProductAction(productId: string | null, input: ProductInput): Promise<Done> {
  const user = await requireUser();
  return done(await saveProduct(user.id, productId === null ? null : idSchema.parse(productId), input));
}
export async function deleteProductAction(productId: string): Promise<Done> {
  const user = await requireUser();
  return done({ ok: await deleteProduct(user.id, idSchema.parse(productId)), error: "Not found." });
}
export async function restockAction(productId: string, input: RestockInput): Promise<Done> {
  const user = await requireUser();
  return done(await restock(user.id, idSchema.parse(productId), input));
}
export async function adjustStockAction(productId: string, delta: number, note: string): Promise<Done> {
  const user = await requireUser();
  return done(await adjustStock(user.id, idSchema.parse(productId), z.number().int().parse(delta), z.string().max(200).parse(note)));
}
export async function createSaleAction(input: SaleInput): Promise<Done> {
  const user = await requireUser();
  return done(await createSale(user.id, input));
}
export async function recordPaymentAction(saleId: string, amount: string): Promise<Done> {
  const user = await requireUser();
  return done(await recordPayment(user.id, idSchema.parse(saleId), z.string().max(30).parse(amount)));
}
export async function voidSaleAction(saleId: string): Promise<Done> {
  const user = await requireUser();
  return done({ ok: await voidSale(user.id, idSchema.parse(saleId)), error: "Not found." });
}
export async function saveExpenseAction(expenseId: string | null, input: ExpenseInput): Promise<Done> {
  const user = await requireUser();
  return done(await saveExpense(user.id, expenseId === null ? null : idSchema.parse(expenseId), input));
}
export async function deleteExpenseAction(expenseId: string): Promise<Done> {
  const user = await requireUser();
  return done({ ok: await deleteExpense(user.id, idSchema.parse(expenseId)), error: "Not found." });
}
