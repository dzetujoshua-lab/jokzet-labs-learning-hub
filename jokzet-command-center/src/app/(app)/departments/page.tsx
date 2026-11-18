import type { Metadata } from "next";
import Link from "next/link";
import { DepartmentCard } from "@/components/dashboard/department-card";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/dal";
import { getDashboardData } from "@/lib/dashboard";
import { PROGRAMME_XP_PER_LEVEL, sameIsoWeek, todayISO } from "@/lib/programme";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const user = await requireUser();
  const { departments, missions, evidenceCount } = await getDashboardData(user.id);

  const totalXp = departments.reduce((sum, d) => sum + d.xp, 0);
  const today = todayISO();
  const weekMissions = missions.filter((m) => m.date && sameIsoWeek(m.date, today));

  const tiles = [
    { label: "Programme XP", value: totalXp },
    { label: "Programme level", value: Math.floor(totalXp / PROGRAMME_XP_PER_LEVEL) },
    { label: "Missions this week", value: weekMissions.length },
    { label: "Evidence logged", value: evidenceCount },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={departments.length === 1 ? "Your course" : "Your courses"}
        title="Skill progression"
        description="The courses you are taking. Each runs on the same rule: 300 XP per level, earned only by finishing practical missions that a reviewer has confirmed."
      >
        <Link href="/courses" className="rounded-full border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
          Explore courses
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-border bg-card px-4 py-4">
            <p className="font-display text-2xl leading-none tabular-nums text-foreground">{tile.value}</p>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{tile.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {departments.map((dept) => (
          <DepartmentCard key={dept.id} dept={dept} />
        ))}
      </div>
    </div>
  );
}
