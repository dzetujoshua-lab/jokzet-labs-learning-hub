import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAdminOverview } from "@/lib/admin/overview";
import { navGroups } from "@/components/layout/nav-links";
import { listStaff, setStaffRole } from "@/lib/admin/staff";
import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";

const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `adm-test-${n}@example.test`;
const read = (p: string) => readFileSync(p, "utf8");
const ids: Record<string, string> = {};
const cleanup = () => db.user.deleteMany({ where: { email: { startsWith: "adm-test-" } } });

async function member(name: string) {
  const r = await registerUser({ displayName: `${name} Tester`, email: mail(name.toLowerCase()), password: PASSWORD }, { adultConfirmed: true });
  if (!r.ok) throw new Error("registration failed");
  ids[name] = r.userId;
}
const overview = async (actor: string) => {
  const r = await getAdminOverview(actor);
  if (!r.ok) throw new Error(r.error);
  return r.overview;
};
const kpi = (o: Awaited<ReturnType<typeof overview>>, key: string) => o.kpis.find((k) => k.key === key)!.value;

beforeAll(async () => {
  await cleanup();
  await member("Boss");
  await member("Learner");
  await db.user.update({ where: { id: ids.Boss }, data: { role: "ADMIN" } });
}, 120_000);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("who may open the Administration Centre data", () => {
  it("refuses everyone who is not an Academy Admin right now, including unknown accounts", async () => {
    expect(await getAdminOverview(ids.Learner)).toMatchObject({ ok: false });
    expect(await getAdminOverview("no-such-user")).toMatchObject({ ok: false });
    await db.user.update({ where: { id: ids.Learner }, data: { role: "AUTHOR" } });
    expect(await getAdminOverview(ids.Learner)).toMatchObject({ ok: false }); // a Curriculum Manager is not an administrator
    await db.user.update({ where: { id: ids.Learner }, data: { role: "REVIEWER" } });
    expect(await getAdminOverview(ids.Learner)).toMatchObject({ ok: false });
    await db.user.update({ where: { id: ids.Learner }, data: { role: "LEARNER" } });
    expect(await getAdminOverview(ids.Boss)).toMatchObject({ ok: true });
  });

  it("every admin page and the admin layout check the role on the server", () => {
    expect(read("src/app/(admin)/admin/layout.tsx")).toContain('requireRole("ADMIN")');
    for (const page of ["page.tsx", "staff/page.tsx", "curriculum/page.tsx"]) expect(read(`src/app/(admin)/admin/${page}`), page).toContain('requireRole("ADMIN")');
    expect(read("src/app/(admin)/admin/staff/actions.ts").match(/requireRole\("ADMIN"\)/g)).toHaveLength(2);
    expect(read("src/app/(app)/curriculum/page.tsx")).toContain('requireRole("ADMIN", "AUTHOR")');
  });
});

describe("the figures are the real ones", () => {
  it("counts learners, active learners and weekly activity from the database, and moves when the data does", async () => {
    const before = await overview(ids.Boss);
    expect(kpi(before, "learners")).toBe(await db.user.count({ where: { role: "LEARNER" } }));
    expect(kpi(before, "pending")).toBe(await db.reviewRequest.count({ where: { status: { in: ["OPEN", "CLAIMED"] } } }));
    expect(kpi(before, "content")).toBe(await db.learningResource.count({ where: { status: "PENDING_REVIEW" } }));

    await member("Extra");
    await db.activityRecord.create({ data: { userId: ids.Extra, type: "MISSION_STARTED", entityType: "Mission", entityId: "x", occurredAt: new Date() } });
    const after = await overview(ids.Boss);
    expect(kpi(after, "learners")).toBe(kpi(before, "learners") + 1);
    expect(after.learnerSplit.newThisWeek).toBe(before.learnerSplit.newThisWeek + 1);
    expect(after.learnerSplit.active).toBe(before.learnerSplit.active + 1);
    expect(after.learnerSplit.activitiesThisWeek).toBe(before.learnerSplit.activitiesThisWeek + 1);
    expect(after.learnerSplit.active + after.learnerSplit.inactive).toBe(kpi(after, "learners"));
    expect(after.weekly).toHaveLength(8);
    expect(after.weekly.at(-1)!.activities).toBeGreaterThanOrEqual(1);
  });

  it("counts enrolments per programme without naming anyone", async () => {
    const dept = await db.department.findFirstOrThrow({ select: { id: true, code: true } });
    const before = (await overview(ids.Boss)).programmes.find((p) => p.code === dept.code)?.learners ?? 0;
    await db.courseEnrolment.create({ data: { userId: ids.Learner, departmentId: dept.id, status: "ACTIVE" } });
    const after = await overview(ids.Boss);
    expect(after.programmes.find((p) => p.code === dept.code)?.learners).toBe(before + 1);
    expect(JSON.stringify(after.programmes)).not.toContain("Tester");
  });

  it("assessment insights match the stored results", async () => {
    const o = await overview(ids.Boss);
    const by = async (outcome: "PASS" | "REVISE" | "FAIL") => db.assessment.count({ where: { outcome } });
    expect(o.assessments).toMatchObject({ passed: await by("PASS"), needsImprovement: await by("REVISE"), failed: await by("FAIL") });
    expect(o.assessments.failedJobs).toBe(await db.assessmentJob.count({ where: { status: "NEEDS_HUMAN_REVIEW", assessmentId: null } }));
  });
});

