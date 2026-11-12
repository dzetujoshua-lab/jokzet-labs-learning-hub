import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { checkUpload, MAX_BYTES, sanitizeFileName } from "@/lib/evidence/files";
import { detectSecretInUrl, detectSecrets } from "@/lib/evidence/secrets";
import { createEvidence, deleteEvidence, getEvidenceFile, listEvidence } from "@/lib/evidence/service";
import { startMission } from "@/lib/missions/progress";
import { submitMission } from "@/lib/missions/progress";
import { attachToDraft, detachFromDraft } from "@/lib/missions/submissions";
import { LocalDiskStorage, getStorage, setStorageForTests } from "@/lib/storage";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);
const GIF = Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(32)]);
const WEBP = Buffer.concat([Buffer.from("RIFF", "latin1"), Buffer.alloc(4), Buffer.from("WEBP", "latin1"), Buffer.alloc(16)]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n", "latin1"), Buffer.alloc(32, 0x20)]);
const MP4 = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom", "latin1"), Buffer.alloc(32)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(32)]);
const text = (s: string) => Buffer.from(s, "utf8");

let dir = "";
let userA = "";
let userB = "";
const TODAY = "2026-11-16";

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "jz-evidence-"));
  setStorageForTests(new LocalDiskStorage(dir));
  await db.user.deleteMany({ where: { email: { startsWith: "evid-test" } } });
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
  userA = (await db.user.create({ data: { email: "evid-test-a@example.test", passwordHash: "x" } })).id;
  userB = (await db.user.create({ data: { email: "evid-test-b@example.test", passwordHash: "x" } })).id;
}, 120_000);

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "evid-test" } } });
  await db.$disconnect();
  setStorageForTests(undefined);
  rmSync(dir, { recursive: true, force: true });
});

const countStored = () => {
  let n = 0;
  for (const shard of readdirSync(dir)) for (const f of readdirSync(path.join(dir, shard))) if (statSync(path.join(dir, shard, f)).isFile()) n += 1;
  return n;
};
const base = { title: "Proof", departmentCode: "fswd", kind: "Screenshot", description: "", linkUrl: "", capturedDate: TODAY } as const;

