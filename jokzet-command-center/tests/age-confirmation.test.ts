import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthForm } from "@/components/auth/auth-form";
import { registerUser } from "@/lib/auth/service";
import { registerFormSchema, registerSchema } from "@/lib/auth/validation";
import { db } from "@/lib/db";

const base = { displayName: "Adult Check", email: "age-test-a@example.test", password: "a-long-enough-pass-1" };

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "age-test" } } });
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "age-test" } } });
  await db.$disconnect();
});

describe("the sign-up form requires the 18+ confirmation", () => {
  it("rejects a missing or wrong value, and accepts only the ticked checkbox", () => {
    for (const adult of [undefined, "", "off", "true", "yes", false]) {
      const r = registerFormSchema.safeParse({ ...base, adult });
      expect(r.success, String(adult)).toBe(false);
      if (!r.success) expect(r.error.issues[0].path).toEqual(["adult"]);
    }
    expect(registerFormSchema.safeParse({ ...base, adult: "on" }).success).toBe(true);
  });

  it("leaves the plain registration schema alone (other callers do not collect it)", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it("shows a labelled checkbox on the sign-up page and not on sign-in", () => {
    const noop = async () => undefined;
    const register = renderToStaticMarkup(createElement(AuthForm, { mode: "register", action: noop }));
    expect(register).toMatch(/<input[^>]*type="checkbox"[^>]*name="adult"/);
    expect(register).toContain("I confirm that I am 18 years old or older.");
    expect(renderToStaticMarkup(createElement(AuthForm, { mode: "login", action: noop }))).not.toContain('name="adult"');
  });
});

describe("what is recorded", () => {
  it("records the confirmation time only when the sign-up form asked, never by default", async () => {
    const plain = await registerUser({ ...base, email: "age-test-plain@example.test" });
    const asked = await registerUser({ ...base, email: "age-test-asked@example.test" }, { adultConfirmed: true });
    if (!plain.ok || !asked.ok) throw new Error("registration failed");
    expect((await db.profile.findUniqueOrThrow({ where: { userId: plain.userId } })).adultConfirmedAt).toBeNull();
    const at = (await db.profile.findUniqueOrThrow({ where: { userId: asked.userId } })).adultConfirmedAt;
    expect(at).toBeInstanceOf(Date);
    expect(Math.abs(Date.now() - at!.getTime())).toBeLessThan(60_000);
  });
});
