import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackgroundDoodles } from "@/components/home/background-doodles";
import { RouteAtmosphere } from "@/components/home/route-atmosphere";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { personalisedLearningEnabled } from "@/lib/plan/flag";
import { getOnboardingState } from "@/lib/plan/onboarding";
import { infoFor } from "@/lib/plan/programme-info";
import { getPlanReview } from "@/lib/plan/review";

export const metadata: Metadata = { title: "Set up your programme" };

// Per-request session lookup: blocking by design (see the layout). Declared here as well so a refresh of this page is covered.
export const instant = false;

/** Outside the (app) group on purpose: the app shell redirects here, so this page must not run that redirect itself. */
export default async function OnboardingPage() {
  const user = await requireUser();
  if (!personalisedLearningEnabled()) redirect("/");
  const state = await getOnboardingState(user.id);
  if (!state || state.learnerMode !== "PERSONALISED" || state.status === "COMPLETE") redirect("/");
  const rows = await db.department.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true, summary: true } });
  const published = await db.mission.groupBy({ by: ["departmentId"], where: { createdById: null, isPublished: true, role: "LESSON" }, _count: { _all: true } });
  const countOf = new Map(published.map((p) => [p.departmentId, p._count._all]));
  // Only programmes with published lessons can be chosen.
  const departments = rows
    .filter((r) => (countOf.get(r.id) ?? 0) > 0)
    .map((r) => ({ code: r.code, name: r.name, description: infoFor(r.code).description || (r.summary ?? ""), outcomes: infoFor(r.code).outcomes, lessons: countOf.get(r.id) ?? 0 }));
  const review = state.status === "PLAN_REVIEW" ? await getPlanReview(user.id) : null;
  // A review whose plan is gone, or a generation that never finished, is treated as still answering questions.
  const status = (state.status === "PLAN_REVIEW" && !review) || state.status === "PLAN_GENERATING" ? "IN_PROGRESS" : state.status;

  return (
    <>
    <BackgroundDoodles behind />
    <RouteAtmosphere fixed="low" />
    <main className="mx-auto w-full max-w-2xl px-4 py-10 md:py-16">
      <p className="mono-label">JOKZET Labs</p>
      <h1 className="mt-3 font-display text-[28px] font-medium leading-tight tracking-tight text-foreground md:text-[36px]">Build your programme</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Tell us what you want to learn and when you can study. You can change this later. A short baseline per subject is optional and only decides where you start; it never earns XP.
      </p>
      <div className="mt-8">
        <OnboardingWizard
          departments={departments}
          state={{ ...state, status }}
          review={review}
          today={new Date().toISOString().slice(0, 10)}
        />
      </div>
    </main>
    </>
  );
}
