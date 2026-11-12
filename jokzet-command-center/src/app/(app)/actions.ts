"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { setCorrectionResolved, assessSubmission, type AssessResult } from "@/lib/assessments/service";
import { deleteEvidence } from "@/lib/evidence/service";
import { attachToDraft, detachFromDraft } from "@/lib/missions/submissions";
import { createMissionSchema } from "@/lib/missions/schema";
import { saveProgress, startMission, submitMission } from "@/lib/missions/progress";
import { createCustomMission, deleteMission, saveNextMilestone, setMissionDone } from "@/lib/missions/service";
import { createTestNotification, markAllRead } from "@/lib/notifications/engine";
import { setDailyStatus, USER_SETTABLE } from "@/lib/schedule/daily";
import { confirmImport, previewImport, type ImportPreview, type ImportResult } from "@/lib/schedule/importer";
import { MAX_IMPORT_BYTES } from "@/lib/schedule/constants";
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
  const saved = await saveProgress(user.id, idSchema.parse(learnerMissionId), {
    completedSteps: formData.getAll("step").map(String),
    notes: String(formData.get("notes") ?? ""),
  });
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
