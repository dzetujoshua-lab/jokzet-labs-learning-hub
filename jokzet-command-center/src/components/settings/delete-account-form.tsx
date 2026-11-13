"use client";

import { useActionState } from "react";
import { deleteAccountAction, type DeleteAccountState } from "@/app/(app)/settings/delete-account-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(deleteAccountAction, undefined);
  return (
    <form
      action={action}
      className="mt-4 max-w-md space-y-3"
      onSubmit={(e) => {
        if (!window.confirm("Permanently delete your account and everything linked to it? This cannot be undone.")) e.preventDefault();
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="delete-password" className="text-[13px] text-foreground">Your password</label>
        <Input id="delete-password" name="password" type="password" autoComplete="current-password" required maxLength={256} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="delete-phrase" className="text-[13px] text-foreground">
          Type <span className="font-mono">DELETE MY ACCOUNT</span> to confirm
        </label>
        <Input id="delete-phrase" name="phrase" type="text" autoComplete="off" required maxLength={40} />
      </div>
      {state?.error ? <p role="alert" className="text-[13px] text-destructive">{state.error}</p> : null}
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Deleting…" : "Permanently delete my account"}
      </Button>
    </form>
  );
}
