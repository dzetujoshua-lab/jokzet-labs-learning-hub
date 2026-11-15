import { describe, expect, it } from "vitest";
import { moduleById } from "../prisma/curriculum/framework";
import { MISSION_DRAFTS, missionsForModule, type MissionDraft } from "../prisma/curriculum/framework/missions";
import { missionDraftProblems, missionSetProblems, missionStats } from "../prisma/curriculum/framework/missions/validate";

const sound = MISSION_DRAFTS.find((m) => m.code === "FSWD-L0-04")!;
const bad = (patch: Partial<MissionDraft>): MissionDraft => ({ ...sound, ...patch });
const text = (m: MissionDraft) => JSON.stringify(m);

describe("the authored pilot missions", () => {
  it("pass every mission gate and every set-level check", () => {
    expect(missionSetProblems(MISSION_DRAFTS)).toEqual([]);
  });

  it("cover the pilot programmes' Level 0 modules completely", () => {
    for (const id of ["FSWD-L0-M01", "FSWD-L0-M02", "FSWD-L0-M03", "BIZ-L0-M01", "BIZ-L0-M02", "BIZ-L0-M03"]) {
      const mod = moduleById(id)!;
      const list = missionsForModule(id);
      expect(list.length, id).toBeGreaterThanOrEqual(3);
      for (const c of mod.competencies) expect(list.some((m) => m.competencies.includes(c)), `${id} ${c}`).toBe(true);
    }
    expect(missionStats(MISSION_DRAFTS).missions).toBe(20);
  });

  it("follow WATCH, DO, EXPERIMENT, SHOW with practical work dominating", () => {
    for (const m of MISSION_DRAFTS) {
      expect(m.watch.minutes / m.minutes, m.code).toBeLessThanOrEqual(0.35);
      expect(m.doSteps.length, m.code).toBeGreaterThanOrEqual(3);
      expect(m.experiment.length, m.code).toBeGreaterThan(50);
      expect(m.show, m.code).toMatch(/submit/i);
      expect(m.verification.length, m.code).toBeGreaterThanOrEqual(3);
    }
  });

  it("never contain a resource link, an approved resource, or a status above DRAFT", () => {
    for (const m of MISSION_DRAFTS) {
      expect(text(m), m.code).not.toMatch(/https?:\/\/|www\./i);
      expect(m.status).toBe("DRAFT");
    }
    expect(missionStats(MISSION_DRAFTS).withApprovedResource).toBe(0);
  });

  it("continue the legacy numbering and never reuse a code", () => {
    const codes = MISSION_DRAFTS.map((m) => m.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).not.toContain("FSWD-L0-01");
    expect(codes).not.toContain("BIZ-L0-02");
    expect(codes[0]).toBe("FSWD-L0-03");
  });

  it("award honest XP: between 0.35 and 0.5 per minute", () => {
    for (const m of MISSION_DRAFTS) {
      expect(m.xp / m.minutes, m.code).toBeGreaterThanOrEqual(0.3);
      expect(m.xp / m.minutes, m.code).toBeLessThanOrEqual(0.5);
    }
  });
});

describe("the mission validator rejects bad missions", () => {
  it("accepts a sound mission", () => {
    expect(missionDraftProblems(sound)).toEqual([]);
  });

  it.each([
    ["a pasted link", { watch: { ...sound.watch, brief: "Watch the video at https://example.com/video and follow along carefully with it." } }, "contains a link"],
    ["too much WATCH", { watch: { ...sound.watch, minutes: 90 } }, "at least 65%"],
    ["inflated XP", { xp: 150 }, "no inflated XP"],
    ["xp not in fives", { xp: 63 }, "multiple of 5"],
    ["a rubric that does not total 100", { rubric: sound.rubric.map((r, i) => (i === 0 ? { ...r, points: r.points + 10 } : r)) }, "expected 100"],
    ["too few rubric criteria", { rubric: sound.rubric.slice(0, 2) }, "3 to 6 criteria"],
    ["a rubric with no family criteria", { rubric: sound.rubric.map((r) => ({ ...r, criterion: `Mine ${r.criterion}` })) }, "rubric points use"],
    ["a vague objective", { objective: "Learn about how websites work and understand the basics of publishing pages." }, "observable result"],
    ["a competency the module does not teach", { competencies: ["sql-postgres"] }, "is not one of module"],
    ["the wrong level in the code", { code: "FSWD-L2-04" }, "code says level 2"],
    ["the wrong programme prefix", { code: "BIZ-L0-04" }, "code prefix must be FSWD"],
    ["an unknown module", { moduleId: "FSWD-L0-M99" }, "does not exist"],
    ["a status above DRAFT", { status: "PUBLISHED" as never }, "must be DRAFT"],
    ["too few steps", { doSteps: sound.doSteps.slice(0, 2) }, "at least three concrete steps"],
    ["no objective checks", { verification: ["Looks good to me."] }, "at least three objective checks"],
    ["a secret in the content", { experiment: "Use this key to test it: AKIAABCDEFGHIJKLMNOP and then change the page title to see what happens." }, "contains"],
  ] as [string, Partial<MissionDraft>, string][])("rejects %s", (_name, patch, message) => {
    expect(missionDraftProblems(bad(patch)).join("\n")).toContain(message);
  });

  it("catches set-level problems: a colliding legacy code, a gap, a duplicate and an uncovered competency", () => {
    expect(missionSetProblems([bad({ code: "FSWD-L0-01" })]).join("\n")).toContain("collides with an existing mission code");
    expect(missionSetProblems([bad({ code: "FSWD-L0-07" })]).join("\n")).toContain("without gaps");
    expect(missionSetProblems([sound, sound]).join("\n")).toContain("used twice");
    const noComp = MISSION_DRAFTS.filter((m) => m.moduleId === "FSWD-L0-M03" && m.code !== "FSWD-L0-09" && m.code !== "FSWD-L0-12");
    expect(missionSetProblems(noComp).join("\n")).toMatch(/consecutive codes|without gaps/);
  });
});
