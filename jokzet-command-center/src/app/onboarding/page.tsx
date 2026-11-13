import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { personalisedLearningEnabled } from "@/lib/plan/flag";
import { getOnboardingState } from "@/lib/plan/onboarding";

export const metadata: Metadata = { title: "Set up your programme" };

/** Outside the (app) group on purpose: the app shell redirects here, so this page must not run that redirect itself. */
export default async function OnboardingPage() {
  const user = await requireUser();
  if (!personalisedLearningEnabled()) redirect("/");
  const state = await getOnboardingState(user.id);
  if (!state || state.learnerMode !== "PERSONALISED" || state.status === "COMPLETE") redirect("/");
  const departments = await db.department.findMany({ orderBy: { sortOrder: "asc" }, select: { code: true, name: true } });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 md:py-16">
      <p className="mono-label">JOKZET Labs</p>
      <h1 className="mt-3 font-display text-[28px] font-medium leading-tight tracking-tight text-foreground md:text-[36px]">Set up your programme</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Tell us what you want to learn and when you can study. You can change this later. A short baseline per subject is optional and only decides where you start; it never earns XP.
      </p>
      <div className="mt-8">
        <OnboardingWizard
          departments={departments}
          state={state}
          today={new Date().toISOString().slice(0, 10)}
        />
      </div>
    </main>
  );
}
