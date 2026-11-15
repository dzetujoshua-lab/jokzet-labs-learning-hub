import type { RubricFamily } from "./types";

/**
 * What the Assessment Engine can actually inspect. A criterion lists the capabilities that can judge it; if none of them exists
 * yet, or the judgement is subjective, a person must score it. The AI is never asked to judge evidence it cannot inspect.
 */
export const CAPABILITIES = [
  "DOCUMENT_TEXT", // read submitted writing and structured documents
  "FILE_INSPECTION", // check type, size, structure and metadata of an uploaded file
  "GITHUB_REPOSITORY", // fetch and read a repository through the GitHub API
  "LIVE_SITE_BROWSER", // load an accessible public site in an isolated browser and observe it
  "IMAGE_VISION", // analyse screenshots and images with a vision-capable model
  "SANDBOX_EXECUTION", // run submitted code in an isolated environment and test it
  "MEDIA_ANALYSIS", // sample frames and audio from video and audio files (not built yet)
  "INFRASTRUCTURE_PROBE", // read-only HTTP, TLS and port checks against a lab address the learner has registered as their own (not built yet)
  "HUMAN", // a reviewer must judge this criterion
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export type RubricCriterionSpec = {
  name: string;
  description: string;
  weight: number;
  /** Any one of these is enough to judge the criterion. HUMAN alone means the AI must not score it. */
  inspect: Capability[];
};

export type RubricFamilySpec = {
  family: RubricFamily;
  name: string;
  criteria: RubricCriterionSpec[];
  /** A criterion that fails this gate caps the result at NEEDS_IMPROVEMENT whatever the total, and sends it to a person. */
  gate?: string;
};

const c = (name: string, description: string, weight: number, ...inspect: Capability[]): RubricCriterionSpec => ({ name, description, weight, inspect });

export const RUBRICS: RubricFamilySpec[] = [
  {
    family: "WEB",
    name: "Web and software development",
    criteria: [
      c("Functional correctness", "Every stated requirement works, including error cases.", 25, "SANDBOX_EXECUTION", "LIVE_SITE_BROWSER"),
      c("Code quality", "Clear structure, naming and no dead or duplicated code.", 20, "GITHUB_REPOSITORY", "SANDBOX_EXECUTION"),
      c("Responsiveness", "Usable and unbroken at phone, tablet and desktop widths.", 15, "LIVE_SITE_BROWSER", "IMAGE_VISION"),
      c("Accessibility", "Meets the stated accessibility checks (labels, contrast, keyboard, headings).", 15, "LIVE_SITE_BROWSER", "GITHUB_REPOSITORY"),
      c("Security", "No secrets in code, validated input, correct access control.", 15, "GITHUB_REPOSITORY", "SANDBOX_EXECUTION"),
      c("Maintainability", "README, tests and commit history that another developer could continue from.", 10, "GITHUB_REPOSITORY"),
    ],
  },
  {
    family: "UXUI",
    name: "UI/UX design",
    criteria: [
      c("Usability", "A new user can complete the stated tasks without help.", 25, "HUMAN"),
      c("Visual hierarchy", "Attention is directed to the right things in the right order.", 20, "IMAGE_VISION"),
      c("Consistency", "Components, spacing, type and colour follow one system.", 15, "IMAGE_VISION"),
      c("Accessibility", "Contrast, target size, focus order and text scaling are addressed.", 15, "IMAGE_VISION", "DOCUMENT_TEXT"),
      c("Design reasoning", "Decisions are explained and linked to research evidence.", 15, "DOCUMENT_TEXT"),
      c("Prototype functionality", "The prototype supports the stated flows without dead ends.", 10, "HUMAN", "IMAGE_VISION"),
    ],
  },
  {
    family: "SECURITY",
    name: "Cybersecurity and ethical hacking",
    gate: "Scope compliance: any evidence of testing outside the written scope or on a system the learner does not own or have permission to test fails the submission and goes to a person.",
    criteria: [
      c("Technical accuracy", "Findings and explanations are technically correct.", 25, "DOCUMENT_TEXT", "HUMAN"),
      c("Scope compliance", "All work stays inside the written scope and the authorised environment.", 20, "DOCUMENT_TEXT", "IMAGE_VISION"),
      c("Evidence", "Each finding is supported by reproducible evidence.", 15, "IMAGE_VISION", "DOCUMENT_TEXT"),
      c("Risk identification", "Risks are correctly rated with stated reasoning.", 15, "DOCUMENT_TEXT", "HUMAN"),
      c("Remediation quality", "Fixes are specific, correct and verified.", 15, "DOCUMENT_TEXT", "GITHUB_REPOSITORY", "HUMAN"),
      c("Professional ethics", "Responsible handling of data, disclosure and limits of the work.", 10, "DOCUMENT_TEXT"),
    ],
  },
  {
    family: "PHOTO",
    name: "Photography",
    criteria: [
      c("Exposure", "Correct or deliberately chosen exposure; no accidental clipping.", 20, "IMAGE_VISION", "FILE_INSPECTION"),
      c("Focus", "Critical focus is sharp where intended.", 20, "IMAGE_VISION"),
      c("Composition", "Framing, balance and flow are deliberate.", 25, "IMAGE_VISION", "HUMAN"),
      c("Lighting", "Light quality and direction suit the subject and intent.", 20, "IMAGE_VISION", "HUMAN"),
      c("Creative execution", "The intention is clear and the result is distinctive.", 15, "HUMAN"),
    ],
  },
  {
    family: "VIDEO",
    name: "Video editing and production",
    criteria: [
      c("Storytelling", "A viewer can state the point of the piece.", 25, "HUMAN"),
      c("Editing", "Cuts, pacing and continuity serve the story.", 20, "MEDIA_ANALYSIS", "HUMAN"),
      c("Audio quality", "Dialogue is clear, levels are consistent, no distortion or noise.", 20, "MEDIA_ANALYSIS", "HUMAN"),
      c("Colour", "Shots match and the look is deliberate.", 15, "MEDIA_ANALYSIS", "IMAGE_VISION"),
      c("Technical delivery", "Correct format, resolution, frame rate, captions and file size.", 20, "FILE_INSPECTION"),
    ],
  },
  {
    family: "GRAPHIC",
    name: "Graphic design",
    criteria: [
      c("Visual communication", "The message and call to action are clear to the audience.", 25, "IMAGE_VISION", "HUMAN"),
      c("Typography", "Type choices, hierarchy and spacing are correct and readable.", 20, "IMAGE_VISION"),
      c("Composition", "Layout, grid and balance guide the eye.", 20, "IMAGE_VISION"),
      c("Brand consistency", "Elements follow the stated brand rules.", 15, "IMAGE_VISION", "DOCUMENT_TEXT"),
      c("Technical execution", "Clean files: vector, resolution, colour mode, bleed and export are correct.", 20, "FILE_INSPECTION"),
    ],
  },
  {
    family: "AI_AUTOMATION",
    name: "AI and automation",
    criteria: [
      c("Functional correctness", "The application or workflow does what the brief says on a test set.", 25, "SANDBOX_EXECUTION", "LIVE_SITE_BROWSER"),
      c("Reliability", "Behaves correctly under failures, retries and bad input.", 20, "SANDBOX_EXECUTION", "GITHUB_REPOSITORY"),
      c("Integration quality", "Services, credentials and data flows are connected correctly.", 15, "GITHUB_REPOSITORY", "DOCUMENT_TEXT"),
      c("Security", "No exposed keys, prompt-injection and data-leak defences are tested.", 20, "GITHUB_REPOSITORY", "SANDBOX_EXECUTION"),
      c("Error handling", "Failures are caught, logged and reported without corrupting results.", 10, "GITHUB_REPOSITORY", "SANDBOX_EXECUTION"),
      c("Documentation", "Someone else can run, test and operate it from the README.", 10, "GITHUB_REPOSITORY", "DOCUMENT_TEXT"),
    ],
  },
  {
    family: "CLOUD_INFRA",
    name: "Cloud computing and server administration",
    gate: "Authorised target: a probe or check may only be run against a lab address the learner registered as their own. Any evidence of work on a server the learner does not own or is not authorised to administer fails the submission and goes to a person.",
    criteria: [
      c("Deployment correctness", "The service is reachable and behaves as the brief says, including the failure and restart cases.", 25, "INFRASTRUCTURE_PROBE", "LIVE_SITE_BROWSER", "DOCUMENT_TEXT"),
      c("Server security", "Firewall, SSH, accounts, updates, TLS and exposed services follow the stated hardening checklist.", 20, "INFRASTRUCTURE_PROBE", "DOCUMENT_TEXT", "GITHUB_REPOSITORY"),
      c("Reliability", "Backups, restores, monitoring and recovery were demonstrated, not only configured.", 15, "DOCUMENT_TEXT", "INFRASTRUCTURE_PROBE", "HUMAN"),
      c("Configuration", "Configuration is correct, minimal, repeatable and kept in version control where required.", 15, "GITHUB_REPOSITORY", "DOCUMENT_TEXT"),
      c("Troubleshooting", "Faults are diagnosed from evidence (logs, metrics), the cause is stated and the fix is verified.", 15, "DOCUMENT_TEXT", "HUMAN"),
      c("Documentation", "A runbook lets another administrator rebuild, operate and recover the system.", 10, "DOCUMENT_TEXT", "GITHUB_REPOSITORY"),
    ],
  },
  {
    family: "BUSINESS",
    name: "Business and entrepreneurship",
    criteria: [
      c("Market reasoning", "Claims about the market and competitors are sourced and sound.", 25, "DOCUMENT_TEXT", "HUMAN"),
      c("Financial feasibility", "Numbers are consistent, assumptions are stated and the model can work.", 25, "DOCUMENT_TEXT"),
      c("Customer understanding", "Real customer evidence shapes the offer.", 20, "DOCUMENT_TEXT", "HUMAN"),
      c("Operational planning", "Steps, people, costs and risks are specific and realistic.", 15, "DOCUMENT_TEXT"),
      c("Execution quality", "The work is complete, clear and usable by its reader.", 15, "DOCUMENT_TEXT", "HUMAN"),
    ],
  },
];
