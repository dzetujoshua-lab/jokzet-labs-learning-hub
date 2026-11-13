import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AvailabilityForm } from "@/components/timetable/availability-form";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { timetableAccess } from "@/lib/plan/timetable-service";

export const metadata: Metadata = { title: "Timetable settings" };

export default async function TimetableSettingsPage() {
  const user = await requireUser();
  if (!(await timetableAccess(user.id))) notFound();
  const plan = await db.learningPlan.findFirst({ where: { userId: user.id, status: "ACTIVE" } });
  return (
    <div className="space-y-6">
      <Link href="/timetable" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> timetable
      </Link>
      <PageHeader eyebrow="Timetable" title="Timetable settings" description="Change when you study and how the Academy adjusts your plan." />
      {plan ? (
        <AvailabilityForm
          initial={{ weekdays: [...plan.weekdays].sort((a, b) => a - b), startTime: plan.startTime, sessionMinutes: plan.sessionMinutes, dailyStudyMinutes: plan.dailyStudyMinutes, breakMinutes: plan.breakMinutes, flexibility: plan.flexibility, autoReschedule: plan.autoReschedule }}
        />
      ) : (
        <p className="panel p-5 text-sm text-muted-foreground">Settings are available while your plan is active. If it is paused, resume it from the timetable first.</p>
      )}
    </div>
  );
}
