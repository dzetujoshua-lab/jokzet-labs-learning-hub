import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// P0 changes: one initial course in onboarding (enforced on the server), the account area reachable mid-onboarding,
// and no official credit without a reviewer. Credit rules are covered in assessments, reviews and missions tests.
const session = { user: { id: "", email: "", displayName: "P0", role: "LEARNER" as const } };
vi.mock("@/lib/auth/dal", () => ({
  requireUser: async () => session.user,
  requireOnboardedUser: async () => session.user,
  getCurrentUser: async () => session.user,
  getOnboardedUser: async () => session.user,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { saveOnboardingAction } from "@/app/onboarding/actions";
import type { OnboardingInput } from "@/lib/plan/schema";

const root = (p: string) => path.resolve(import.meta.dirname, "..", p);
const read = (p: string) => readFileSync(root(p), "utf8");
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });

const answers = (goals: OnboardingInput["goals"]): OnboardingInput => ({
  experience: "BEGINNER", goals, sessionMinutes: 45, weekdays: [1, 3, 5], startTime: "18:00", timezone: "Africa/Accra", durationKind: "ONE_MONTH", startDate: "2026-12-07",
});
const goal = (departmentCode: string) => ({ departmentCode, weight: 3, targetLevel: 1, note: "" });

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "p0-test" } } });
  seed();
  process.env.PERSONALISED_LEARNING = "on";
  const r = await registerUser({ displayName: "P0", email: "p0-test-a@example.test", password: "correct-horse-42battery" }, { adultConfirmed: true });
  if (!r.ok) throw new Error("registration failed");
  session.user.id = r.userId;
}, 300_000);
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "p0-test" } } });
  await db.$disconnect();
});

describe("onboarding enrols exactly one initial course (enforced on the server)", () => {
  it("refuses zero, two or more courses and saves nothing", async () => {
    for (const goals of [[], [goal("fswd"), goal("sec")], [goal("fswd"), goal("sec"), goal("ai")]]) {
      const r = await saveOnboardingAction(answers(goals));
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/one course/i);
    }
    expect(await db.learningPlan.count({ where: { userId: session.user.id } })).toBe(0);
  });

  it("accepts one course and creates one draft with one goal", async () => {
    expect(await saveOnboardingAction(answers([goal("fswd")]))).toEqual({ ok: true });
    expect(await db.learningPlan.count({ where: { userId: session.user.id, status: "DRAFT" } })).toBe(1);
    expect(await db.learningGoal.count({ where: { userId: session.user.id } })).toBe(1);
  });

  it("the wizard offers a single choice, not a multi-select", () => {
    const wizard = read("src/components/onboarding/onboarding-wizard.tsx");
    expect(wizard).toContain("selectCourse");
    expect(wizard).toContain('role="radiogroup"');
    expect(wizard).not.toContain("toggleGoal");
  });
});

describe("account area stays reachable while onboarding is unfinished (SEC-13)", () => {
  it("Settings and Privacy live in their own layout that does not enforce onboarding", () => {
    expect(existsSync(root("src/app/(account)/privacy/page.tsx"))).toBe(true);
    expect(existsSync(root("src/app/(account)/settings/page.tsx"))).toBe(true);
    expect(existsSync(root("src/app/(app)/privacy/page.tsx"))).toBe(false);
    expect(existsSync(root("src/app/(app)/settings/page.tsx"))).toBe(false);
    expect(read("src/app/(account)/layout.tsx")).toContain("enforceOnboarding={false}");
    expect(read("src/app/(app)/layout.tsx")).toContain("enforceOnboarding>");
  });

  it("the account area still requires a signed-in user", () => {
    expect(read("src/components/layout/auth-gate.tsx")).toContain("await requireUser()");
  });
});

describe("hygiene", () => {
  it("does not advertise the framework in a response header", () => {
    expect(read("next.config.ts")).toContain("poweredByHeader: false");
  });
});
