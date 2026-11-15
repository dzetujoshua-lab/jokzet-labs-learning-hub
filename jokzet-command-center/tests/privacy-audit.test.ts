import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { subjectRef } from "@/lib/privacy/core";
import { buildUserExport } from "@/lib/privacy/export";
import { DELETE_PHRASE, deleteAccount } from "@/lib/privacy/deletion";

const PASSWORD = "correct horse battery staple";
const PREFIX = "audit-test";
const ids: Record<string, string> = {};
let dir = "";

async function makeUser(name: string, role: "LEARNER" | "ADMIN" = "LEARNER") {
  const u = await db.user.create({ data: { email: `${PREFIX}-${name}@example.test`, passwordHash: await hashPassword(PASSWORD), role, profile: { create: { displayName: `Audit ${name}` } } } });
  ids[name] = u.id;
  return u.id;
}
const eventsFor = (id: string) => db.privacyEvent.findMany({ where: { subjectRef: subjectRef(id) }, orderBy: { occurredAt: "asc" } });
const cli = (...args: string[]) =>
  execFileSync("npx", ["tsx", "scripts/privacy.ts", ...args], { env: process.env, encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "pipe"] });
const cliFails = (...args: string[]) => {
  try {
    cli(...args);
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
  return null;
};

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "jz-privacy-"));
  await db.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}, 60_000);
afterAll(async () => {
  await db.privacyEvent.deleteMany({ where: { subjectRef: { in: Object.values(ids).map(subjectRef) } } });
  await db.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe("the audit trail holds no personal data", () => {
  it("records a self-service export with a one-way reference only", async () => {
    const id = await makeUser("export");
    await buildUserExport(id);
    const [e] = await eventsFor(id);
    expect(e).toMatchObject({ kind: "EXPORT_DOWNLOADED", channel: "SELF_SERVICE" });
    expect(e.subjectRef).toMatch(/^[a-f0-9]{16}$/);
    expect(JSON.stringify(e)).not.toContain(id);
    expect(JSON.stringify(e)).not.toContain(`${PREFIX}-export@example.test`);
  });

  it("records a self-service deletion, and the record outlives the account", async () => {
    const id = await makeUser("selfdel");
    expect((await deleteAccount(id, { password: PASSWORD, phrase: DELETE_PHRASE })).ok).toBe(true);
    expect(await db.user.count({ where: { id } })).toBe(0);
    expect((await eventsFor(id)).map((e) => [e.kind, e.channel])).toEqual([["ACCOUNT_DELETED", "SELF_SERVICE"]]);
  });

  it("records nothing when the deletion is refused", async () => {
    const id = await makeUser("refused");
    await deleteAccount(id, { password: "wrong password!!", phrase: DELETE_PHRASE });
    await deleteAccount(id, { password: PASSWORD, phrase: "nope" });
    expect(await eventsFor(id)).toEqual([]);
    expect(await db.user.count({ where: { id } })).toBe(1);
  });
});

describe("the owner command for email requests", () => {
  it("exports an account to a new file, records it, and never overwrites", async () => {
    const id = await makeUser("cliexport");
    const out = path.join(dir, "export.json");
    expect(cli("export", `${PREFIX}-cliexport@example.test`, out)).toContain("Wrote");
    const body = JSON.parse(readFileSync(out, "utf8"));
    expect(body.account.id).toBe(id);
    expect(body.data.profile).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect((await eventsFor(id)).map((e) => e.channel)).toEqual(["OWNER_REQUEST"]);
    expect(cliFails("export", `${PREFIX}-cliexport@example.test`, out)).toContain("already exists");
  }, 60_000);

  it("fails clearly for an unknown email", () => {
    expect(cliFails("export", "nobody-here@example.test", path.join(dir, "x.json"))).toContain("No account with that email");
    expect(existsSync(path.join(dir, "x.json"))).toBe(false);
  }, 60_000);

  it("deletes only with --yes: a dry run changes nothing", async () => {
    const id = await makeUser("clidel");
    expect(cli("delete", `${PREFIX}-clidel@example.test`)).toContain("Dry run");
    expect(await db.user.count({ where: { id } })).toBe(1);
    expect(await eventsFor(id)).toEqual([]);
    expect(cli("delete", `${PREFIX}-clidel@example.test`, "--yes")).toContain("Account deleted");
    expect(await db.user.count({ where: { id } })).toBe(0);
    expect((await eventsFor(id)).map((e) => [e.kind, e.channel])).toEqual([["ACCOUNT_DELETED", "OWNER_REQUEST"]]);
  }, 90_000);

  it("lists the audit trail without any names or emails", async () => {
    const out = cli("audit");
    expect(out).toContain("ACCOUNT_DELETED");
    expect(out).not.toContain(`${PREFIX}-`);
  }, 60_000);
});
