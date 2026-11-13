import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { createEvidence } from "@/lib/evidence/service";
import { DELETE_PHRASE, deleteAccount, matchesPhrase } from "@/lib/privacy/deletion";
import { LocalDiskStorage, setStorageForTests } from "@/lib/storage";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
const PASSWORD = "correct horse battery staple";
const PREFIX = "del-test";

let dir = "";
const ids: Record<string, string> = {};

const storedFiles = () => {
  let n = 0;
  for (const shard of readdirSync(dir)) for (const f of readdirSync(path.join(dir, shard))) if (statSync(path.join(dir, shard, f)).isFile()) n += 1;
  return n;
};
const ok = { password: PASSWORD, phrase: DELETE_PHRASE };

async function makeUser(name: string, role: "LEARNER" | "ADMIN" = "LEARNER") {
  const user = await db.user.create({
    data: { email: `${PREFIX}-${name}@example.test`, passwordHash: await hashPassword(PASSWORD), role, profile: { create: { displayName: `Delete Test ${name}` } } },
  });
  await db.session.create({ data: { userId: user.id, tokenHash: `${PREFIX}-${name}-token`, expiresAt: new Date(Date.now() + 1e8) } });
  ids[name] = user.id;
  return user.id;
}

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "jz-delete-"));
  setStorageForTests(new LocalDiskStorage(dir));
  await db.roleAudit.deleteMany({ where: { targetUserId: { startsWith: "x-" } } });
  await db.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
}, 120_000);

afterAll(async () => {
  await db.evidenceAccessLog.deleteMany({ where: { reviewRequestId: { startsWith: PREFIX } } });
  await db.roleAudit.deleteMany({ where: { note: { startsWith: PREFIX } } });
  await db.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await db.$disconnect();
  setStorageForTests(undefined);
  rmSync(dir, { recursive: true, force: true });
});

describe("the confirmation phrase", () => {
  it("is forgiving about case and spacing but nothing else", () => {
    for (const s of ["DELETE MY ACCOUNT", " delete my account ", "Delete  My   Account"]) expect(matchesPhrase(s), s).toBe(true);
    for (const s of ["", "delete", "DELETE MY ACCOUNT NOW", "delete my accounts"]) expect(matchesPhrase(s), s).toBe(false);
  });
});

