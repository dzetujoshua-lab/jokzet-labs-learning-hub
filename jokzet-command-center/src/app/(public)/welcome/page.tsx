import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { BrandLogo } from "@/components/brand-logo";
import { BackgroundDoodles } from "@/components/home/background-doodles";
import { LegalFooter } from "@/components/legal-footer";

export const metadata: Metadata = {
  title: "JOKZET Labs Academy",
  description: "Practical, project-based learning with a personal timetable that fits your week.",
};

const POINTS = [
  { title: "Pick your first course", text: "Tell us what you want to learn, how long you have and when you can study. You get a syllabus and a timetable built for you." },
  { title: "Learn by doing", text: "Each lesson is watch, do, experiment and show. You build real work and keep the evidence." },
  { title: "Get honest feedback", text: "Your work is scored against a clear rubric. Official progress is confirmed by a person, so it means something." },
];

/** The public front door. Signed-in learners are sent straight to their dashboard. */
export default function WelcomePage() {
  return (
    <>
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <BackgroundDoodles />
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-10 w-10" />
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">Jokzet Labs</p>
          </div>
          <Link href="/login" className="rounded-full border border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground transition-colors hover:border-primary/50">
            Sign in
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 sm:py-24">
          <p className="mono-label">Learning Academy</p>
          <h1 className="mt-4 max-w-3xl font-display text-[38px] font-medium leading-[1.05] tracking-tight text-foreground sm:text-[60px]">
            Build Beyond Possible.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Practical skills in web development, design, security, cloud, AI, business and more. Choose a course, set your study time, and follow a personal plan from your first lesson to finished work.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register" className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
              Start learning
            </Link>
            <Link href="/login" className="inline-flex h-11 items-center rounded-full border border-border px-6 text-sm text-foreground transition-colors hover:border-primary/50">
              I already have an account
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">For learners aged 18 and over.</p>
        </section>

        <section aria-label="How it works" className="grid gap-3 pb-10 sm:grid-cols-3">
          {POINTS.map((p, i) => (
            <article key={p.title} className="panel p-5 backdrop-blur-sm">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">0{i + 1}</p>
              <h2 className="mt-3 text-sm font-medium text-foreground">{p.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{p.text}</p>
            </article>
          ))}
        </section>

        <LegalFooter className="pb-4 text-center" />
      </main>
    </>
  );
}
