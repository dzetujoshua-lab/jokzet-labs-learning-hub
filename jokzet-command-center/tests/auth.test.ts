import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { authenticate, registerUser, LOCKOUT_MS, MAX_FAILED_LOGINS } from "@/lib/auth/service";
import { createSessionRecord, deleteSessionByToken, hashToken, resolveSession } from "@/lib/auth/sessions";
import { loginSchema, passwordSchema, registerSchema } from "@/lib/auth/validation";

const EMAIL = "auth-test@example.test";
const PASSWORD = "correct-horse-42battery";

async function cleanup() {
  await db.user.deleteMany({ where: { email: { startsWith: "auth-test" } } });
}

beforeAll(async () => {
  await cleanup();
  // Ensure the nine departments exist in the test database so registration creates Level 0 rows.
  const { DEPARTMENTS } = await import("@/lib/departments");
  for (const [i, d] of DEPARTMENTS.entries()) {
    await db.department.upsert({
      where: { code: d.code },
      update: {},
      create: { code: d.code, name: d.name, icon: d.icon, color: d.color, sortOrder: i },
    });
  }
});
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("validation", () => {
  it("rejects weak passwords", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("onlylettersnodigits").success).toBe(false);
    expect(passwordSchema.safeParse("long-enough-pass-12").success).toBe(true);
  });
  it("normalises email to lowercase and trims", () => {
    const r = registerSchema.parse({ displayName: " A ", email: "  USER@Example.COM ", password: PASSWORD });
    expect(r.email).toBe("user@example.com");
    expect(r.displayName).toBe("A");
  });
  it("rejects invalid email on login", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
});

describe("password hashing", () => {
  it("uses argon2id and verifies correctly", async () => {
    const h = await hashPassword(PASSWORD);
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(h, PASSWORD)).toBe(true);
    expect(await verifyPassword(h, "wrong")).toBe(false);
    expect(await verifyPassword("not-a-hash", PASSWORD)).toBe(false);
  });
});

describe("registration", () => {
  it("creates user, profile and nine Level 0 department records; never stores the plain password", async () => {
    const result = await registerUser({ displayName: "Tester", email: EMAIL, password: PASSWORD });
    expect(result.ok).toBe(true);
    const user = await db.user.findUniqueOrThrow({
      where: { email: EMAIL },
      include: { profile: true, departmentProgress: true },
    });
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(user.profile?.displayName).toBe("Tester");
    expect(user.departmentProgress).toHaveLength(9);
    expect(user.departmentProgress.every((p) => p.level === 0 && p.xp === 0)).toBe(true);
  });

  it("rejects duplicate email", async () => {
    const result = await registerUser({ displayName: "Dup", email: EMAIL, password: PASSWORD });
    expect(result).toEqual({ ok: false, error: "EMAIL_TAKEN" });
  });
});

describe("authentication and lockout", () => {
  it("returns the same error for unknown email and wrong password", async () => {
    const unknown = await authenticate({ email: "auth-test-nobody@example.test", password: "whatever-123456" });
    const wrong = await authenticate({ email: EMAIL, password: "wrong-password-123" });
    expect(unknown).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
    expect(wrong).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
  });

  it("accepts the correct password and resets the failure counter", async () => {
    const result = await authenticate({ email: EMAIL, password: PASSWORD });
    expect(result.ok).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.failedLogins).toBe(0);
  });

  it("locks the account after repeated failures, even for the right password", async () => {
    await registerUser({ displayName: "Lock", email: "auth-test-lock@example.test", password: PASSWORD });
    let last;
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      last = await authenticate({ email: "auth-test-lock@example.test", password: "bad-password-123" });
    }
    expect(last).toEqual({ ok: false, error: "LOCKED" });
    const correct = await authenticate({ email: "auth-test-lock@example.test", password: PASSWORD });
    expect(correct).toEqual({ ok: false, error: "LOCKED" });

    // Lock expires.
    await db.user.update({
      where: { email: "auth-test-lock@example.test" },
      data: { lockedUntil: new Date(Date.now() - LOCKOUT_MS) },
    });
    expect((await authenticate({ email: "auth-test-lock@example.test", password: PASSWORD })).ok).toBe(true);
  });

  it("rejects disabled users", async () => {
    await db.user.update({ where: { email: EMAIL }, data: { isActive: false } });
    expect((await authenticate({ email: EMAIL, password: PASSWORD })).ok).toBe(false);
    await db.user.update({ where: { email: EMAIL }, data: { isActive: true } });
  });
});

describe("sessions", () => {
  it("stores only a hash of the token and resolves it to the user", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
    const { token } = await createSessionRecord(user.id);
    expect(await db.session.count({ where: { tokenHash: token } })).toBe(0);
    expect(await db.session.count({ where: { tokenHash: hashToken(token) } })).toBe(1);
    const resolved = await resolveSession(token);
    expect(resolved?.id).toBe(user.id);
    expect(resolved?.email).toBe(EMAIL);
  });

  it("rejects unknown, malformed and expired tokens", async () => {
    expect(await resolveSession(undefined)).toBeNull();
    expect(await resolveSession("garbage")).toBeNull();
    expect(await resolveSession("x".repeat(500))).toBeNull();

    const user = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
    const { token } = await createSessionRecord(user.id);
    await db.session.update({ where: { tokenHash: hashToken(token) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await resolveSession(token)).toBeNull();
  });

  it("is invalid after logout and when the user is deactivated", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
    const { token } = await createSessionRecord(user.id);
    await deleteSessionByToken(token);
    expect(await resolveSession(token)).toBeNull();

    const second = await createSessionRecord(user.id);
    await db.user.update({ where: { id: user.id }, data: { isActive: false } });
    expect(await resolveSession(second.token)).toBeNull();
    await db.user.update({ where: { id: user.id }, data: { isActive: true } });
  });
});
