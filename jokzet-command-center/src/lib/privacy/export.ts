import "server-only";
import { db } from "@/lib/db";
import { EXPORTED, EXPORT_NOTES, type ExportSpec } from "./export-spec";

export const EXPORT_VERSION = 1;

type Delegate = { findMany(args: { where: unknown; omit?: unknown }): Promise<unknown[]> };

async function rows(spec: ExportSpec, userId: string) {
  const delegate = (db as unknown as Record<string, Delegate>)[spec.delegate];
  if (!delegate) throw new Error(`Export spec ${spec.key} names an unknown model delegate (${spec.delegate}).`);
  return delegate.findMany({ where: spec.where(userId), ...(spec.omit ? { omit: spec.omit } : {}) });
}

/**
 * Everything the platform holds about one learner, as plain data. Always scoped by the caller's own id: this function is
 * never given an id from a request. Read-only.
 */
export async function buildUserExport(userId: string) {
  const account = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true },
  });
  const data: Record<string, unknown[]> = {};
  const results = await Promise.all(EXPORTED.map((spec) => rows(spec, userId)));
  EXPORTED.forEach((spec, i) => { data[spec.key] = results[i]; });
  return {
    exportVersion: EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    format: "JOKZET Labs Learning Command Center personal data export",
    account,
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
    notes: EXPORT_NOTES,
    data,
  };
}

export function serializeExport(payload: unknown): string {
  return JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
}
