"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/app/(auth)/actions";

type Mode = "login" | "register";

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  error,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete: string;
  error?: string;
  defaultValue?: string;
  hint?: string;
}) {
  const errorId = `${name}-error`;
  return (
    <div>
      <label htmlFor={name} className="mono-label mb-1.5 block">
        {label}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {hint && !error ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AuthForm({
  mode,
  action,
}: {
  mode: Mode;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const errors = state?.fieldErrors;
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state?.error ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}
      {mode === "register" ? (
        <Field label="Name" name="displayName" autoComplete="name" defaultValue={state?.displayName} error={errors?.displayName} />
      ) : null}
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.email} error={errors?.email} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === "register" ? "new-password" : "current-password"}
        error={errors?.password}
        hint={mode === "register" ? "At least 12 characters, with a letter and a number." : undefined}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}
