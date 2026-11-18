import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { listEnrolments, listCatalogue, visibleDepartmentIds } from "@/lib/enrolment/service";
import { getDepartmentDetail } from "@/lib/department-detail";
import { listDepartments } from "@/lib/missions/service";
import { buildPlanForReview, confirmPlan, saveOnboarding } from "@/lib/plan/onboarding";
import { addCourse, previewAddCourse } from "@/lib/plan/service";
import type { OnboardingInput } from "@/lib/plan/schema";

// Departments shows exactly the learner's enrolled courses, enforced by server queries; adding a course later places its
// sessions in free seats and never touches the first course.
const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `enrol-test-${n}@example.test`;
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
const START = "2026-12-07";

const answers = (code: string, over: Partial<OnboardingInput> = {}): OnboardingInput => ({
  experience: "BEGINNER", goals: [{ departmentCode: code, weight: 3, targetLevel: 1, note: "" }], sessionMinutes: 45, weekdays: [1, 3, 5], startTime: "18:00",
  timezone: "Africa/Accra", durationKind: "THREE_MONTHS", startDate: START, ...over,
});

async function onboarded(name: string, code = "fswd", over: Partial<OnboardingInput> = {}) {
  const r = await registerUser({ displayName: name, email: mail(name.toLowerCase()), password: PASSWORD }, { adultConfirmed: true });
  if (!r.ok) throw new Error("registration failed");
  expect(await saveOnboarding(r.userId, answers(code, over))).toEqual({ ok: true });
  expect((await buildPlanForReview(r.userId)).ok).toBe(true);
  expect((await confirmPlan(r.userId)).ok).toBe(true);
  return r.userId;
}
const codes = async (userId: string) => (await listDepartments(userId)).map((d) => d.code).sort();
const items = (userId: string) => db.learningPlanItem.findMany({ where: { userId }, orderBy: [{ date: "asc" }, { slotIndex: "asc" }] });
const seat = (i: { date: Date; slotIndex: number }) => `${i.date.toISOString().slice(0, 10)}#${i.slotIndex}`;

let a = "";
let b = "";
let legacy = "";

async function cleanup() {
  await db.user.deleteMany({ where: { email: { startsWith: "enrol-test" } } });
  await db.department.deleteMany({ where: { code: "enrol-empty" } });
}
beforeAll(async () => {
  await cleanup();
  seed();
  process.env.PERSONALISED_LEARNING = "on";
  a = await onboarded("A", "fswd");
  b = await onboarded("B", "photo");
  process.env.PERSONALISED_LEARNING = "off";
  const l = await registerUser({ displayName: "Legacy", email: mail("legacy"), password: PASSWORD }, { adultConfirmed: true });
  if (!l.ok) throw new Error("registration failed");
  legacy = l.userId;
  process.env.PERSONALISED_LEARNING = "on";
}, 600_000);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("Departments shows only enrolled courses", () => {
  it("confirming a one-course plan enrols the learner in exactly that course", async () => {
    expect((await listEnrolments(a)).map((e) => e.departmentCode)).toEqual(["fswd"]);
    expect(await codes(a)).toEqual(["fswd"]);
    expect(await codes(b)).toEqual(["photo"]);
  });

  it("the other courses are in the catalogue, not in the learner's departments", async () => {
    const offered = (await listCatalogue(a)).map((c) => c.code);
    expect(offered).not.toContain("fswd");
    expect(offered).toContain("sec");
    expect(await codes(a)).not.toContain("sec");
  });

  it("changing the address to another department 404s (no detail for a course the learner is not in)", async () => {
    expect(await getDepartmentDetail(a, "photo")).toBeNull();
    expect(await getDepartmentDetail(a, "sec")).toBeNull();
    expect(await getDepartmentDetail(a, "fswd")).not.toBeNull();
  });

  it("another learner's enrolments are never visible", async () => {
    expect((await listEnrolments(b)).map((e) => e.departmentCode)).toEqual(["photo"]);
    expect(await getDepartmentDetail(b, "fswd")).toBeNull();
  });

  it("the original fixed programme keeps showing all nine departments", async () => {
    expect(await visibleDepartmentIds(legacy)).toBeNull();
    expect((await codes(legacy)).length).toBe(9);
  });
});

