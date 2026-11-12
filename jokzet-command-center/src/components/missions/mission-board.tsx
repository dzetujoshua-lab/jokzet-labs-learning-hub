"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MissionRow } from "@/components/dashboard/mission-row";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { MissionForm } from "@/components/missions/mission-form";
import { sameIsoWeek } from "@/lib/programme";
import type { DepartmentView, MissionView } from "@/lib/missions/service";

const SCOPES = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "all", label: "All" },
] as const;

export function MissionBoard({
  missions, departments, today,
}: { missions: MissionView[]; departments: DepartmentView[]; today: string }) {
  const [scope, setScope] = useState<(typeof SCOPES)[number]["id"]>("today");
  const [dept, setDept] = useState("all");
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = missions;
    if (scope === "today") list = list.filter((m) => m.date === today);
    if (scope === "week") list = list.filter((m) => m.date && sameIsoWeek(m.date, today));
    if (dept !== "all") list = list.filter((m) => m.departmentCode === dept);
    return [...list].sort((a, b) => (a.date ?? "￿").localeCompare(b.date ?? "￿"));
  }, [missions, scope, dept, today]);

  const done = filtered.filter((m) => m.status === "done").length;
  const minutes = filtered.reduce((sum, m) => sum + (m.minutes || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily missions"
        title="Mission board"
        description="Small, finishable actions across the nine departments. Every mission names the evidence it should leave behind."
      >
        <Link
          href="/activities"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-primary"
        >
          Personal activities →
        </Link>
        <Button onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New mission
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-border bg-card p-1">
          {SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={scope === item.id}
              onClick={() => setScope(item.id)}
              className={`rounded-full px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                scope === item.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Filter by department"
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="h-9 rounded-full border border-border bg-card px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground outline-none focus:border-primary"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>

        <p className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {done}/{filtered.length} cleared · {minutes} min
        </p>
      </div>

      <section className="panel overflow-hidden">
        {filtered.length ? (
          <ul>
            {filtered.map((mission) => (
              <MissionRow
                key={mission.id}
                mission={mission}
                deptName={departments.find((d) => d.code === mission.departmentCode)?.name || mission.departmentCode}
                canToggle
                canDelete
              />
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={ListChecks}
              title="Nothing on the board here"
              hint="Add a mission with a clear finish line and the evidence to capture."
            >
              <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New mission
              </Button>
            </EmptyState>
          </div>
        )}
      </section>

      <MissionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        departments={departments}
        today={today}
      />
    </div>
  );
}
