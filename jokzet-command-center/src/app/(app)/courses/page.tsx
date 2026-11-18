import type { Metadata } from "next";
import Link from "next/link";
import { AddCourseCard } from "@/components/courses/add-course-card";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/dal";
import { listCatalogue } from "@/lib/enrolment/service";
import { todayISO } from "@/lib/programme";

export const metadata: Metadata = { title: "Explore courses" };

/** The course catalogue: courses the learner could add. It is not the list of courses they are taking (that is Departments). */
export default async function CoursesPage() {
  const user = await requireUser();
  const offers = await listCatalogue(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Explore courses"
        title="Add a course"
        description="Choose a course to add to your learning. It gets its own syllabus and progress, and its sessions fit around the courses you already take. Nothing is added until you confirm."
      >
        <Link href="/departments" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">
          Back to my courses
        </Link>
      </PageHeader>

      {offers.length === 0 ? (
        <p className="panel p-5 text-sm text-muted-foreground">There are no other courses available right now. New courses appear here as soon as their curriculum is approved.</p>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          {offers.map((o) => (
            <AddCourseCard key={o.code} offer={o} today={todayISO()} />
          ))}
        </div>
      )}
    </div>
  );
}
