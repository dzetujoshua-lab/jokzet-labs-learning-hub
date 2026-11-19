import type { Metadata } from "next";
import { CurriculumView } from "@/components/admin/curriculum-view";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Administration Centre · Curriculum" };

export default async function AdminCurriculumPage() {
  await requireRole("ADMIN");
  return (
    <div className="space-y-5">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--admin-cyan))]">Administration Centre</p>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-tight text-foreground">Curriculum</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Lessons that still need an approved learning resource, and every resource&apos;s review state. Nothing reaches learners until it is approved.</p>
      </header>
      <CurriculumView />
    </div>
  );
}
