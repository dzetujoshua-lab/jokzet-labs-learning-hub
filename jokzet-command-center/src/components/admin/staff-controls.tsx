"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRoleAction, setScopeAction } from "@/app/(admin)/admin/staff/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FIELD = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";
const ROLES = [
  { value: "AUTHOR", label: "Curriculum Manager" },
  { value: "REVIEWER", label: "Assessment Reviewer" },
  { value: "ADMIN", label: "Academy Admin" },
  { value: "LEARNER", label: "No staff role (remove)" },
] as const;

/** Assign or remove a role by email. Making someone an Academy Admin asks for the address twice. */
export function AssignRoleForm({ initialRole = "AUTHOR" }: { initialRole?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(ROLES.some((r) => r.value === initialRole) ? initialRole : "AUTHOR");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setRoleAction({ email, role, confirmEmail: confirm });
          setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Done.") : (r.error ?? "Could not change the role.") });
          if (r.ok) { setEmail(""); setConfirm(""); router.refresh(); }
        });
      }}
    >
      <div>
        <label htmlFor="staff-email" className="mono-label mb-1.5 block">Email of a registered account</label>
        <Input id="staff-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </div>
      <div>
        <label htmlFor="staff-role" className="mono-label mb-1.5 block">Role</label>
        <select id="staff-role" className={FIELD} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save role"}</Button>
      {role === "ADMIN" ? (
        <div className="sm:col-span-3">
          <label htmlFor="staff-confirm" className="mono-label mb-1.5 block">Type the email again to confirm Academy Admin</label>
          <Input id="staff-confirm" type="email" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </div>
      ) : null}
      {msg ? <p role={msg.ok ? "status" : "alert"} className={`text-sm sm:col-span-3 ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p> : null}
    </form>
  );
}

/** Add or remove one department for an Assessment Reviewer. */
export function ScopeControl({ email, scopes, departments }: { email: string; scopes: string[]; departments: { code: string; name: string }[] }) {
  const router = useRouter();
  const [dept, setDept] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const change = (department: string, add: boolean) =>
    start(async () => {
      const r = await setScopeAction({ email, department }, add);
      if (!r.ok) return setError(r.error ?? "Could not change the scope.");
      setError("");
      router.refresh();
    });
  const free = departments.filter((d) => !scopes.includes(d.code));
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {scopes.map((s) => (
        <button key={s} type="button" disabled={pending} onClick={() => change(s, false)} aria-label={`Remove ${s} from ${email}`}
          className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:border-destructive/50">
          {s} ✕
        </button>
      ))}
      {free.length ? (
        <>
          <label htmlFor={`scope-${email}`} className="sr-only">Add a department for {email}</label>
          <select id={`scope-${email}`} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">Add department…</option>
            {free.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
          <Button type="button" size="sm" variant="secondary" disabled={!dept || pending} onClick={() => { change(dept, true); setDept(""); }}>Add</Button>
        </>
      ) : null}
      {error ? <p role="alert" className="w-full text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
