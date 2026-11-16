/**
 * Plain-language description and outcomes for each programme shown during onboarding. Outcomes describe what the learner will
 * be able to do after the published missions, never a promise of professional competency. Keyed by the stable department code;
 * the real list of programmes (and whether one has published missions) always comes from the database.
 */
export type ProgrammeInfo = { description: string; outcomes: string[] };

export const PROGRAMME_INFO: Record<string, ProgrammeInfo> = {
  fswd: { description: "Build web applications from the page in the browser to the server and database behind it.", outcomes: ["Build and publish a working web page", "Understand how the front end, back end and database fit together", "Ship a small project you can show"] },
  uxui: { description: "Design interfaces people can understand and use, from research to a tested prototype.", outcomes: ["Understand users and their problems", "Sketch, prototype and test an interface", "Explain your design decisions"] },
  sec: { description: "Learn how systems are attacked and defended, with safe, authorised practice only.", outcomes: ["Understand common weaknesses and how they are fixed", "Practise safely in lab environments you are allowed to test", "Write a clear security finding"] },
  cloud: { description: "Understand cloud computing and how applications are deployed and run on it.", outcomes: ["Explain core cloud services", "Deploy a simple application", "Reason about cost, reliability and security"] },
  sysadmin: { description: "Set up, secure and look after servers and the systems that run on them.", outcomes: ["Work confidently on a Linux server", "Manage users, services and updates", "Read logs and troubleshoot simple faults"] },
  ai: { description: "Use AI tools and automation to build useful workflows, with their limits understood.", outcomes: ["Use AI tools responsibly and check their output", "Automate a repetitive task", "Explain what AI can and cannot do"] },
  photo: { description: "Learn to see light, compose well and edit photographs with intent.", outcomes: ["Control exposure, focus and composition", "Edit a set of photographs consistently", "Present a small portfolio"] },
  video: { description: "Plan, shoot and edit video that tells a clear story.", outcomes: ["Plan a short video", "Edit with clean cuts, sound and titles", "Export and share a finished piece"] },
  biz: { description: "Build the business and career skills that turn your work into opportunities.", outcomes: ["Describe your offer and who it is for", "Present your work professionally", "Plan your next career steps"] },
};

export const infoFor = (code: string): ProgrammeInfo => PROGRAMME_INFO[code] ?? { description: "", outcomes: [] };
