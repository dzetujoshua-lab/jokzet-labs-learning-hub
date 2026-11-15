// Fulfils privacy requests that arrive by email, and shows the privacy audit trail. There is deliberately no app screen for
// this: it is run by the owner, with access to the database, after checking that the request really comes from the account
// holder (see docs/privacy/PRIVACY_REQUEST_PROCEDURE.md).
//
//   npx tsx scripts/privacy.ts audit
//   npx tsx scripts/privacy.ts export <email> <output-file.json>
//   npx tsx scripts/privacy.ts delete <email>            (dry run: shows what would be deleted)
//   npx tsx scripts/privacy.ts delete <email> --yes      (permanent)
//
// It acts on whatever DATABASE_URL points at (the host is printed first). Run it against production only when approved.
// Uploaded files are removed from storage only when NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN are set; otherwise their keys
// are printed so they can be removed.
import "dotenv/config";
import { existsSync, writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { getStore } from "@netlify/blobs";
import { PrismaClient } from "../src/generated/prisma/client";
import { collectExport, eraseAccount, serializeExport } from "../src/lib/privacy/core";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function userByEmail(email: string) {
  const u = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, email: true, role: true, createdAt: true } });
  if (!u) throw new Error("No account with that email address.");
  return u;
}

async function main() {
  const [cmd, email, arg] = process.argv.slice(2);
  console.log(`Database host: ${new URL(url!).host}`);

  if (cmd === "audit") {
    const events = await db.privacyEvent.findMany({ orderBy: { occurredAt: "desc" } });
    if (!events.length) return void console.log("No privacy events recorded.");
    const byMonth = new Map<string, number>();
    for (const e of events) {
      const key = `${e.occurredAt.toISOString().slice(0, 7)}  ${e.kind}  ${e.channel}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    console.log("month    event  channel  count");
    for (const [k, n] of [...byMonth].sort().reverse()) console.log(`${k}  ${n}`);
    console.log("\nLatest 20 (no names or emails are stored):");
    for (const e of events.slice(0, 20)) console.log(`${e.occurredAt.toISOString()}  ${e.kind}  ${e.channel}  subject ${e.subjectRef}`);
    return;
  }

  if (cmd === "export") {
    if (!email || !arg) throw new Error("Usage: export <email> <output-file.json>");
    if (existsSync(arg)) throw new Error(`${arg} already exists; choose a new file name.`);
    const u = await userByEmail(email);
    const out = await collectExport(db, u.id, "OWNER_REQUEST");
    writeFileSync(arg, serializeExport(out), { flag: "wx" });
    console.log(`Wrote ${arg} (${Object.values(out.counts).reduce((a, b) => a + b, 0)} records). It contains personal data: send it only to the verified account holder, then delete your copy.`);
    return;
  }

  if (cmd === "delete") {
    if (!email) throw new Error("Usage: delete <email> [--yes]");
    const u = await userByEmail(email);
    const files = await db.submissionFile.count({ where: { userId: u.id } });
    console.log(`Account: ${u.email} (${u.role}), created ${u.createdAt.toISOString().slice(0, 10)}, ${files} uploaded file(s).`);
    if (arg !== "--yes") return void console.log("Dry run. Nothing was deleted. Add --yes to delete this account permanently.");
    const result = await eraseAccount(db, u.id, "OWNER_REQUEST");
    if (!result.ok) throw new Error(result.error === "LAST_ADMIN" ? "This is the only active administrator; make another account an administrator first." : "That account no longer exists.");
    console.log("Account deleted and recorded in the privacy audit trail.");
    const { NETLIFY_SITE_ID: siteID, NETLIFY_AUTH_TOKEN: token } = process.env;
    if (!result.storageKeys.length) return;
    if (siteID && token) {
      const store = getStore({ name: "evidence", siteID, token, consistency: "strong" });
      const settled = await Promise.allSettled(result.storageKeys.map((k) => store.delete(k)));
      console.log(`Removed ${settled.filter((s) => s.status === "fulfilled").length} of ${result.storageKeys.length} stored file(s).`);
    } else {
      console.log(`${result.storageKeys.length} uploaded file(s) are still in storage. Remove these keys from the "evidence" store:\n${result.storageKeys.join("\n")}`);
    }
    return;
  }

  console.log("Commands: audit | export <email> <file.json> | delete <email> [--yes]");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
