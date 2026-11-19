import { db } from "@/lib/db";
import { listCatalogue, visibleDepartmentIds } from "@/lib/enrolment/service";

/**
 * Site search for one learner. It looks only at content that learner is allowed to see, decided on the server from their own
 * enrolments and submissions (never from the request): published lessons in their enrolled courses, their enrolled courses, the
 * courses they could add, and their own assessments. Unpublished and draft curriculum is never searched.
 */
export type SearchHit = { title: string; detail: string; href: string };
export type SearchResults = { query: string; tooShort: boolean; lessons: SearchHit[]; courses: SearchHit[]; explore: SearchHit[]; assessments: SearchHit[]; total: number };

export const MIN_QUERY = 2;
export const MAX_QUERY = 80;
const PER_GROUP = 8;

/** Trim, collapse whitespace, cap the length. Prisma parameterises the value, so the text cannot change a query; the LIKE wildcards (% and _) and backslash are removed so they cannot match everything. */
export const cleanQuery = (raw: string | undefined | null): string => (raw ?? "").replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);

export async function searchAcademy(userId: string, raw: string | undefined | null): Promise<SearchResults> {
  const query = cleanQuery(raw);
  const empty: SearchResults = { query, tooShort: query.length < MIN_QUERY, lessons: [], courses: [], explore: [], assessments: [], total: 0 };
  if (query.length < MIN_QUERY) return empty;
  const like = { contains: query, mode: "insensitive" as const };
  const visible = await visibleDepartmentIds(userId); // null = the original fixed programme, which shows every department

  const [lessons, courses, offers, submissions] = await Promise.all([
    db.mission.findMany({
      where: {
        createdById: null, isPublished: true, category: "CURRICULUM_MISSION", code: { not: null },
        ...(visible ? { departmentId: { in: visible } } : {}),
        OR: [{ title: like }, { objective: like }, { code: like }],
      },
      orderBy: [{ department: { sortOrder: "asc" } }, { sortOrder: "asc" }], take: PER_GROUP,
      select: { code: true, title: true, department: { select: { name: true } } },
    }),
    db.department.findMany({
      where: { ...(visible ? { id: { in: visible } } : {}), OR: [{ name: like }, { summary: like }, { code: like }] },
      orderBy: { sortOrder: "asc" }, take: PER_GROUP, select: { code: true, name: true, summary: true },
    }),
    listCatalogue(userId),
    db.submission.findMany({
      where: { userId, learnerMission: { mission: { title: like } } },
      orderBy: { submittedAt: "desc" }, take: PER_GROUP,
      select: { id: true, status: true, learnerMission: { select: { mission: { select: { title: true } } } } },
    }),
  ]);

  const q = query.toLowerCase();
  const out: SearchResults = {
    query, tooShort: false,
    lessons: lessons.map((m) => ({ title: m.title, detail: m.department.name, href: `/missions/${m.code}` })),
    courses: courses.map((c) => ({ title: c.name, detail: c.summary ?? "", href: `/departments/${c.code}` })),
    explore: offers.filter((o) => `${o.name} ${o.description}`.toLowerCase().includes(q)).slice(0, PER_GROUP).map((o) => ({ title: o.name, detail: `${o.lessons} lessons · not added yet`, href: "/courses" })),
    assessments: submissions.map((s) => ({ title: s.learnerMission.mission.title, detail: s.status.toLowerCase().replace("_", " "), href: `/assessments/${s.id}` })),
    total: 0,
  };
  out.total = out.lessons.length + out.courses.length + out.explore.length + out.assessments.length;
  return out;
}
