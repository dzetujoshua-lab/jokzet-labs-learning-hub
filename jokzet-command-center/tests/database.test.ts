import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { DEPARTMENTS } from "@/lib/departments";

const EMAIL_A = "schema-test-a@example.test";
const EMAIL_B = "schema-test-b@example.test";

async function cleanup() {
  await db.user.deleteMany({ where: { email: { in: [EMAIL_A, EMAIL_B] } } });
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("database connection", () => {
  it("connects to the test database, not development", async () => {
    const rows = await db.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
    expect(rows[0].current_database).toBe("jokzet_learning_test");
  });
});

describe("users and sessions", () => {
  it("enforces unique email", async () => {
    await db.user.create({ data: { email: EMAIL_A, passwordHash: "x" } });
    await expect(db.user.create({ data: { email: EMAIL_A, passwordHash: "y" } })).rejects.toThrow();
  });

  it("applies profile defaults (Africa/Accra, 12:00, 16 Nov 2026)", async () => {
    const user = await db.user.create({
      data: { email: EMAIL_B, passwordHash: "x", profile: { create: { displayName: "Test" } } },
      include: { profile: true },
    });
    expect(user.role).toBe("LEARNER");
    expect(user.profile?.timezone).toBe("Africa/Accra");
    expect(user.profile?.reminderTime).toBe("12:00");
    expect(user.profile?.programmeStart.toISOString().slice(0, 10)).toBe("2026-11-16");
  });

  it("deletes sessions and profile when the user is deleted", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email: EMAIL_B } });
    await db.session.create({
      data: { userId: user.id, tokenHash: "hash-" + user.id, expiresAt: new Date(Date.now() + 60_000) },
    });
    await db.user.delete({ where: { id: user.id } });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.profile.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("curriculum constraints", () => {
  it("rejects duplicate department codes", async () => {
    const data = { code: "dup-test", name: "Dup", icon: "Code2", color: "#fff", sortOrder: 99 };
    await db.department.create({ data });
    await expect(db.department.create({ data })).rejects.toThrow();
    await db.department.delete({ where: { code: "dup-test" } });
  });

  it("keeps the nine department codes stable in config", () => {
    expect(DEPARTMENTS.map((d) => d.code)).toEqual([
      "fswd", "uxui", "sec", "cloud", "sysadmin", "ai", "photo", "video", "biz",
    ]);
  });
});

describe("learner ownership model", () => {
  it("allows only one LearnerMission per user per mission and one submission per attempt", async () => {
    const user = await db.user.create({ data: { email: EMAIL_A + ".own", passwordHash: "x" } });
    const dept = await db.department.create({
      data: { code: "own-test", name: "Own", icon: "Code2", color: "#fff", sortOrder: 98 },
    });
    try {
      const path = await db.learningPath.create({ data: { departmentId: dept.id, title: "p" } });
      const level = await db.level.create({ data: { learningPathId: path.id, number: 0, title: "L0" } });
      const mission = await db.mission.create({
        data: {
          code: "OWN-TEST-1", departmentId: dept.id, levelId: level.id, title: "m", objective: "o",
          durationMinutes: 30, requiredTools: [], experimentChallenge: "e",
          submissionRequirements: "s", remediation: "r",
        },
      });
      const lm = await db.learnerMission.create({ data: { userId: user.id, missionId: mission.id } });
      await expect(db.learnerMission.create({ data: { userId: user.id, missionId: mission.id } })).rejects.toThrow();

      await db.submission.create({ data: { userId: user.id, learnerMissionId: lm.id, attempt: 1 } });
      await expect(
        db.submission.create({ data: { userId: user.id, learnerMissionId: lm.id, attempt: 1 } }),
      ).rejects.toThrow();
      await db.submission.create({ data: { userId: user.id, learnerMissionId: lm.id, attempt: 2 } });
    } finally {
      await db.user.delete({ where: { id: user.id } });
      await db.mission.deleteMany({ where: { departmentId: dept.id } });
      await db.department.delete({ where: { id: dept.id } });
    }
  });
});
