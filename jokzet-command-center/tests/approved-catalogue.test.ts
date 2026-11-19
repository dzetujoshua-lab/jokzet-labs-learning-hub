import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MISSION_RESOURCES, RESOURCES } from "../prisma/curriculum/resources";
import { resourceProblems } from "../prisma/curriculum/resource-validate";
import { db } from "@/lib/db";
import { isAllowedEmbedUrl, parseResourceUrl } from "@/lib/resources/embed";
import { listContentGaps } from "@/lib/resources/gaps";

vi.setConfig({ testTimeout: 120_000 });

const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
const LESSONS = [
  "FSWD-L0-01", "FSWD-L0-02", "UXUI-L0-01", "UXUI-L0-02", "SEC-L0-01", "SEC-L0-02", "CLOUD-L0-01", "CLOUD-L0-02", "SYS-L0-01", "SYS-L0-02",
  "AI-L0-01", "AI-L0-02", "PHOTO-L0-01", "PHOTO-L0-02", "VID-L0-01", "VID-L0-02", "BIZ-L0-01", "BIZ-L0-02",
];
const NO_PRIMARY = ["SYS-L0-01", "SYS-L0-02", "VID-L0-02"]; // no acceptable candidate, or partial coverage: kept as gaps on purpose

beforeAll(() => { seed(); }, 300_000);
afterAll(async () => { await db.$disconnect(); });

describe("the approved resource catalogue (19 November 2026)", () => {
  it("passes every quality gate the seed applies", () => {
    expect(resourceProblems(RESOURCES, MISSION_RESOURCES, new Set(LESSONS))).toEqual([]);
  });

  it("records who approved each resource, when, what was checked and what was not", () => {
    expect(RESOURCES).toHaveLength(34);
    for (const r of RESOURCES) {
      expect(r.status, r.title).toBe("APPROVED");
      expect(r.approvedBy, r.title).toMatch(/Academy owner/);
      expect(r.approvedAt, r.title).toBe("2026-11-19");
      expect(r.lastVerifiedAt, r.title).toBe("2026-11-19");
      const review = r.reviews?.find((x) => x.decision === "APPROVED");
      expect(review?.note, r.title).toMatch(/not independently watched in full/); // the record never claims more than was done
      expect(r.title.trim().length, r.url).toBeGreaterThan(5);
      expect(parseResourceUrl(r.url).ok, r.url).toBe(true);
    }
  });

  it("uses only YouTube videos (shown through the privacy-enhanced player) and official documentation hosts", () => {
    for (const r of RESOURCES) {
      const parsed = parseResourceUrl(r.url);
      if (!parsed.ok) throw new Error(r.url);
      if (r.kind === "VIDEO") {
        expect(parsed.provider, r.url).toBe("youtube");
        expect(r.embeddable, r.url).toBe(true);
        expect(isAllowedEmbedUrl(parsed.embedUrl!), r.url).toBe(true);
      } else {
        expect(r.kind, r.url).toBe("DOCUMENTATION");
        expect(parsed.provider, r.url).not.toBe("youtube");
        expect(parsed.embedUrl, r.url).toBeNull(); // documentation opens as an external link
      }
    }
    expect(RESOURCES.some((r) => r.url === "https://nmap.org/book/man.html")).toBe(true); // the host the owner approved, /book only
  });

  it("gives each lesson at most one primary, the standard tools where they matter, and leaves the weak lessons as gaps", () => {
    const primaryOf = (code: string) => MISSION_RESOURCES.filter((l) => l.missionCode === code && l.role === "PRIMARY");
    for (const code of LESSONS) expect(primaryOf(code).length, code).toBeLessThanOrEqual(1);
    for (const code of LESSONS.filter((c) => !NO_PRIMARY.includes(c))) expect(primaryOf(code), code).toHaveLength(1);
    for (const code of NO_PRIMARY) expect(primaryOf(code), code).toHaveLength(0);
    expect(MISSION_RESOURCES.some((l) => l.missionCode === "SYS-L0-01")).toBe(false); // nothing acceptable was found, so nothing is invented
    const videoLessons = MISSION_RESOURCES.filter((l) => l.missionCode.startsWith("VID-"));
    const titles = videoLessons.map((l) => RESOURCES.find((r) => r.url === l.url)!.title).join(" | ");
    expect(titles).toMatch(/DaVinci Resolve/); // the standard editor
  });
});

describe("loading it into the database", () => {
  it("shows the approved resources for the lessons, primary first, and keeps the weak lessons on the gap list", async () => {
    const links = await db.missionResource.count({ where: { mission: { code: { in: LESSONS } }, resource: { status: "APPROVED" } } });
    expect(links).toBe(MISSION_RESOURCES.length);
    const gaps = (await listContentGaps()).map((g) => g.code);
    for (const code of NO_PRIMARY) expect(gaps, code).toContain(code);
    for (const code of LESSONS.filter((c) => !NO_PRIMARY.includes(c))) expect(gaps, code).not.toContain(code);
    const optionalOnly = (await listContentGaps()).filter((g) => g.hasSupplementary).map((g) => g.code).sort();
    expect(optionalOnly).toEqual(["SYS-L0-02", "VID-L0-02"]); // honest: only optional material, no primary
  });

  it("is safe to load twice: the same resources, links and reviews, nothing duplicated", async () => {
    const count = async () => [await db.learningResource.count({ where: { status: "APPROVED" } }), await db.missionResource.count(), await db.resourceReview.count()];
    const before = await count();
    seed();
    expect(await count()).toEqual(before);
    expect(before[0]).toBeGreaterThanOrEqual(34);
  });
});
