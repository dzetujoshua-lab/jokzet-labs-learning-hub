import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/dal";
import { searchAcademy, type SearchHit } from "@/lib/search/service";

export const metadata: Metadata = { title: "Search" };

function Group({ title, hits }: { title: string; hits: SearchHit[] }) {
  if (!hits.length) return null;
  return (
    <section className="panel overflow-hidden" aria-label={title}>
      <div className="border-b border-border px-5 py-3"><h2 className="mono-label">{title} · {hits.length}</h2></div>
      <ul>
        {hits.map((h, i) => (
          <li key={`${h.href}-${i}`} className="border-b border-border/60 last:border-0">
            <Link href={h.href} className="block px-5 py-3 transition-colors hover:bg-secondary/40">
              <p className="text-sm text-foreground">{h.title}</p>
              {h.detail ? <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{h.detail}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const user = await requireUser();
  const { q } = await searchParams;
  const raw = Array.isArray(q) ? q[0] : q;
  const r = await searchAcademy(user.id, raw);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Search" title={r.query && !r.tooShort ? `Results for “${r.query}”` : "Search"} description="Lessons and courses you are taking, courses you could add, and your own assessments." />
      {r.tooShort ? (
        <EmptyState icon={Search} title="Type at least two letters" hint="Use the search box at the top to find a lesson, a course or one of your assessments." />
      ) : r.total === 0 ? (
        <EmptyState icon={Search} title="Nothing found" hint="Try a shorter or different word. Only lessons in your own courses and your own assessments are searched." />
      ) : (
        <div className="space-y-4">
          <Group title="Lessons" hits={r.lessons} />
          <Group title="Your courses" hits={r.courses} />
          <Group title="Courses you could add" hits={r.explore} />
          <Group title="Your assessments" hits={r.assessments} />
        </div>
      )}
    </div>
  );
}
