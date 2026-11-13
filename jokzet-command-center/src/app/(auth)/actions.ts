"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate, registerUser } from "@/lib/auth/service";
import { endSession, startSession } from "@/lib/auth/dal";
import { loginSchema, registerFormSchema } from "@/lib/auth/validation";
import { LIMITS, bucketKey, clientIp, rateLimitHit } from "@/lib/ratelimit";

export type FormState = {
  error?: string;
  fieldErrors?: Partial<Record<"displayName" | "email" | "password" | "adult", string>>;
  email?: string;
  displayName?: string;
} | undefined;

async function requestMeta() {
  const h = await headers();
  return { userAgent: h.get("user-agent"), ipAddress: clientIp(h) };
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0]);
    if (!(key in out)) out[key] = issue.message;
  }
  return out as NonNullable<FormState>["fieldErrors"];
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  if (process.env.ALLOW_REGISTRATION === "false") {
    return { error: "Registration is closed." };
  }
  const meta = await requestMeta();
  const registerLimit = await rateLimitHit(bucketKey("register:ip", meta.ipAddress ?? "unknown"), LIMITS.registerIp);
  if (!registerLimit.ok) {
    return { error: "Too many sign-up attempts from this network. Please try again later." };
  }
  const parsed = registerFormSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    adult: formData.get("adult") ?? undefined,
  });
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      email: String(formData.get("email") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
    };
  }

  const result = await registerUser({ displayName: parsed.data.displayName, email: parsed.data.email, password: parsed.data.password }, { adultConfirmed: true });
  if (!result.ok) {
    // Deliberately generic: do not confirm which emails are registered.
    return { error: "We could not create that account. Try a different email or sign in.", email: parsed.data.email, displayName: parsed.data.displayName };
  }
  await startSession(result.userId, meta);
  redirect("/");
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), email: String(formData.get("email") ?? "") };
  }
  const meta = await requestMeta();
  const result = await authenticate(parsed.data, { ip: meta.ipAddress ?? undefined });
  if (!result.ok) {
    return {
      // One message for every failure (wrong password, unknown email, disabled account, throttled): no account oracle.
      error: "Incorrect email or password, or too many attempts. Wait a few minutes and try again.",
      email: parsed.data.email,
    };
  }
  await startSession(result.userId, meta);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
