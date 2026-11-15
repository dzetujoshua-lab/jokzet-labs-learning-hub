import { describe, expect, it } from "vitest";
import { ALL_MODULES, PATHWAYS, PROGRAMMES, SHARED, pathwayHours, pathwaySequence, moduleById } from "../prisma/curriculum/framework";
import { frameworkProblems, frameworkStats, moduleProblems, programmesUsing } from "../prisma/curriculum/framework/validate";
import type { ModuleSpec } from "../prisma/curriculum/framework";

const good: ModuleSpec = {
  id: "FSWD-L1-M09", level: 1, title: "A sound module", status: "DRAFT", hours: 10, prerequisites: [], competencies: ["typescript"], evidence: ["REPOSITORY"], rubric: "WEB",
  outcome: "Convert a small JavaScript app to TypeScript and fix every compiler error, then submit the repository.",
};
const comps = { typescript: "x" };

describe("the real curriculum framework", () => {
  it("passes every structural check", () => {
    expect(frameworkProblems()).toEqual([]);
  });

  it("covers nine programmes, each with all five levels", () => {
    expect(PROGRAMMES.map((p) => p.code).sort()).toEqual(["ai", "biz", "cloud", "fswd", "gfx", "photo", "sec", "uxui", "video"]);
    for (const p of PROGRAMMES) {
      for (const level of [0, 1, 2, 3, 4]) expect(p.modules.filter((m) => m.level === level).length, `${p.code} L${level}`).toBeGreaterThanOrEqual(3);
      expect(p.levelOutcomes).toHaveLength(5);
    }
  });

  it("keeps everything DRAFT: nothing here may be assigned to learners yet", () => {
    expect(ALL_MODULES.every((m) => m.status === "DRAFT")).toBe(true);
    expect(frameworkStats().byStatus).toEqual({ DRAFT: ALL_MODULES.length });
  });

  it("reuses shared modules instead of repeating them across programmes", () => {
    for (const s of SHARED.modules) {
      expect(programmesUsing(s.id).size, s.id).toBeGreaterThanOrEqual(2);
    }
    const titles = ALL_MODULES.map((m) => m.title.toLowerCase());
    expect(new Set(titles).size, "no duplicate module titles").toBe(titles.length);
  });

  it("builds a valid recommended sequence for every pathway, prerequisites first", () => {
    expect(PATHWAYS.map((p) => p.code)).toEqual(["full-stack-engineer", "cybersecurity-specialist", "ai-automation-engineer", "digital-product-designer", "digital-content-creator", "digital-entrepreneur", "cloud-devops-engineer"]);
    for (const path of PATHWAYS) {
      const seq = pathwaySequence(path);
      const pos = new Map(seq.map((id, i) => [id, i]));
      for (const id of seq) for (const pre of moduleById(id)!.prerequisites) expect(pos.get(pre)!, `${path.code}: ${pre} before ${id}`).toBeLessThan(pos.get(id)!);
      expect(pathwayHours(path)).toBeGreaterThan(100);
    }
  });

  it("does not make a pathway repeat a shared module", () => {
    for (const path of PATHWAYS) {
      const seq = pathwaySequence(path);
      expect(new Set(seq).size).toBe(seq.length);
    }
  });

  it("lets a learner take Cloud and Server Administration on its own or combined with the four programmes it supports", () => {
    const own = PATHWAYS.find((p) => p.code === "cloud-devops-engineer")!;
    expect(own.requiredProgrammes).toEqual(["cloud", "fswd"]);
    for (const code of ["full-stack-engineer", "cybersecurity-specialist", "ai-automation-engineer", "digital-entrepreneur"]) {
      expect(PATHWAYS.find((p) => p.code === code)!.optionalProgrammes, code).toContain("cloud");
    }
    expect(PATHWAYS.find((p) => p.code === "digital-entrepreneur")!.electives!.from).toContain("cloud");
    // Cloud needs only the shared core and FSWD SQL; it does not drag in unrelated programmes.
    const cloudDeps = new Set(pathwaySequence({ ...own, requiredProgrammes: ["cloud"], requiredLevels: { cloud: 4 } }).map((id) => id.split("-")[0]));
    expect([...cloudDeps].sort()).toEqual(["CLOUD", "FSWD", "SH"]);
  });

  it("covers every practical area in the brief", () => {
    const text = ALL_MODULES.filter((m) => m.id.startsWith("CLOUD-")).map((m) => (m.title + " " + m.outcome).toLowerCase()).join(" ");
    for (const topic of ["ubuntu", "windows server", "cpanel", "ssh", "dns", "apache", "nginx", "postgresql", "mysql", "tls", "vps", "docker", "ci/cd", "firewall", "backup", "monitoring", "kubernetes", "infrastructure as code", "disaster recovery", "high availability", "load balanc"]) {
      expect(text, topic).toContain(topic);
    }
  });

  it("never requires every programme: the entrepreneur pathway needs one elective, not all", () => {
    const e = PATHWAYS.find((p) => p.code === "digital-entrepreneur")!;
    expect(e.requiredProgrammes).toEqual(["biz"]);
    expect(e.electives).toMatchObject({ pick: 1 });
  });
});