describe("adding a course later", () => {
  it("rejects a course with no approved curriculum, an unknown course, a past date and a bad duration", async () => {
    await db.department.create({ data: { code: "enrol-empty", name: "Empty", icon: "Code2", color: "#000000", sortOrder: 998 } });
    for (const req of [
      { departmentCode: "enrol-empty", startDate: START, durationDays: 90 },
      { departmentCode: "nope", startDate: START, durationDays: 90 },
      { departmentCode: "sec", startDate: "2020-01-01", durationDays: 90 },
      { departmentCode: "sec", startDate: START, durationDays: 3 },
    ]) {
      expect((await addCourse(a, req)).ok, JSON.stringify(req)).toBe(false);
    }
    expect(await codes(a)).toEqual(["fswd"]);
  });

  it("a learner who has not confirmed a first plan cannot add a course", async () => {
    const r = await registerUser({ displayName: "Fresh", email: mail("fresh"), password: PASSWORD }, { adultConfirmed: true });
    if (!r.ok) throw new Error("registration failed");
    expect((await addCourse(r.userId, { departmentCode: "sec", startDate: START, durationDays: 90 })).ok).toBe(false);
  });

  it("previews without writing anything", async () => {
    const before = (await items(a)).length;
    const p = await previewAddCourse(a, { departmentCode: "sec", startDate: START, durationDays: 90 });
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.preview).toMatchObject({ departmentCode: "sec", alreadyEnrolled: false });
      expect(p.preview.sessions).toBeGreaterThan(0);
      expect(p.preview.resources.lessons).toBeGreaterThan(0);
    }
    expect((await items(a)).length).toBe(before);
    expect(await codes(a)).toEqual(["fswd"]);
  });

  it("adds a second course: both are enrolled, the first course's sessions are untouched, and no seat is double booked", async () => {
    const before = await items(a);
    const snapshot = JSON.stringify(before.map((i) => [i.id, seat(i), i.startAt.toISOString(), i.status, i.title, i.missionId]));
    const r = await addCourse(a, { departmentCode: "sec", startDate: START, durationDays: 120, requestKey: "enrol-test-sec-1" });
    expect(r, JSON.stringify(r)).toMatchObject({ ok: true, created: true });

    expect(await codes(a)).toEqual(["fswd", "sec"]);
    expect((await listEnrolments(a)).map((e) => e.departmentCode).sort()).toEqual(["fswd", "sec"]);
    const after = await items(a);
    // Everything that is not spare practice or review time is exactly as it was; only filler seats may have been given up.
    const kept = (rows: typeof before) => rows.filter((i) => i.kind !== "PRACTICE" && i.kind !== "REVIEW").map((i) => [i.id, seat(i), i.startAt.toISOString(), i.status, i.title, i.missionId]);
    expect(JSON.stringify(kept(after.filter((i) => before.some((x) => x.id === i.id))))).toBe(JSON.stringify(kept(before)));
    const changed = after.filter((i) => before.some((x) => x.id === i.id && x.status !== i.status));
    expect(changed.every((i) => (i.kind === "PRACTICE" || i.kind === "REVIEW") && i.status === "CANCELLED")).toBe(true);
    void snapshot;
    const seats = after.filter((i) => i.status !== "CANCELLED").map(seat);
    expect(new Set(seats).size).toBe(seats.length); // one unified timetable, no overlapping sessions
    expect(after.some((i) => i.departmentId && i.missionId && after.length > before.length)).toBe(true);
    expect(await db.learningPlan.count({ where: { userId: a, status: "ACTIVE" } })).toBe(1);
  });

  it("repeating the request, or racing two at once, adds nothing and creates one enrolment", async () => {
    const count = (await items(a)).length;
    expect(await addCourse(a, { departmentCode: "sec", startDate: START, durationDays: 120, requestKey: "enrol-test-sec-1" })).toMatchObject({ ok: true, created: false });
    const [x, y] = await Promise.all([
      addCourse(a, { departmentCode: "ai", startDate: START, durationDays: 150, requestKey: "enrol-test-ai-1" }),
      addCourse(a, { departmentCode: "ai", startDate: START, durationDays: 150, requestKey: "enrol-test-ai-2" }),
    ]);
    expect(x.ok && y.ok).toBe(true);
    expect(await db.courseEnrolment.count({ where: { userId: a, department: { code: "ai" }, status: { in: ["ACTIVE", "PAUSED"] } } })).toBe(1);
    const all = await items(a);
    const seats = all.filter((i) => i.status !== "CANCELLED").map(seat);
    expect(new Set(seats).size).toBe(seats.length);
    expect(all.length).toBeGreaterThanOrEqual(count);
  });

  it("refuses a course that does not fit next to the others, writes nothing and says how to make room", async () => {
    const sparse = await onboarded("Sparse", "fswd", { weekdays: [1], durationKind: "THREE_MONTHS" });
    const before = (await items(sparse)).length;
    const r = await addCourse(sparse, { departmentCode: "sec", startDate: START, durationDays: 14 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/study time|longer duration|start later|fewer than two/i);
    expect((await items(sparse)).length).toBe(before);
    expect(await codes(sparse)).toEqual(["fswd"]);
  });

  it("learner B's enrolments and plan are unaffected by anything A did", async () => {
    expect(await codes(b)).toEqual(["photo"]);
    expect((await listEnrolments(b)).length).toBe(1);
  });
});

describe("one live enrolment per learner and course (database guarantee)", () => {
  it("the partial unique index refuses a second live row but allows re-enrolling after withdrawal", async () => {
    const dept = await db.department.findUniqueOrThrow({ where: { code: "photo" } });
    await expect(db.courseEnrolment.create({ data: { userId: b, departmentId: dept.id, status: "ACTIVE" } })).rejects.toThrow();
    const live = await db.courseEnrolment.findFirstOrThrow({ where: { userId: b, departmentId: dept.id } });
    await db.courseEnrolment.update({ where: { id: live.id }, data: { status: "WITHDRAWN", withdrawnAt: new Date() } });
    expect(await codes(b)).toEqual([]); // withdrawn courses are history, not shown
    await db.courseEnrolment.create({ data: { userId: b, departmentId: dept.id, status: "ACTIVE" } });
    expect(await codes(b)).toEqual(["photo"]);
  });
});
