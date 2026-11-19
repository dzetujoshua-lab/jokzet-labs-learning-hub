import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Staff roles, managed by Academy Admins in the Admin Centre. Every rule is enforced here, on the server, from the database
 * (never from the cookie or the page): the acting account is re-read and must be an ADMIN right now.
 *
 * Names: the stored role AUTHOR is shown as "Curriculum Manager" (reviews learning resources, frameworks and syllabus drafts);
 * ADMIN is the "Academy Admin" (final approval before anything is published); REVIEWER is the "Assessment Reviewer" (evaluates
 * learner submissions). No named person is built in: whoever the Admin Centre assigns holds the role.
 */
export const ROLE_LABEL = { ADMIN: "Academy Admin", AUTHOR: "Curriculum Manager", REVIEWER: "Assessment Reviewer", LEARNER: "Learner" } as const;
export type StaffRole = keyof typeof ROLE_LABEL;
export const ASSIGNABLE_ROLES = ["AUTHOR", "REVIEWER", "ADMIN", "LEARNER"] as const; // LEARNER means "remove the staff role"

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export const roleSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(ASSIGNABLE_ROLES),
  /** Making someone an Academy Admin needs the address typed a second time, so it cannot happen by a slip. */
  confirmEmail: z.string().trim().toLowerCase().max(254).optional(),
});
export const scopeSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), department: z.string().trim().toLowerCase().min(1).max(40) });

export type StaffRow = { id: string; email: string; displayName: string; role: StaffRole; label: string; scopes: string[] };

async function requireAdmin(actorId: string) {
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { id: true, role: true } });
  return actor?.role === "ADMIN" ? actor : null;
}

export async function listStaff(actorId: string, search?: string): Promise<Result<{ staff: StaffRow[]; departments: { code: string; name: string }[] }>> {
  if (!(await requireAdmin(actorId))) return fail("Only an Academy Admin can manage staff.");
  const q = (search ?? "").replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const rows = await db.user.findMany({
    where: { role: { not: "LEARNER" }, ...(q.length >= 2 ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { profile: { displayName: { contains: q, mode: "insensitive" as const } } }] } : {}) },
    select: { id: true, email: true, role: true, profile: { select: { displayName: true } }, reviewerScopes: { select: { department: { select: { code: true } } } } },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });
  const departments = await db.department.findMany({ select: { code: true, name: true }, orderBy: { sortOrder: "asc" } });
  return {
    ok: true, departments,
    staff: rows.map((r) => ({ id: r.id, email: r.email, displayName: r.profile?.displayName ?? r.email, role: r.role, label: ROLE_LABEL[r.role], scopes: r.reviewerScopes.map((s) => s.department.code).sort() })),
  };
}

/** Sets a person's staff role (or removes it with LEARNER). Written to RoleAudit with the acting admin. */
export async function setStaffRole(actorId: string, input: unknown): Promise<Result<{ email: string; role: StaffRole }>> {
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return fail("Enter a valid email address and choose a role.");
  const { email, role, confirmEmail } = parsed.data;
  if (!(await requireAdmin(actorId))) return fail("Only an Academy Admin can change roles.");
  if (role === "ADMIN" && confirmEmail !== email) return fail("To make someone an Academy Admin, type their email address again to confirm.");

  return db.$transaction(async (tx): Promise<Result<{ email: string; role: StaffRole }>> => {
    const target = await tx.user.findUnique({ where: { email }, select: { id: true, email: true, role: true } });
    if (!target) return fail("No account has that email address. The person must register first.");
    if (target.id === actorId) return fail("You can't change your own role. Ask another Academy Admin.");
    if (target.role === role) return fail(`They are already ${ROLE_LABEL[role]}.`);
    if (target.role === "ADMIN" && role !== "ADMIN" && (await tx.user.count({ where: { role: "ADMIN" } })) <= 1) return fail("The last Academy Admin can't be removed.");

    await tx.user.update({ where: { id: target.id }, data: { role } });
    await tx.roleAudit.create({ data: { targetUserId: target.id, targetEmail: target.email, action: role === "LEARNER" ? "REVOKED" : "GRANTED", role: role === "LEARNER" ? target.role : role, actor: `admin:${actorId}`, note: `was ${target.role}` } });
    if (role !== "REVIEWER") {
      const scopes = await tx.reviewerScope.findMany({ where: { userId: target.id }, select: { department: { select: { code: true } } } });
      if (scopes.length) {
        await tx.reviewerScope.deleteMany({ where: { userId: target.id } });
        await tx.roleAudit.createMany({ data: scopes.map((s) => ({ targetUserId: target.id, targetEmail: target.email, action: "SCOPE_REMOVED" as const, departmentCode: s.department.code, actor: `admin:${actorId}`, note: "role changed" })) });
      }
    }
    return { ok: true, email: target.email, role };
  });
}

/** Which departments an Assessment Reviewer may review. A reviewer sees nothing until at least one is added. */
export async function setReviewerScope(actorId: string, input: unknown, add: boolean): Promise<Result> {
  const parsed = scopeSchema.safeParse(input);
  if (!parsed.success) return fail("Choose a reviewer and a department.");
  if (!(await requireAdmin(actorId))) return fail("Only an Academy Admin can change reviewer scopes.");
  const target = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, email: true, role: true } });
  if (!target || target.role !== "REVIEWER") return fail("Scopes apply to Assessment Reviewers only.");
  const dept = await db.department.findUnique({ where: { code: parsed.data.department }, select: { id: true, code: true } });
  if (!dept) return fail("Unknown department.");
  await db.$transaction([
    add
      ? db.reviewerScope.upsert({ where: { userId_departmentId: { userId: target.id, departmentId: dept.id } }, create: { userId: target.id, departmentId: dept.id }, update: {} })
      : db.reviewerScope.deleteMany({ where: { userId: target.id, departmentId: dept.id } }),
    db.roleAudit.create({ data: { targetUserId: target.id, targetEmail: target.email, action: add ? "SCOPE_ADDED" : "SCOPE_REMOVED", departmentCode: dept.code, actor: `admin:${actorId}` } }),
  ]);
  return { ok: true };
}