describe("the validator catches bad curriculum", () => {
  it("accepts a sound module", () => {
    expect(moduleProblems(good, comps)).toEqual([]);
  });

  it.each([
    ["a vague outcome", { outcome: "Understand how TypeScript works and learn about types in general use." }, "vague"],
    ["a short outcome", { outcome: "Do TypeScript." }, "at least 60"],
    ["a level that disagrees with the id", { level: 2 as const }, "says level 1"],
    ["a malformed id", { id: "fswd-1-3" }, "id must look like"],
    ["an unknown competency", { competencies: ["nope"] }, "unknown competency"],
    ["no competency", { competencies: [] }, "at least one competency"],
    ["no evidence", { evidence: [] }, "evidence types"],
    ["unrealistic hours", { hours: 500 }, "hours must be"],
    ["a tiny capstone", { capstone: true, hours: 10 }, "at least 20 hours"],
    ["a self prerequisite", { prerequisites: ["FSWD-L1-M09"] }, "require itself"],
  ])("rejects %s", (_name, patch, message) => {
    expect(moduleProblems({ ...good, ...patch } as ModuleSpec, comps).join("\n")).toContain(message);
  });

  it("keeps cloud work in labs the learner owns, at a bounded cost", () => {
    const cloud: ModuleSpec = { ...good, id: "CLOUD-L2-M09", rubric: "CLOUD_INFRA", competencies: ["typescript"] };
    const open = { ...cloud, outcome: "Configure a production server for the company you work for and open every port so that the team can deploy to it directly." };
    expect(moduleProblems(open, comps).join("\n")).toContain("lab, virtual machine, free-tier or budget-capped");
    const theirs = { ...cloud, outcome: "Log in to a client's live server over SSH in a lab and change its firewall rules so that the team can deploy to it directly." };
    expect(moduleProblems(theirs, comps).join("\n")).toContain("do not own");
    const fine = { ...cloud, outcome: "Configure the firewall and SSH on a server in your own virtual machine so that only key sign-in works, and show each rule." };
    expect(moduleProblems(fine, comps).join("\n")).not.toMatch(/cloud outcome|do not own/);
  });

  it("protects the safety rules: photography needs the learner's own photos, security stays in authorised labs", () => {
    const photo: ModuleSpec = { ...good, id: "PHOTO-L1-M09", rubric: "PHOTO", evidence: ["DOCUMENT"], competencies: ["typescript"] };
    expect(moduleProblems(photo, comps).join("\n")).toContain("own PHOTO evidence");
    const sec: ModuleSpec = { ...good, id: "SEC-L2-M09", rubric: "SECURITY", outcome: "Scan a company website you found online for vulnerabilities and write up everything you find in a report." };
    const problems = moduleProblems(sec, comps).join("\n");
    expect(problems).toContain("authorised environment");
    const labbed: ModuleSpec = { ...sec, outcome: "Scan an intentionally vulnerable application in your own lab for vulnerabilities and write up the verified findings in a report." };
    expect(moduleProblems(labbed, comps).join("\n")).not.toContain("authorised environment");
  });
});
