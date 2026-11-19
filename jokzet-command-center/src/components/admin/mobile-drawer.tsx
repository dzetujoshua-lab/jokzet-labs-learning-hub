"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { AdminNav } from "./admin-nav";

/** The navigation drawer for tablets and phones: opens from a button, closes on Escape, on a link or on the backdrop. */
export function MobileDrawer() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} aria-label="Open the navigation menu" aria-expanded={open} aria-controls="admin-drawer"
        className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card/70 text-foreground">
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Administration menu">
          <button type="button" aria-label="Close the menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div id="admin-drawer" className="glass absolute left-0 top-0 flex h-full w-[280px] max-w-[85vw] flex-col gap-4 overflow-y-auto rounded-none rounded-r-2xl p-4">
            <div className="flex items-center justify-between">
              <p className="font-display text-sm text-foreground">Administration Centre</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close the menu" className="grid h-9 w-9 place-items-center rounded-lg border border-border"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <AdminNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