describe("upload validation (content is checked, not trusted)", () => {
  it.each([
    ["png", "a.png", PNG, "IMAGE", "image/png"],
    ["jpeg", "a.JPG", JPEG, "IMAGE", "image/jpeg"],
    ["gif", "a.gif", GIF, "IMAGE", "image/gif"],
    ["webp", "a.webp", WEBP, "IMAGE", "image/webp"],
    ["pdf", "report.pdf", PDF, "PDF", "application/pdf"],
    ["mp4", "demo.mp4", MP4, "VIDEO", "video/mp4"],
    ["webm", "demo.webm", WEBM, "VIDEO", "video/webm"],
    ["source code", "app.ts", text("export const x = 1;\n"), "CODE", "text/plain"],
  ])("accepts a real %s", (_n, name, data, kind, mime) => {
    const r = checkUpload(name, data);
    expect(r).toMatchObject({ ok: true, kind, mime });
    if (r.ok) expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    ["PNG bytes with a .jpg name", "a.jpg", PNG, /does not match/],
    ["text pretending to be a PNG", "a.png", text("<html>not an image</html>"), /not a valid/],
    ["script pretending to be a PDF", "a.pdf", text("alert(1)"), /not a valid/],
    ["SVG (scriptable)", "a.svg", text("<svg onload=alert(1)/>"), /not allowed/],
    ["executable", "setup.exe", Buffer.from("MZ....."), /not allowed/],
    ["archive", "a.zip", Buffer.from("PK\u0003\u0004"), /not allowed/],
    ["HTML disguised via double extension", "a.png.html.exe", text("x"), /not allowed/],
    ["no extension", "README", text("hi"), /extension/],
    ["empty file", "a.png", Buffer.alloc(0), /empty/],
    ["binary data in a code file", "a.js", Buffer.from([0x00, 0x01, 0x02, 0xff]), /plain UTF-8/],
    ["invalid UTF-8 in a text file", "a.txt", Buffer.from([0xc3, 0x28, 0x41]), /plain UTF-8/],
    [".env file", ".env", text("A=1"), /\.env/],
    ["private key file", "server.pem", text("x"), /Key files/],
    ["ssh key", "id_rsa", text("x"), /Key files/],
  ])("rejects %s", (_n, name, data, message) => {
    const r = checkUpload(name, data);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(message);
  });

  it("enforces size limits per type", () => {
    expect(checkUpload("big.png", Buffer.concat([PNG, Buffer.alloc(MAX_BYTES.IMAGE)])).ok).toBe(false);
    expect(checkUpload("big.js", text("a".repeat(MAX_BYTES.CODE + 1))).ok).toBe(false);
    expect(checkUpload("ok.js", text("a".repeat(MAX_BYTES.CODE - 10))).ok).toBe(true);
  });

  it("blocks secrets inside uploaded code", () => {
    const r = checkUpload("config.js", text("const k = '-----BEGIN " + "RSA PRIVATE KEY-----';"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/private key/i);
  });

  it("neutralises dangerous file names", () => {
    expect(sanitizeFileName("../../etc/passwd.txt")).toBe("passwd.txt");
    expect(sanitizeFileName("..\\..\\win.ini")).toBe("win.ini");
    expect(sanitizeFileName("a\u0000b<c>.png")).toBe("abc.png");
    expect(sanitizeFileName("...")).toBe("file");
    expect(sanitizeFileName("x".repeat(300) + ".png").length).toBeLessThanOrEqual(120);
  });
});

describe("secret detection (programme rule: never store credentials)", () => {
  it("flags common secret shapes and leaves normal text alone", () => {
    expect(detectSecrets("-----BEGIN " + "OPENSSH PRIVATE KEY-----")).toContain("a private key");
    expect(detectSecrets("key " + "AKIA" + "ABCDEFGHIJKLMNOP")).toContain("an AWS access key");
    expect(detectSecrets("ghp_" + "a".repeat(36))).toContain("a GitHub token");
    expect(detectSecrets("password = hunter2hunter2")).toContain("a password or secret assignment");
    expect(detectSecrets("postgres" + "://admin:s3cretpass@db.example.com/app")).toContain("a connection string with a password");
    expect(detectSecrets("I built a login form with password validation and tested five inputs.")).toEqual([]);
    expect(detectSecretInUrl("https://app.example.com/x?access_token=abcdef123456")).toBe(true);
    expect(detectSecretInUrl("https://github.com/jokzet/project")).toBe(false);
  });
});

describe("storage abstraction", () => {
  it("stores, streams and deletes by opaque key; refuses traversal and overwrite", async () => {
    const storage = new LocalDiskStorage(dir);
    const key = "a".repeat(32);
    await storage.put(key, Buffer.from("hello world"));
    const got = await storage.get(key);
    expect(got?.size).toBe(11);
    expect(await new Response(got!.stream).text()).toBe("hello world");
    const part = await storage.get(key, { start: 6, end: 10 });
    expect(await new Response(part!.stream).text()).toBe("world");
    await expect(storage.put(key, Buffer.from("again"))).rejects.toThrow(); // never overwrite
    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
    for (const bad of ["../escape", "A".repeat(32), "abc", "a".repeat(31) + "/", "..\\..\\x", ""]) {
      await expect(storage.put(bad, Buffer.from("x")), bad).rejects.toThrow("Invalid storage key");
      await expect(storage.get(bad), bad).rejects.toThrow("Invalid storage key");
    }
  });
});

describe("evidence vault service", () => {
  it("stores a screenshot privately and lists it, without leaking the storage key", async () => {
    const before = countStored();
    const r = await createEvidence(userA, { ...base, title: "Responsive profile page" }, { name: "shot.png", data: PNG });
    expect(r.ok).toBe(true);
    expect(countStored()).toBe(before + 1);
    const [item] = await listEvidence(userA);
    expect(item).toMatchObject({ title: "Responsive profile page", kind: "Screenshot", fileKind: "IMAGE", fileName: "shot.png", status: "logged", attached: false, locked: false });
    expect(JSON.stringify(item)).not.toMatch(/storageKey|[a-f0-9]{32}/);
    const file = await getEvidenceFile(userA, item.id);
    expect(file?.mimeType).toBe("image/png");
    const object = await getStorage().get(file!.storageKey);
    expect(object?.size).toBe(PNG.length);
  });

  it("accepts a link and a written explanation as evidence", async () => {
    expect((await createEvidence(userA, { ...base, kind: "Link", title: "Repo", linkUrl: "https://github.com/jokzet/demo" })).ok).toBe(true);
    expect((await createEvidence(userA, { ...base, kind: "Document", title: "Write-up", description: "I rebuilt the layout with flexbox and tested it at two widths." })).ok).toBe(true);
  });

  it("requires real proof and a matching type", async () => {
    expect(await createEvidence(userA, { ...base })).toMatchObject({ ok: false, error: expect.stringMatching(/file, a link, or a written/) });
    expect(await createEvidence(userA, { ...base, description: "too short" })).toMatchObject({ ok: false });
    expect(await createEvidence(userA, { ...base, kind: "Link" })).toMatchObject({ ok: false });
    expect(await createEvidence(userA, { ...base, kind: "Screenshot" }, { name: "a.pdf", data: PDF })).toMatchObject({ ok: false, error: expect.stringMatching(/does not fit/) });
    expect(await createEvidence(userA, { ...base, kind: "Video" }, { name: "a.png", data: PNG })).toMatchObject({ ok: false });
    expect(await createEvidence(userA, { ...base, kind: "Code" }, { name: "a.pdf", data: PDF })).toMatchObject({ ok: false });
    expect(await createEvidence(userA, { ...base, departmentCode: "nope" as never, linkUrl: "https://x.test" })).toMatchObject({ ok: false });
    expect(await createEvidence(userA, { ...base, linkUrl: "javascript:alert(1)" })).toMatchObject({ ok: false });
    expect(await createEvidence(userA, { ...base, kind: "Link", linkUrl: "ftp://x.test/f" })).toMatchObject({ ok: false });
  });

  it("rejects secrets in notes and links, and stores nothing when validation fails", async () => {
    const before = countStored();
    expect(await createEvidence(userA, { ...base, kind: "Document", description: "My password = correcthorse1 is in the config so you can log in." })).toMatchObject({ ok: false, error: expect.stringMatching(/secret/i) });
    expect(await createEvidence(userA, { ...base, kind: "Link", linkUrl: "https://app.test/x?token=abcdef123456" })).toMatchObject({ ok: false });
    expect(await createEvidence(userA, { ...base, kind: "Screenshot" }, { name: "fake.png", data: text("<html>") })).toMatchObject({ ok: false });
    expect(countStored()).toBe(before);
  });

  it("keeps each user's evidence and files private", async () => {
    const mine = (await listEvidence(userA))[0];
    expect(await listEvidence(userB)).toEqual([]);
    expect(await getEvidenceFile(userB, mine.id)).toBeNull();
    expect(await deleteEvidence(userB, mine.id)).toEqual({ ok: false, error: "Evidence not found." });
    expect((await listEvidence(userA)).some((e) => e.id === mine.id)).toBe(true);
  });

  it("deletes the database row and the stored file together", async () => {
    const r = await createEvidence(userA, { ...base, title: "Temp" }, { name: "t.png", data: PNG });
    if (!r.ok) throw new Error(r.error);
    const before = countStored();
    expect(await deleteEvidence(userA, r.id)).toEqual({ ok: true });
    expect(countStored()).toBe(before - 1);
    expect(await getEvidenceFile(userA, r.id)).toBeNull();
  });
});

describe("evidence on a mission: draft, attach, submit", () => {
  it("cannot submit without evidence, can after attaching, and sent evidence is locked", async () => {
    await startMission(userA, "FSWD-L0-01");
    const lm = await db.learnerMission.findFirstOrThrow({ where: { userId: userA, mission: { code: "FSWD-L0-01" } } });
    const explanation = "I built the page with semantic HTML and tested two widths.";

    expect(await submitMission(userA, lm.id, { explanation, githubUrl: "", liveUrl: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/at least one piece of evidence/) });

    const e = await createEvidence(userA, { ...base, title: "Phone view" }, { name: "phone.png", data: PNG }, lm.id);
    if (!e.ok) throw new Error(e.error);
    expect((await db.evidenceItem.findUniqueOrThrow({ where: { id: e.id } })).submissionId).not.toBeNull();

    // Another user's evidence can never be attached to my mission, nor mine to theirs.
    const theirs = await createEvidence(userB, { ...base, title: "Theirs", linkUrl: "https://example.test/b" });
    if (!theirs.ok) throw new Error(theirs.error);
    expect(await attachToDraft(userA, lm.id, theirs.id)).toEqual({ ok: false, error: "Evidence not found." });

    // Secrets in the explanation are refused.
    expect(await submitMission(userA, lm.id, { explanation: "Here is my api_key = sk_" + "live_abcdef123456789", githubUrl: "", liveUrl: "" })).toMatchObject({ ok: false });

    expect(await submitMission(userA, lm.id, { explanation, githubUrl: "", liveUrl: "" })).toEqual({ ok: true, attempt: 1 });
    expect(await detachFromDraft(userA, e.id)).toBe(false); // already sent
    expect(await deleteEvidence(userA, e.id)).toMatchObject({ ok: false, error: expect.stringMatching(/submitted mission/) });
    expect((await listEvidence(userA)).find((x) => x.id === e.id)).toMatchObject({ attached: true, locked: true });
  });

  it("a link alone counts as evidence, and attaching the same item to a second mission is refused", async () => {
    await startMission(userA, "FSWD-L0-02");
    const lm = await db.learnerMission.findFirstOrThrow({ where: { userId: userA, mission: { code: "FSWD-L0-02" } } });
    expect(await submitMission(userA, lm.id, { explanation: "Validated five bad inputs and recorded results.", githubUrl: "https://github.com/jokzet/form", liveUrl: "" })).toEqual({ ok: true, attempt: 1 });

    await startMission(userA, "UXUI-L0-01");
    const other = await db.learnerMission.findFirstOrThrow({ where: { userId: userA, mission: { code: "UXUI-L0-01" } } });
    const sent = (await listEvidence(userA)).find((x) => x.locked)!;
    expect(await attachToDraft(userA, other.id, sent.id)).toMatchObject({ ok: false });
  });
});
