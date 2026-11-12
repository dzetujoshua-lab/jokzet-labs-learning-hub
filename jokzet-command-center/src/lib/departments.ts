/**
 * Static definition of the nine learning departments and the weekly schedule.
 * The database seed (Phase 4/6) is built from these codes, so they are stable identifiers.
 */
export const DEPARTMENTS = [
  { code: "fswd", name: "Full-stack Development", short: "Full-stack", icon: "Code2", color: "#5b8cff" },
  { code: "uxui", name: "UI/UX Design", short: "UI/UX", icon: "PenTool", color: "#b184ff" },
  { code: "sec", name: "Ethical Hacking and Cybersecurity", short: "Cybersecurity", icon: "ShieldAlert", color: "#f0705f" },
  { code: "cloud", name: "Cloud Computing", short: "Cloud", icon: "Cloud", color: "#4cc3e8" },
  { code: "sysadmin", name: "Server and Systems Administration", short: "Systems", icon: "Server", color: "#4cc9a8" },
  { code: "ai", name: "AI Engineering and Automation", short: "AI", icon: "BrainCircuit", color: "#e279d6" },
  { code: "photo", name: "Photography", short: "Photography", icon: "Camera", color: "#f2b84b" },
  { code: "video", name: "Video Editing and Production", short: "Video", icon: "Clapperboard", color: "#ef7aa0" },
  { code: "biz", name: "Business and Career Development", short: "Business", icon: "Briefcase", color: "#8fa3bf" },
] as const;

export type DepartmentCode = (typeof DEPARTMENTS)[number]["code"];

/** Day of week (0 = Sunday) → focus. Programme runs in Africa/Accra. */
export const WEEKLY_SCHEDULE: Record<number, { label: string; departments: DepartmentCode[] }> = {
  1: { label: "Full-stack Development", departments: ["fswd"] },
  2: { label: "UI/UX Design", departments: ["uxui"] },
  3: { label: "Ethical Hacking and Cybersecurity", departments: ["sec"] },
  4: { label: "Cloud Computing and Server Administration", departments: ["cloud", "sysadmin"] },
  5: { label: "AI Engineering, Automation, Business and Career", departments: ["ai", "biz"] },
  6: { label: "Photography and Video Production", departments: ["photo", "video"] },
  0: { label: "Assessment, review, corrections and portfolio planning", departments: [] },
};

export const PROGRAMME_START = "2026-11-16";
export const PROGRAMME_TIMEZONE = "Africa/Accra";
export const DEFAULT_REMINDER_TIME = "12:00";