describe("nothing is deleted without the password and the phrase", () => {
  it("refuses a wrong phrase and a wrong password, and changes nothing", async () => {
    const id = await makeUser("refuse");
    expect(await deleteAccount(id, { password: PASSWORD, phrase: "delete" })).toEqual({ ok: false, error: "WRONG_PHRASE" });
    expect(await deleteAccount(id, { password: "not the password", phrase: DELETE_PHRASE })).toEqual({ ok: false, error: "WRONG_PASSWORD" });
    expect(await db.user.count({ where: { id } })).toBe(1);
    expect(await db.profile.count({ where: { userId: id } })).toBe(1);
    expect(await db.session.count({ where: { userId: id } })).toBe(1);
  });

  it("reports an unknown account without throwing", async () => {
    expect(await deleteAccount("does-not-exist", ok)).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});

describe("deleting an account", () => {
  it("removes the learner, their records, sessions and uploaded files, and nothing of anyone else", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const base = { title: "Proof", departmentCode: "fswd", kind: "Screenshot", description: "", linkUrl: "", capturedDate: "2026-11-16" } as const;
    const made = await createEvidence(a, base, { name: "shot.png", data: PNG });
    expect(made.ok).toBe(true);
    await createEvidence(b, base, { name: "other.png", data: PNG });
    expect(storedFiles()).toBe(2);
    expect(await db.evidenceItem.count({ where: { userId: a } })).toBe(1);

    // Rows that are linked by plain id (no foreign key) and by reviewer.
    const item = await db.evidenceItem.findFirstOrThrow({ where: { userId: a } });
    await db.evidenceAccessLog.create({ data: { evidenceId: item.id, reviewerId: b, reviewRequestId: `${PREFIX}-r1`, learnerId: a, action: "VIEW_FILE" } });
    await db.evidenceAccessLog.create({ data: { evidenceId: "someone-elses", reviewerId: a, reviewRequestId: `${PREFIX}-r2`, learnerId: b, action: "VIEW_FILE" } });
    await db.roleAudit.create({ data: { targetUserId: a, targetEmail: `${PREFIX}-a@example.test`, action: "GRANTED", role: "REVIEWER", actor: "cli:test", note: `${PREFIX} audit` } });

    const result = await deleteAccount(a, ok);
    expect(result).toEqual({ ok: true, filesRemoved: 1, filesNotRemoved: 0 });

    for (const [model, count] of [
      ["user", await db.user.count({ where: { id: a } })],
      ["profile", await db.profile.count({ where: { userId: a } })],
      ["session", await db.session.count({ where: { userId: a } })],
      ["evidence", await db.evidenceItem.count({ where: { userId: a } })],
      ["file", await db.submissionFile.count({ where: { userId: a } })],
      ["progress", await db.learnerDepartment.count({ where: { userId: a } })],
      ["viewed-by-reviewer log", await db.evidenceAccessLog.count({ where: { learnerId: a } })],
    ] as const) expect(count, model).toBe(0);
    expect(storedFiles()).toBe(1); // only the other learner's file remains

    // The log of this person viewing someone else's evidence stays, without their id.
    const kept = await db.evidenceAccessLog.findFirstOrThrow({ where: { reviewRequestId: `${PREFIX}-r2` } });
    expect(kept.reviewerId).toBeNull();
    // The role audit keeps its history but not the email address.
    const audit = await db.roleAudit.findFirstOrThrow({ where: { note: `${PREFIX} audit` } });
    expect(audit.targetEmail).toBe("[deleted account]");

    // The other learner is untouched.
    expect(await db.user.count({ where: { id: b } })).toBe(1);
    expect(await db.evidenceItem.count({ where: { userId: b } })).toBe(1);
    expect(await db.session.count({ where: { userId: b } })).toBe(1);
  });

  it("cannot be repeated", async () => {
    const id = await makeUser("twice");
    expect((await deleteAccount(id, ok)).ok).toBe(true);
    expect(await deleteAccount(id, ok)).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});

describe("the last administrator", () => {
  it("cannot delete themselves while they are the only active admin, but can when another exists", async () => {
    const others = await db.user.findMany({ where: { role: "ADMIN", isActive: true, email: { not: { startsWith: PREFIX } } }, select: { id: true } });
    if (others.length) await db.user.updateMany({ where: { id: { in: others.map((u) => u.id) } }, data: { isActive: false } });
    try {
      const first = await makeUser("admin1", "ADMIN");
      expect(await deleteAccount(first, ok)).toEqual({ ok: false, error: "LAST_ADMIN" });
      expect(await db.user.count({ where: { id: first } })).toBe(1);
      await makeUser("admin2", "ADMIN");
      expect((await deleteAccount(first, ok)).ok).toBe(true);
    } finally {
      if (others.length) await db.user.updateMany({ where: { id: { in: others.map((u) => u.id) } }, data: { isActive: true } });
    }
  });
});

describe("the database lets a user be deleted", () => {
  it("every foreign key to User cascades or clears; none can block a deletion", async () => {
    const rules = await db.$queryRaw<{ table: string; rule: string }[]>`
      SELECT c.conrelid::regclass::text AS "table", c.confdeltype::text AS rule
      FROM pg_constraint c
      WHERE c.contype = 'f' AND c.confrelid = '"User"'::regclass`;
    expect(rules.length).toBeGreaterThan(30);
    const blocking = rules.filter((r) => !["c", "n"].includes(r.rule)); // c = CASCADE, n = SET NULL
    expect(blocking).toEqual([]);
  });

  it("the only id columns without a foreign key are the ones deletion handles by hand", async () => {
    const cols = await db.$queryRaw<{ table: string; col: string }[]>`
      SELECT table_name AS "table", column_name AS col FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name IN ('userId','learnerId','reviewerId','targetUserId','authorId','createdById','assessorId','claimedById')
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'f' AND c.conrelid = ('"' || table_name || '"')::regclass AND a.attname = column_name
      )`;
    const unlinked = cols.map((c) => `${c.table}.${c.col}`).sort();
    // Handled in deleteAccount(): the evidence view log and the role audit. A new entry here needs a deliberate decision.
    expect(unlinked).toEqual(["EvidenceAccessLog.learnerId", "EvidenceAccessLog.reviewerId", "RoleAudit.targetUserId"]);
  });
});
