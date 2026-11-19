import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listStaff, ROLE_LABEL, setReviewerScope, setStaffRole } from "@/lib/admin/staff";
import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { ALLOWED_RESOURCE_HOSTS, parseResourceUrl } from "@/lib/resources/embed";

const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `cd-test-${n}@example.test`;
const read = (p: string) => readFileSync(p, "utf8");
const ids: Record<string, string> = {};

async function member(name: string) {
  const r = await registerUser({ displayName: name, email: mail(name.toLowerCase()), password: PASSWORD }, { adultConfirmed: true });
  if (!r.ok) throw new Error("registration failed");
  ids[name] = r.userId;
}
const cleanup = () => db.user.deleteMany({ where: { email: { startsWith: "cd-test-" } } });

describe("nmap.org: official documentation only", () => {
  it("accepts the reference guide and the book over https, and nothing else on the host", () => {
    for (const url of ["https://nmap.org/book/man.html", "https://nmap.org/book/", "https://nmap.org/book/nmap-services.html#anchor"]) {
      const r = parseResourceUrl(url);
      expect(r, url).toMatchObject({ ok: true, provider: "nmap-docs", kind: "page", embedUrl: null });
    }
    expect(parseResourceUrl("https://nmap.org/book/man.html#x")).toMatchObject({ canonicalUrl: "https://nmap.org/book/man.html" }); // the fragment is dropped
    for (const url of [
      "https://nmap.org/", "https://nmap.org/download.html", "https://nmap.org/bookmarks", "https://nmap.org/booklet/x",
      "https://nmap.org/book/../download.html", "https://nmap.org/book/%2e%2e/download.html", "https://nmap.org//download.html",
    ]) expect(parseResourceUrl(url).ok, url).toBe(false);
  });

  it("keeps every protection: https only, no credentials or ports, no look-alike hosts", () => {
    for (const url of [
      "http://nmap.org/book/man.html", "https://user:pass@nmap.org/book/man.html", "https://nmap.org:8443/book/man.html",
      "https://www.nmap.org/book/man.html", "https://nmap.org.evil.example/book/man.html", "https://evilnmap.org/book/man.html", "https://nmap.org@evil.example/book/man.html",
    ]) expect(parseResourceUrl(url).ok, url).toBe(false);
  });

  it("records who allowed the host and when, and leaves the other hosts as they were", () => {
    expect(ALLOWED_RESOURCE_HOSTS["nmap.org"]).toMatchObject({ pathPrefixes: ["/book"], approval: { at: "2026-11-19" } });
    expect(ALLOWED_RESOURCE_HOSTS["nmap.org"].approval?.by).toMatch(/owner/i);
    expect(Object.keys(ALLOWED_RESOURCE_HOSTS).filter((h) => ALLOWED_RESOURCE_HOSTS[h].pathPrefixes).sort()).toEqual(["nmap.org"]);
    expect(parseResourceUrl("https://developer.mozilla.org/en-US/docs/Web/HTML")).toMatchObject({ ok: true });
    expect(parseResourceUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({ ok: true, kind: "video" });
  });
});

describe("assigning staff roles in the Admin Centre", () => {
  const others: { id: string; role: "ADMIN" }[] = [];
  beforeAll(async () => {
    await cleanup();
    for (const n of ["Boss", "Second", "Mgr", "Rev", "Learner", "Outsider"]) await member(n);
    await db.user.update({ where: { id: ids.Boss }, data: { role: "ADMIN" } });
    // Other administrators in the test database must not hide the "last admin" rule, so set them aside for this file.
    const existing = await db.user.findMany({ where: { role: "ADMIN", id: { not: ids.Boss } }, select: { id: true } });
    for (const u of existing) others.push({ id: u.id, role: "ADMIN" });
    await db.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { role: "LEARNER" } });
  }, 120_000);
  afterAll(async () => {
    await cleanup();
    await db.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { role: "ADMIN" } });
    await db.$disconnect();
  });

  it("names the roles for the Academy, with no person built in", () => {
    expect(ROLE_LABEL).toMatchObject({ ADMIN: "Academy Admin", AUTHOR: "Curriculum Manager", REVIEWER: "Assessment Reviewer" });
  });

  it("only an Academy Admin can list or change roles; the check uses the database, not the page", async () => {
    for (const who of ["Learner", "Mgr", "Rev"]) {
      expect(await setStaffRole(ids[who], { email: mail("outsider"), role: "AUTHOR" })).toMatchObject({ ok: false });
      expect(await listStaff(ids[who])).toMatchObject({ ok: false });
    }
    expect((await db.user.findUniqueOrThrow({ where: { id: ids.Outsider } })).role).toBe("LEARNER");
    expect(await listStaff("not-a-real-id")).toMatchObject({ ok: false });
  });

  it("assigns a Curriculum Manager and an Assessment Reviewer, records who did it, and takes effect on the next request", async () => {
    expect(await setStaffRole(ids.Boss, { email: mail("mgr"), role: "AUTHOR" })).toMatchObject({ ok: true, role: "AUTHOR" });
    expect(await setStaffRole(ids.Boss, { email: mail("rev").toUpperCase(), role: "REVIEWER" })).toMatchObject({ ok: true, role: "REVIEWER" });
    expect((await db.user.findUniqueOrThrow({ where: { id: ids.Mgr } })).role).toBe("AUTHOR");
    const audit = await db.roleAudit.findFirstOrThrow({ where: { targetUserId: ids.Mgr }, orderBy: { at: "desc" } });
    expect(audit).toMatchObject({ action: "GRANTED", role: "AUTHOR", actor: `admin:${ids.Boss}`, note: "was LEARNER" });
    const staff = await listStaff(ids.Boss);
    expect(staff.ok && staff.staff.find((s) => s.id === ids.Mgr)?.label).toBe("Curriculum Manager");
  });

  it("rejects bad input, unknown accounts and no-op changes without saying anything about who has an account", async () => {
    expect(await setStaffRole(ids.Boss, { email: "not-an-email", role: "AUTHOR" })).toMatchObject({ ok: false });
    expect(await setStaffRole(ids.Boss, { email: mail("nobody"), role: "AUTHOR" })).toMatchObject({ ok: false });
    expect(await setStaffRole(ids.Boss, { email: mail("mgr"), role: "SUPERUSER" })).toMatchObject({ ok: false });
    expect(await setStaffRole(ids.Boss, { email: mail("mgr"), role: "AUTHOR" })).toMatchObject({ ok: false }); // already that role
  });

  it("making an Academy Admin needs the address typed twice; nobody can change their own role", async () => {
    expect(await setStaffRole(ids.Boss, { email: mail("second"), role: "ADMIN" })).toMatchObject({ ok: false });
    expect(await setStaffRole(ids.Boss, { email: mail("second"), role: "ADMIN", confirmEmail: mail("other") })).toMatchObject({ ok: false });
    expect((await db.user.findUniqueOrThrow({ where: { id: ids.Second } })).role).toBe("LEARNER");
    expect(await setStaffRole(ids.Boss, { email: mail("second"), role: "ADMIN", confirmEmail: mail("second") })).toMatchObject({ ok: true });
    expect(await setStaffRole(ids.Second, { email: mail("second"), role: "LEARNER" })).toMatchObject({ ok: false }); // self
    expect(await setStaffRole(ids.Boss, { email: mail("boss"), role: "LEARNER" })).toMatchObject({ ok: false }); // self
  });

  it("the last Academy Admin cannot be removed, but one of two can be", async () => {
    expect(await setStaffRole(ids.Boss, { email: mail("second"), role: "LEARNER" })).toMatchObject({ ok: true }); // two admins: fine
    expect((await db.user.count({ where: { role: "ADMIN" } }))).toBe(1);
    // Boss is now the only one. A second admin tries to demote Boss while Boss is the last other admin: promote, then check the guard.
    await setStaffRole(ids.Boss, { email: mail("second"), role: "ADMIN", confirmEmail: mail("second") });
    await db.user.update({ where: { id: ids.Boss }, data: { role: "LEARNER" } }); // simulate Second as the only admin
    expect(await setStaffRole(ids.Second, { email: mail("second"), role: "LEARNER" })).toMatchObject({ ok: false });
    expect((await db.user.findUniqueOrThrow({ where: { id: ids.Second } })).role).toBe("ADMIN");
    await db.user.update({ where: { id: ids.Boss }, data: { role: "ADMIN" } });
  });

  it("reviewer scopes apply to Assessment Reviewers only, are recorded, and are cleared when the role changes", async () => {
    const dept = await db.department.findFirstOrThrow({ select: { code: true } });
    expect(await setReviewerScope(ids.Boss, { email: mail("mgr"), department: dept.code }, true)).toMatchObject({ ok: false }); // a Curriculum Manager has no scope
    expect(await setReviewerScope(ids.Boss, { email: mail("rev"), department: "nope" }, true)).toMatchObject({ ok: false });
    expect(await setReviewerScope(ids.Mgr, { email: mail("rev"), department: dept.code }, true)).toMatchObject({ ok: false }); // not an admin
    expect(await setReviewerScope(ids.Boss, { email: mail("rev"), department: dept.code }, true)).toMatchObject({ ok: true });
    expect(await setReviewerScope(ids.Boss, { email: mail("rev"), department: dept.code }, true)).toMatchObject({ ok: true }); // repeating is harmless
    expect(await db.reviewerScope.count({ where: { userId: ids.Rev } })).toBe(1);
    expect(await db.roleAudit.count({ where: { targetUserId: ids.Rev, action: "SCOPE_ADDED", actor: `admin:${ids.Boss}` } })).toBe(2);
    expect(await setStaffRole(ids.Boss, { email: mail("rev"), role: "AUTHOR" })).toMatchObject({ ok: true });
    expect(await db.reviewerScope.count({ where: { userId: ids.Rev } })).toBe(0);
    expect(await db.roleAudit.count({ where: { targetUserId: ids.Rev, action: "SCOPE_REMOVED" } })).toBe(1);
  });

  it("the staff page and its actions are for Academy Admins only; the curriculum page is for Admins and Curriculum Managers", () => {
    expect(read("src/app/(admin)/admin/staff/page.tsx")).toContain('requireRole("ADMIN")');
    expect(read("src/app/(admin)/admin/staff/actions.ts").match(/requireRole\("ADMIN"\)/g)).toHaveLength(2);
    expect(read("src/app/(app)/curriculum/page.tsx")).toContain('requireRole("ADMIN", "AUTHOR")');
  });
});

describe("standard learning tools", () => {
  const level0 = read("prisma/curriculum/level0.ts");
  const mission = (code: string) => level0.slice(level0.indexOf(`code: "${code}"`), level0.indexOf("rubric:", level0.indexOf(`code: "${code}"`)));

  it("video editing uses DaVinci Resolve (free version)", () => {
    for (const code of ["VID-L0-01", "VID-L0-02"]) expect(mission(code), code).toContain("DaVinci Resolve (free version)");
    expect(level0).not.toContain("Video editing software");
  });

  it("cloud lessons teach the idea for any provider first, then practise on AWS, and keep the cost warnings", () => {
    for (const code of ["CLOUD-L0-01", "CLOUD-L0-02"]) expect(mission(code), code).toContain("AWS");
    expect(mission("CLOUD-L0-01")).toMatch(/any cloud account/);
    expect(mission("CLOUD-L0-02")).toMatch(/on any provider/);
    expect(mission("CLOUD-L0-02")).toMatch(/free tier/);
    expect(mission("CLOUD-L0-02")).toMatch(/Terminate the instance/);
    expect(level0).not.toContain("Cloud provider free tier account");
  });
});
