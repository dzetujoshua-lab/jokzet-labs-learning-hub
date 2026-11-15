import { mod, type SharedSpec } from "./types";

/**
 * Shared core: modules that several programmes depend on, so a learner who has demonstrated one never repeats it.
 * A programme lists these as prerequisites instead of re-teaching them.
 */
export const SHARED: SharedSpec = {
  code: "sh",
  name: "Shared core",
  competencies: {
    "digital-fundamentals": "Explain how computers, files, networks and the web work, and use them safely.",
    "digital-safety": "Protect accounts and files, back up work, and communicate professionally online.",
    "design-principles": "Apply hierarchy, contrast, alignment, repetition and proximity to improve a layout.",
    "web-foundations": "Build a semantic, responsive, interactive page with HTML, CSS and JavaScript.",
    "accessibility-basics": "Check a page or design against core accessibility requirements and fix what fails.",
    "version-control": "Track, share and recover work with Git and GitHub.",
    "python-basics": "Write small, correct Python programs that read input, make decisions and use files.",
    "api-basics": "Call a web API, read JSON, handle errors and keep keys out of code.",
    "command-line": "Work confidently in a Linux command line: files, permissions, processes and pipes.",
    "type-and-colour": "Choose and combine typefaces and colours for a stated purpose and audience.",
    "visual-composition": "Compose an image or frame so the subject, balance and flow are deliberate.",
    "networks-basics": "Explain IP addresses, ports, DNS and routing, and trace how a request travels from a device to a server.",
    "freelance-business": "Price work, agree scope in writing, invoice, and manage a client from brief to delivery.",
  },
  modules: [
    mod("SH-L0-M01", 0, "Computer and internet fundamentals", "Explain, using your own diagram, what happens between typing an address in a browser and seeing a page, and organise a project folder correctly.", 8, [], ["digital-fundamentals"], ["DOCUMENT", "SCREENSHOT"], "WEB"),
    mod("SH-L0-M02", 0, "Digital safety and professional workflow", "Set up a password manager and two-step sign-in, create an encrypted-backup routine for your files, and write a professional email and a clear file naming scheme.", 6, [], ["digital-safety"], ["SCREENSHOT", "DOCUMENT"], "WEB"),
    mod("SH-L0-M03", 0, "Design principles in practice", "Redesign a poor flyer or screen so that hierarchy, contrast, alignment and spacing are fixed, and annotate each change with the principle behind it.", 8, [], ["design-principles"], ["DESIGN_FILE", "DOCUMENT"], "GRAPHIC"),
    mod("SH-L0-M04", 0, "How networks, IP addresses and DNS work", "Look up the DNS records and route to a public website, then draw a labelled diagram of how a request travels from your device through your router, DNS and the internet to a server and back.", 8, ["SH-L0-M01"], ["networks-basics"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("SH-L1-M01", 1, "HTML5 and semantic structure", "Build a multi-page site with correct headings, landmarks, links, images with alternative text, and a validated form.", 14, ["SH-L0-M01"], ["web-foundations"], ["REPOSITORY", "SCREENSHOT"], "WEB"),
    mod("SH-L1-M02", 1, "CSS layout and responsive design", "Style a multi-section page with Flexbox and Grid so it stays readable at 360, 768 and 1280 pixels wide, without horizontal scrolling.", 18, ["SH-L1-M01"], ["web-foundations"], ["REPOSITORY", "SCREENSHOT", "LIVE_SITE"], "WEB"),
    mod("SH-L1-M03", 1, "JavaScript fundamentals and the DOM", "Build an interactive page (for example a task list or quiz) with events, state and DOM updates, saving data in the browser.", 24, ["SH-L1-M02"], ["web-foundations"], ["REPOSITORY", "LIVE_SITE"], "WEB"),
    mod("SH-L1-M04", 1, "Accessibility essentials", "Audit a page or screen with a checklist and a screen reader or keyboard-only pass, then fix at least five real problems and show before and after.", 10, ["SH-L1-M01"], ["accessibility-basics"], ["DOCUMENT", "SCREENSHOT"], "WEB"),
    mod("SH-L1-M05", 1, "Git and GitHub essentials", "Create a repository, make meaningful commits on a branch, open and merge a pull request, and recover a deleted file from history.", 8, ["SH-L0-M01"], ["version-control"], ["REPOSITORY", "SCREENSHOT"], "WEB"),
    mod("SH-L1-M06", 1, "Python fundamentals", "Write three small programs (a calculator, a file summariser and a text-based game) with functions, loops, conditions and tests of your own.", 24, ["SH-L0-M01"], ["python-basics"], ["REPOSITORY", "CODE"], "WEB"),
    mod("SH-L1-M07", 1, "Linux command line", "Complete a set of file, permission and process tasks in a Linux shell and record them as a reusable script with comments.", 12, ["SH-L0-M01"], ["command-line"], ["CODE", "SCREENSHOT"], "SECURITY"),
    mod("SH-L1-M08", 1, "Typography and colour theory", "Create a two-page style guide that justifies the chosen typefaces, type scale and colour palette (with contrast ratios) for a named audience.", 12, ["SH-L0-M03"], ["type-and-colour"], ["DESIGN_FILE", "DOCUMENT"], "GRAPHIC"),
    mod("SH-L1-M09", 1, "Visual composition and storytelling", "Plan and produce a six-frame visual story (photos, illustrations or storyboard) using deliberate framing, balance and sequence, with a one-page rationale.", 12, ["SH-L0-M03"], ["visual-composition"], ["PHOTO", "DESIGN_FILE", "DOCUMENT"], "PHOTO"),
    mod("SH-L2-M01", 2, "APIs and JSON", "Build a small app that calls a public API, handles failures and rate limits, and keeps its key out of the source code, with a README that shows how to run it.", 18, ["SH-L1-M03", "SH-L1-M06"], ["api-basics"], ["REPOSITORY", "LIVE_SITE"], "WEB"),
    mod("SH-L2-M02", 2, "Freelance business essentials", "Write a scope of work, a price quote with your costs shown, an invoice and a client handover note for one real or realistic job in your field.", 12, ["SH-L0-M02"], ["freelance-business"], ["DOCUMENT"], "BUSINESS"),
  ],
};
