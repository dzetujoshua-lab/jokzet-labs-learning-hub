import type { MissionDraft } from "./types";

/**
 * Shared core, Level 0: the missions under SH-L0-M01 and SH-L0-M02. They are written once and are prerequisites of several
 * programmes, so a learner who has done them never repeats them. Codes use the SH prefix. Every WATCH entry is a curator brief;
 * no resource is named or approved.
 */
export const SHARED_L0: MissionDraft[] = [
  // ───────────── SH-L0-M01 Computer and internet fundamentals ─────────────
  {
    code: "SH-L0-01", moduleId: "SH-L0-M01", title: "Inside your computer: parts, files and folders", status: "DRAFT",
    objective: "Name the main parts of your computer and what each does, check your own device's specifications, and organise a project folder with a clear naming scheme.",
    minutes: 150, kind: "STUDY", evidence: "DOCUMENT", xp: 60, tools: ["Your own computer or phone", "Any word processor or notes app (free)"],
    competencies: ["digital-fundamentals"],
    watch: {
      minutes: 25,
      brief: "A short explanation of the processor, memory, storage and operating system of a computer, and how files and folders are organised, using everyday examples.",
      mustShow: ["The difference between memory and storage with an everyday example", "What an operating system does and one example of each common kind", "How files, folders and file extensions work and why naming matters"],
    },
    doSteps: [
      "Find your device's processor, memory size, storage size and operating system in its settings and write them down.",
      "Draw a simple picture of the parts and write one sentence on what each part does for you when you open a photo.",
      "Create a folder called projects with three sub-folders named for different topics, and use a naming scheme for files that includes a date and a short description.",
      "List the file extensions of five files on your device and say what program opens each and what kind of information it holds.",
    ],
    experiment: "Open as many programs as you can at once and watch what the computer does with its memory and speed. Explain what you saw using the difference between memory and storage.",
    show: "Submit one document with your specifications, your picture and explanations, a screenshot of your folder structure with example file names, and your experiment notes.",
    verification: [
      "The specifications match the device and include processor, memory, storage and operating system.",
      "Memory and storage are correctly distinguished in the explanations.",
      "The screenshot shows a folder structure with a consistent, dated naming scheme.",
      "Five file extensions are paired with the right program and content type.",
    ],
    remediation: "Correct the explanation the assessor marked as mixed up, fix the folder names so they follow one scheme, and resubmit.",
    rubric: [
      { criterion: "Functional correctness", description: "The specifications, parts and file types are correct and match the learner's own device.", points: 40 },
      { criterion: "Maintainability", description: "The folder structure and file names are consistent and easy for another person to follow.", points: 20 },
      { criterion: "Explanation", description: "Explanations are in the learner's own words and use everyday examples correctly.", points: 40 },
    ],
  },
  {
    code: "SH-L0-02", moduleId: "SH-L0-M01", title: "How the web works: address, browser, server and page", status: "DRAFT",
    objective: "Explain with your own labelled diagram how an address, a browser and a server work together to show a page, and read the parts of a real web address.",
    minutes: 150, kind: "STUDY", evidence: "DOCUMENT", xp: 60, tools: ["Web browser", "Pen and paper or a free diagramming tool"],
    competencies: ["digital-fundamentals"],
    watch: {
      minutes: 25,
      brief: "A plain-language explanation of what happens between typing a web address and seeing a page, using an everyday comparison.",
      mustShow: ["The roles of the browser, the address, the domain name and the server", "The parts of a web address: protocol, domain and path", "Why a page loads over HTTPS and what the padlock means"],
    },
    doSteps: [
      "Pick three real web addresses and split each into protocol, domain name and path, writing what each part tells the browser.",
      "Open one of the pages, use the browser's view-source option, and find the page title and one heading in the source.",
      "Draw a labelled diagram of your device, the internet, a server and the page coming back, and write a two-sentence caption.",
      "Write what you would see if the server were switched off, and what you would see if your internet connection were off.",
    ],
    experiment: "Change one part of a real address (for example a path that does not exist) and open it. Predict what will appear before you try, then explain the result using what you learned.",
    show: "Submit one document with your three address breakdowns, what you found in the page source, your diagram with caption, your two failure descriptions and your experiment result.",
    verification: [
      "Three addresses are correctly split into protocol, domain and path.",
      "The page source evidence names a real title and heading from the page.",
      "The diagram shows the browser, the address lookup, the server and the returning page.",
      "The failure descriptions correctly distinguish a server problem from a connection problem.",
    ],
    remediation: "Correct the address parts or the diagram step the assessor marked, and resubmit with the fix explained.",
    rubric: [
      { criterion: "Functional correctness", description: "Address parts, the page source finding and the diagram are correct.", points: 40 },
      { criterion: "Explanation", description: "The learner explains each step in their own words, including the failure cases.", points: 40 },
      { criterion: "Evidence", description: "Examples come from real addresses and a real page source.", points: 20 },
    ],
  },

  // ───────────── SH-L0-M02 Digital safety and professional workflow ─────────────
  {
    code: "SH-L0-03", moduleId: "SH-L0-M02", title: "Secure your accounts", status: "DRAFT",
    objective: "Set up a password manager and two-step sign-in on your main email, and show that you can recover your account safely.",
    minutes: 120, kind: "DRILL", evidence: "SCREENSHOT", xp: 50, tools: ["A free password manager", "Your own email account", "A phone for two-step sign-in"],
    competencies: ["digital-safety"],
    watch: {
      minutes: 20,
      brief: "A short explanation of why unique passwords and two-step sign-in matter, and a demonstration of setting up a password manager and two-step sign-in.",
      mustShow: ["Why reusing one password is dangerous with a realistic example", "Creating a strong unique password with a password manager", "Turning on two-step sign-in and storing recovery options safely"],
    },
    doSteps: [
      "Install a free password manager and protect it with a long passphrase that you have not used anywhere else.",
      "Change the passwords for your email and two other accounts to unique generated passwords and store them in the manager.",
      "Turn on two-step sign-in for your email and check that your recovery phone number and recovery email are current.",
      "Write a short list of five signs of a phishing message and check your last ten messages for any of them.",
    ],
    experiment: "Ask a friend to send you three messages, two genuine and one fake that imitates a service, and decide which is fake before they tell you. Record the clues you used.",
    show: "Submit screenshots showing the manager set up (with all passwords hidden), two-step sign-in turned on, and your recovery settings, plus your phishing signs and your friend test result. Never include a password, code or recovery key.",
    verification: [
      "Screenshots show a password manager with entries but no visible passwords.",
      "A screenshot shows two-step sign-in enabled on the email account.",
      "Five distinct phishing signs are listed in the learner's own words.",
      "No password, recovery code or private key appears anywhere in the submission.",
    ],
    remediation: "Remove any screenshot that reveals a secret, change that secret immediately, and resubmit a safe screenshot.",
    rubric: [
      { criterion: "Functional correctness", description: "The manager and two-step sign-in are set up and shown working.", points: 35 },
      { criterion: "Security", description: "Passwords are unique, nothing secret is shown and recovery options are current.", points: 35 },
      { criterion: "Explanation", description: "The phishing signs and the friend test are explained clearly.", points: 30 },
    ],
  },
  {
    code: "SH-L0-04", moduleId: "SH-L0-M02", title: "Back up your work and write a professional message", status: "DRAFT",
    objective: "Make an encrypted backup of a project folder, restore one file from it, and write a professional email request with a clear subject and file naming.",
    minutes: 120, kind: "BUILD", evidence: "DOCUMENT", xp: 50, tools: ["A second storage location (external drive or cloud folder)", "A free tool that can encrypt a backup", "Any email or word processor"],
    competencies: ["digital-safety"],
    watch: {
      minutes: 20,
      brief: "A short explanation of the three-copies backup rule and a demonstration of making an encrypted backup and restoring a file from it.",
      mustShow: ["Keeping more than one copy of important work in more than one place", "Encrypting a backup and why the passphrase must be stored safely", "Restoring a single file to prove the backup works"],
    },
    doSteps: [
      "Choose your project folder and copy it to a second location, encrypting the copy with a passphrase you store in your password manager.",
      "Delete a copy of one file from your working folder and restore it from the backup, confirming the content is unchanged.",
      "Write a schedule saying how often you will back up, where the copies live and who could recover them if you were unavailable.",
      "Write a professional email asking someone for feedback on your work, with a clear subject line, a short body, a named attachment and a polite close.",
    ],
    experiment: "Time how long a full backup and restore of your folder takes, and decide whether your schedule is realistic. Change it if it is not and say why.",
    show: "Submit a document with a screenshot of the encrypted backup and the restored file, your backup schedule, your email text, and your timing note. Do not include your passphrase.",
    verification: [
      "The backup is in a second location and is encrypted.",
      "A restored file is shown with matching content.",
      "The email has a clear subject, a short purpose, a named attachment and a polite close.",
      "The passphrase and other secrets are not included in the submission.",
    ],
    remediation: "Repeat the restore step until a file is recovered, fix the missing part of the email, and resubmit.",
    rubric: [
      { criterion: "Functional correctness", description: "The backup is made, encrypted and a file is restored correctly.", points: 35 },
      { criterion: "Security", description: "The backup is encrypted and no secret appears in the submission.", points: 25 },
      { criterion: "Maintainability", description: "The schedule and file naming make the work easy to find and recover.", points: 20 },
      { criterion: "Explanation", description: "The email and the timing note are clear and professional.", points: 20 },
    ],
  },
];
