"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

const TABS = [
  { to: "/capstone", label: "Overview" },
  { to: "/capstone/sales", label: "Sales" },
  { to: "/capstone/inventory", label: "Inventory" },
  { to: "/capstone/customers", label: "Customers" },
  { to: "/capstone/suppliers", label: "Suppliers" },
  { to: "/capstone/expenses", label: "Expenses" },
] as const;

function TabLinks() {
  const pathname = usePathname();
  return (
    <>
      {TABS.map((t) => {
        const active = t.to === "/capstone" ? pathname === t.to : pathname === t.to || pathname?.startsWith(`${t.to}/`);
        return (
          <Link
            key={t.to}
            href={t.to}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
              active ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </>
  );
}

export function BosTabs() {
  return (
    <nav aria-label="BusinessOS sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      <Suspense fallback={null}>
        <TabLinks />
      </Suspense>
    </nav>
  );
}

export function Tile({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4">
      <p className={`font-display text-xl leading-none tabular-nums md:text-2xl ${tone === "bad" ? "text-destructive" : tone === "good" ? "text-primary" : "text-foreground"}`}>{value}</p>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {message}
    </p>
  ) : null;
}

/** Runs a server action, shows its error inline or a toast, and reports success. */
export function useSubmit() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(action: () => Promise<{ ok: boolean; error?: string }>, opts: { success?: string; onDone?: () => void } = {}) {
    setError(null);
    start(async () => {
      const result = await action();
      if (result.ok) {
        if (opts.success) toast.success(opts.success);
        opts.onDone?.();
      } else setError(result.error ?? "That did not work.");
    });
  }
  return { pending, error, setError, submit };
}

export const NONE = "none";
export const PAY_LABEL: Record<string, string> = { CASH: "Cash", MOMO: "Mobile money", BANK: "Bank", CREDIT: "On credit" };
export const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
