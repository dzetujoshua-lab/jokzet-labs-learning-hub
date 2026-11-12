"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate, registerUser } from "@/lib/auth/service";
import { endSession, startSession } from "@/lib/auth/dal";
import { loginSchema, registerSchema } from "@/lib/auth/validation";

export type FormState = {
  error?: string;
  fieldErrors?: Partial<Record<"displayName" | "email" | "password", string>>;
  email?: string;
  displayName?: string;
} | undefined;

async function requestMeta() {
  const h = await headers();
  return { userAgent: h.get("user-agent"), ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null };
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
  const parsed = registerSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      email: String(formData.get("email") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
    };
  }

  const result = await registerUser(parsed.data);
  if (!result.ok) {
    // Deliberately generic: do not confirm which emails are registered.
    return { error: "We could not create that account. Try a different email or sign in.", email: parsed.data.email, displayName: parsed.data.displayName };
  }
  await startSession(result.userId, await requestMeta());
  redirect("/");
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), email: String(formData.get("email") ?? "") };
  }
  const result = await authenticate(parsed.data);
  if (!result.ok) {
    return {
      error:
        result.error === "LOCKED"
          ? "Too many failed attempts. Try again in 15 minutes."
          : "Incorrect email or password.",
      email: parsed.data.email,
    };
  }
  await startSession(result.userId, await requestMeta());
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