describe("recent activity and alerts", () => {
  it("shows real events, newest first, and never a learner's name or email", async () => {
    const o = await overview(ids.Boss);
    expect(o.activity.length).toBeGreaterThan(0);
    expect(o.activity.length).toBeLessThanOrEqual(12);
    for (let i = 1; i < o.activity.length; i += 1) expect(o.activity[i - 1].at.getTime()).toBeGreaterThanOrEqual(o.activity[i].at.getTime());
    const text = o.activity.map((a) => a.text).join(" | ");
    expect(text).not.toMatch(/Tester|adm-test-(learner|extra)/i);
    expect(o.activity.some((a) => a.kind === "REGISTRATION" && a.text === "New learner registered")).toBe(true);
  });

  it("records a role change as an event with the role named, and the staff search finds only matching staff", async () => {
    await member("Mgr");
    expect(await setStaffRole(ids.Boss, { email: mail("mgr"), role: "AUTHOR" })).toMatchObject({ ok: true });
    const o = await overview(ids.Boss);
    expect(o.activity.some((a) => a.kind === "ROLE" && a.text === `Curriculum Manager role granted to ${mail("mgr")}`)).toBe(true);
    const hit = await listStaff(ids.Boss, "adm-test-mgr");
    expect(hit.ok && hit.staff.map((s) => s.email)).toEqual([mail("mgr")]);
    const none = await listStaff(ids.Boss, "zzzz-nobody");
    expect(none.ok && none.staff).toEqual([]);
    const wild = await listStaff(ids.Boss, "%%");
    expect(wild.ok && wild.staff.length).toBeGreaterThan(0); // a wildcard-only search is ignored, not turned into "match everything"
    expect(await listStaff(ids.Learner, "mgr")).toMatchObject({ ok: false });
  });

  it("alerts are only true statements about the system, each with where to act", async () => {
    const saved = { e: process.env.DEEPSEEK_ENABLED, k: process.env.DEEPSEEK_API_KEY, p: process.env.AI_PROVIDER };
    try {
      process.env.AI_PROVIDER = "deepseek";
      process.env.DEEPSEEK_ENABLED = "false";
      expect((await overview(ids.Boss)).alerts.some((a) => a.id === "ai")).toBe(true); // switched off, so it says so
      process.env.DEEPSEEK_ENABLED = "true";
      process.env.DEEPSEEK_API_KEY = "test-key-not-real";
      expect((await overview(ids.Boss)).alerts.some((a) => a.id === "ai")).toBe(false);
    } finally {
      for (const [k, v] of [["DEEPSEEK_ENABLED", saved.e], ["DEEPSEEK_API_KEY", saved.k], ["AI_PROVIDER", saved.p]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
    const o = await overview(ids.Boss);
    for (const a of o.alerts) expect(["info", "warn", "bad"]).toContain(a.level);
    expect(o.alerts.filter((a) => a.id === "reviews").every((a) => a.href === "/review")).toBe(true);
  });
});

describe("how an administrator gets to the Administration Centre", () => {
  const hrefs = (admin: boolean) => navGroups(true, admin).flatMap((g) => g.items.map((i) => i.to));

  it("the learner menu shows the link to administrators only, and the server decides who is an administrator", () => {
    expect(hrefs(false)).not.toContain("/admin");
    expect(hrefs(true)).toContain("/admin");
    expect(navGroups(false, true).find((g) => g.title === "Administration")?.items[0]).toMatchObject({ to: "/admin", label: "Administration Centre" });
    const gate = read("src/components/layout/nav-gate.tsx");
    expect(gate).toContain('user.role === "ADMIN"');
    expect(gate).toMatch(/showAdmin=\{admin\}/);
  });
});

describe("the Administration Centre look is isolated from the learner theme", () => {
  const css = read("src/components/admin/admin-theme.css");

  it("every rule is scoped to .admin-theme (or is a keyframe or media wrapper), so nothing can recolour the learner interface", () => {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    // top-level selectors: text before each "{" that is not inside another block
    let depth = 0;
    let buffer = "";
    const selectors: string[] = [];
    for (const ch of stripped) {
      if (ch === "{") { if (depth === 0) selectors.push(buffer.trim()); depth += 1; buffer = ""; }
      else if (ch === "}") { depth -= 1; buffer = ""; }
      else if (depth === 0) buffer += ch;
    }
    expect(selectors.length).toBeGreaterThan(10);
    for (const sel of selectors) expect(sel, sel).toMatch(/^(\.admin-theme\b|@keyframes admin-|@media \(prefers-reduced-motion)/);
  });

  it("is loaded only by the admin shell, and the global theme file does not mention it", () => {
    expect(read("src/components/admin/admin-shell.tsx")).toContain('import "./admin-theme.css"');
    const others = ["src/components/layout/app-shell.tsx", "src/components/layout/app-frame.tsx", "src/app/layout.tsx", "src/components/home/learner-home.tsx"];
    for (const f of others) expect(read(f), f).not.toContain("admin-theme");
    expect(read("src/app/globals.css")).not.toMatch(/admin/i);
    expect(read("src/app/globals.css")).toContain("--primary: 74 88% 62%"); // the learner theme's primary colour is unchanged
  });

  it("every navigation entry opens a real page, and the charts and animation respect reduced motion", () => {
    const nav = read("src/components/admin/admin-nav.tsx");
    const routes = [...nav.matchAll(/to: "(\/[a-z/-]*)"/g)].map((m) => m[1]);
    expect(routes).toEqual(expect.arrayContaining(["/admin", "/admin/staff", "/admin/curriculum", "/review", "/"]));
    for (const r of routes) {
      const pages = r === "/" ? ["src/app/(app)/page.tsx"] : [`src/app/(admin)${r}/page.tsx`, `src/app/(app)${r}/page.tsx`];
      expect(pages.some((p) => existsSync(p)), r).toBe(true);
    }
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.admin-enter/);
    expect(read("src/components/admin/admin-charts.tsx")).toContain("prefers-reduced-motion");
  });
});
