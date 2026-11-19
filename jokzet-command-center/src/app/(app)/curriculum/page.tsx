import type { Metadata } from "next";
import Link from "next/link";
import { CurriculumView } from "@/components/admin/curriculum-view";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Curriculum" };

/** For Curriculum Managers and Academy Admins. Read-only: a resource reaches learners only when it is approved. */
export default async function CurriculumPage() {
  const user = await requireRole("ADMIN", "AUTHOR");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={user.role === "ADMIN" ? "Academy Admin" : "Curriculum Manager"}
        title="Curriculum"
        description="Lessons that still need an approved learning resource, and every resource's review state. Nothing reaches learners until it is approved."
      />
      {user.role === "ADMIN" ? <p className="text-sm"><Link className="text-primary underline-offset-4 hover:underline" href="/admin">Administration Centre →</Link></p> : null}
      <CurriculumView />
    </div>
  );
}
