import type { PathwaySpec } from "./types";

/**
 * Predefined multi-programme pathways. A pathway names what to complete and the capability it leads to; the module list and the
 * recommended sequence are DERIVED from the programmes (see pathwayModules and pathwaySequence in index.ts), so a shared module
 * is taught once. Learners are never required to take every programme, and can combine programmes freely instead of using a pathway.
 */
export const PATHWAYS: PathwaySpec[] = [
  {
    code: "full-stack-engineer",
    name: "Full-Stack Engineer",
    targetOutcome: "Deliver a secure, tested, deployed full-stack web application and maintain a WordPress client site.",
    requiredProgrammes: ["fswd"],
    optionalProgrammes: ["uxui", "sec", "ai", "biz", "cloud"],
    requiredLevels: { fswd: 4 },
    capstones: ["FSWD-L4-M01"],
    competencyRequirements: ["fswd:fullstack-delivery", "fswd:authentication", "fswd:web-security", "fswd:testing", "fswd:deployment", "fswd:database-design"],
  },
  {
    code: "cybersecurity-specialist",
    name: "Cybersecurity Specialist",
    targetOutcome: "Carry out a scoped security assessment, investigate and contain an incident, and report risk clearly, always within authorised scope.",
    requiredProgrammes: ["sec", "fswd"],
    optionalProgrammes: ["ai", "biz", "cloud"],
    requiredLevels: { sec: 4, fswd: 2 },
    capstones: ["SEC-L4-M01", "SEC-L4-M02"],
    competencyRequirements: ["sec:security-assessment-delivery", "sec:incident-response", "sec:log-analysis-siem", "sec:security-ethics", "sec:secure-coding", "fswd:node-rest-api"],
  },
  {
    code: "ai-automation-engineer",
    name: "AI Automation Engineer",
    targetOutcome: "Build, secure, deploy and operate AI applications and automated business workflows with human approval and cost control.",
    requiredProgrammes: ["ai", "fswd"],
    optionalProgrammes: ["sec", "biz", "cloud"],
    requiredLevels: { ai: 4, fswd: 2 },
    capstones: ["AI-L4-M01", "AI-L4-M02"],
    competencyRequirements: ["ai:ai-deployment", "ai:business-automation", "ai:ai-security", "ai:human-approval", "ai:ai-evaluation", "fswd:nextjs-app"],
  },
  {
    code: "digital-product-designer",
    name: "Digital Product Designer",
    targetOutcome: "Take a product from research to a tested, documented design system and hand it to developers, with a case-study portfolio.",
    requiredProgrammes: ["uxui", "gfx", "fswd"],
    optionalProgrammes: ["biz", "ai"],
    requiredLevels: { uxui: 4, gfx: 2, fswd: 1 },
    capstones: ["UXUI-L4-M01"],
    competencyRequirements: ["uxui:product-design-delivery", "uxui:design-systems", "uxui:usability-testing", "uxui:dev-handoff", "uxui:case-study", "gfx:logo-design"],
  },
  {
    code: "digital-content-creator",
    name: "Digital Content Creator",
    targetOutcome: "Produce professional photography, video and branded graphics for clients, and run the work as a small business.",
    requiredProgrammes: ["photo", "video", "gfx", "biz"],
    optionalProgrammes: ["ai", "uxui"],
    requiredLevels: { photo: 3, video: 4, gfx: 2, biz: 2 },
    capstones: ["VIDEO-L4-M01"],
    competencyRequirements: ["video:commercial-video", "photo:commercial", "photo:client-management", "gfx:client-brief", "biz:pricing"],
  },
  {
    code: "digital-entrepreneur",
    name: "Digital Entrepreneur",
    targetOutcome: "Launch a real venture with paying customers, supported by one digital skill you can deliver yourself.",
    requiredProgrammes: ["biz"],
    optionalProgrammes: ["fswd", "gfx", "photo", "video", "ai", "uxui", "cloud"],
    requiredLevels: { biz: 4 },
    electives: { pick: 1, from: ["fswd", "gfx", "photo", "video", "ai", "uxui", "cloud"], level: 2 },
    capstones: ["BIZ-L4-M01"],
    competencyRequirements: ["biz:venture-launch", "biz:business-pilot", "biz:pricing", "biz:cash-flow", "biz:legal-awareness"],
  },
  {
    code: "cloud-devops-engineer",
    name: "Cloud and DevOps Engineer",
    targetOutcome: "Design, secure, deploy and operate resilient cloud infrastructure as code, and deliver applications to it through a tested pipeline, in authorised lab environments.",
    requiredProgrammes: ["cloud", "fswd"],
    optionalProgrammes: ["sec", "ai", "biz"],
    requiredLevels: { cloud: 4, fswd: 2 },
    capstones: ["CLOUD-L4-M08", "CLOUD-L4-M09"],
    competencyRequirements: ["cloud:production-platform", "cloud:infrastructure-as-code", "cloud:ci-cd", "cloud:server-hardening", "cloud:disaster-recovery", "cloud:observability", "fswd:node-rest-api"],
  },
];
