// Grants and revokes the ADMIN / REVIEWER / AUTHOR roles and reviewer department scopes. There is deliberately no app
// endpoint for this: roles are changed only by someone with access to the database, and every change is written to RoleAudit.
//
//   npx tsx scripts/roles.ts list
//   npx tsx scripts/roles.ts grant <email> <ADMIN|REVIEWER|AUTHOR>
//   npx tsx scripts/roles.ts revoke <email>
//   npx tsx scripts/roles.ts scope-add <email> <department-code>
//   npx tsx scripts/roles.ts scope-remove <email> <department-code>
//
// It acts on whatever DATABASE_URL points at (the host is printed first). Run it against production only when approved.
import "dotenv/config";
import os from "node:os";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const ROLES = ["ADMIN", "REVIEWER", "AUTHOR"] as const;
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const actor = `cli:${os.userInfo().username}`;

async function user(email: string) {
  const u = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, email: true, role: true } });
  if (!u) throw new Error(`No account with that email address.`);
  return u;
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  console.log(`Database host: ${new URL(url!).host}`);

  if (cmd === "list") {
    const rows = await db.user.findMany({ where: { role: { not: "LEARNER" } }, select: { email: true, role: true, reviewerScopes: { select: { department: { select: { code: true } } } } }, orderBy: { email: "asc" } });
    if (!rows.length) console.log("No elevated roles.");
    for (const r of rows) console.log(`${r.email}  ${r.role}${r.reviewerScopes.length ? `  [${r.reviewerScopes.map((s) => s.department.code).join(", ")}]` : ""}`);
    return;
  }

  if (cmd === "grant" && a && b) {
    const role = b.toUpperCase();
    if (!(ROLES as readonly string[]).includes(role)) throw new Error(`Role must be one of ${ROLES.join(", ")}.`);
    const u = await user(a);
    await db.$transaction([
      db.user.update({ where: { id: u.id }, data: { role: role as (typeof ROLES)[number] } }),
      db.roleAudit.create({ data: { targetUserId: u.id, targetEmail: u.email, action: "GRANTED", role, actor, note: `was ${u.role}` } }),
    ]);
    console.log(`${u.email}: ${u.role} -> ${role}`);
    if (role === "REVIEWER") console.log("A reviewer sees nothing until a department scope is added (scope-add).");
    return;
  }

  if (cmd === "revoke" && a) {
    const u = await user(a);
    const scopes = await db.reviewerScope.findMany({ where: { userId: u.id }, select: { department: { select: { code: true } } } });
    await db.$transaction([
      db.user.update({ where: { id: u.id }, data: { role: "LEARNER" } }),
      db.reviewerScope.deleteMany({ where: { userId: u.id } }),
      db.roleAudit.create({ data: { targetUserId: u.id, targetEmail: u.email, action: "REVOKED", role: u.role, actor } }),
      ...scopes.map((s) => db.roleAudit.create({ data: { targetUserId: u.id, targetEmail: u.email, action: "SCOPE_REMOVED", departmentCode: s.department.code, actor, note: "role revoked" } })),
    ]);
    console.log(`${u.email}: ${u.role} -> LEARNER`);
    return;
  }

  if ((cmd === "scope-add" || cmd === "scope-remove") && a && b) {
    const u = await user(a);
    if (u.role !== "REVIEWER") throw new Error(`Scopes apply to reviewers; this account is ${u.role}. Grant REVIEWER first.`);
    const dept = await db.department.findUnique({ where: { code: b.toLowerCase() }, select: { id: true, code: true } });
    if (!dept) throw new Error("Unknown department code.");
    if (cmd === "scope-add") {
      await db.$transaction([
        db.reviewerScope.upsert({ where: { userId_departmentId: { userId: u.id, departmentId: dept.id } }, create: { userId: u.id, departmentId: dept.id }, update: {} }),
        db.roleAudit.create({ data: { targetUserId: u.id, targetEmail: u.email, action: "SCOPE_ADDED", departmentCode: dept.code, actor } }),
      ]);
    } else {
      await db.$transaction([
        db.reviewerScope.deleteMany({ where: { userId: u.id, departmentId: dept.id } }),
        db.roleAudit.create({ data: { targetUserId: u.id, targetEmail: u.email, action: "SCOPE_REMOVED", departmentCode: dept.code, actor } }),
      ]);
    }
    console.log(`${u.email}: ${cmd} ${dept.code}`);
    return;
  }

  console.error("Usage: roles.ts list | grant <email> <ADMIN|REVIEWER|AUTHOR> | revoke <email> | scope-add|scope-remove <email> <dept>");
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
