/**
 * Level 0 curriculum (draft for the learner's review). Practical-first: each mission follows
 * WATCH → DO → EXPERIMENT → SHOW → GET ASSESSED. No learning URLs are invented: every demonstration is a
 * placeholder resource with `url: null` until a real, verified link is supplied.
 */
export type MissionSpec = {
  code: string;
  title: string;
  objective: string;
  minutes: number;
  kind: string; // BUILD | DESIGN | DRILL | STUDY | SHOOT | EDIT | WRITE | SHIP
  evidence: string; // SCREENSHOT | PHOTO | VIDEO | CODE | DOCUMENT | LINK
  xp: number;
  tools: string[];
  skills: string[];
  watch: string[];
  doSteps: string[];
  experiment: string;
  show: string;
  remediation: string;
  rubric: [name: string, description: string, points: number][]; // points sum to 100
};

export type DepartmentSpec = {
  code: string;
  milestone: string;
  skills: [name: string, description: string][];
  missions: MissionSpec[];
};

export const PASSING_SCORE = 70;

export const LEVEL0: DepartmentSpec[] = [
  {
    code: "fswd",
    milestone: "Ship a small multi-page site with a working form, versioned in Git and live on the web.",
    skills: [
      ["HTML structure", "Write semantic, accessible page structure."],
      ["CSS layout", "Build responsive layouts with flexbox and grid."],
      ["Git basics", "Commit, branch and push work to a repository."],
      ["JavaScript DOM", "Read and change a page with JavaScript."],
    ],
    missions: [
      {
        code: "FSWD-L0-01", title: "Build a responsive profile page", minutes: 90, kind: "BUILD", evidence: "SCREENSHOT", xp: 40,
        objective: "Build a one-page personal profile in HTML and CSS that works on a phone and a laptop.",
        tools: ["Code editor", "Web browser", "Git"],
        skills: ["HTML structure", "CSS layout", "Git basics"],
        watch: ["Watch a demonstration of building a page from a blank file with semantic HTML, then styling it with flexbox."],
        doSteps: [
          "Create a repository and an index.html with a header, main section and footer.",
          "Add your name, a short bio and three links using semantic elements.",
          "Style the page with CSS so it is readable at 360px and 1280px wide.",
          "Commit your work with a clear message.",
        ],
        experiment: "Break the layout on purpose (remove a flex property, change a unit), predict what will happen, then confirm in the browser and explain why.",
        show: "Submit two screenshots (phone width and laptop width), the repository URL, and a 3-sentence explanation of your layout choices.",
        remediation: "Re-do the failing criterion: rebuild the section that broke at one screen size, then resubmit with the new screenshot.",
        rubric: [
          ["Semantic HTML", "Uses header, main, footer and heading levels correctly.", 25],
          ["Responsive layout", "Readable and unbroken at both screen widths.", 30],
          ["Version control", "Meaningful commits pushed to a repository.", 20],
          ["Explanation", "Explains layout decisions in your own words.", 25],
        ],
      },
      {
        code: "FSWD-L0-02", title: "Add a contact form with validation", minutes: 90, kind: "BUILD", evidence: "CODE", xp: 40,
        objective: "Add a form to your profile page that validates input in the browser and shows clear error messages.",
        tools: ["Code editor", "Web browser", "Git"],
        skills: ["HTML structure", "JavaScript DOM"],
        watch: ["Watch a demonstration of an accessible form with labels, required fields and JavaScript validation."],
        doSteps: [
          "Add a form with name, email and message fields, each with a visible label.",
          "Validate each field with JavaScript on submit and show an inline error message.",
          "Prevent submission when invalid and focus the first invalid field.",
          "Commit and push the change.",
        ],
        experiment: "Try to submit bad input in five different ways (empty, spaces only, very long, invalid email, pasted script text) and record what your form does.",
        show: "Submit the repository URL, a short screen recording or screenshots of an error state and a valid state, and your list of five test inputs with results.",
        remediation: "Fix any input your form accepted incorrectly, add a test row for it, and resubmit.",
        rubric: [
          ["Labelled fields", "Every field has a label and required fields are marked.", 20],
          ["Validation logic", "Rejects empty, invalid and oversized input.", 35],
          ["Error feedback", "Errors are clear, inline and focus moves to the first error.", 25],
          ["Testing notes", "Five inputs tested and results recorded honestly.", 20],
        ],
      },
    ],
  },
  {
    code: "uxui",
    milestone: "Present a three-screen mobile flow with a clear hierarchy, accessible contrast and a short rationale.",
    skills: [
      ["Visual hierarchy", "Guide the eye with size, weight and spacing."],
      ["Layout and spacing", "Use grids and consistent spacing."],
      ["Colour contrast", "Choose accessible colour pairs."],
      ["Wireframing", "Sketch screens quickly before styling."],
    ],
    missions: [
      {
        code: "UXUI-L0-01", title: "Wireframe a three-screen mobile flow", minutes: 75, kind: "DESIGN", evidence: "SCREENSHOT", xp: 35,
        objective: "Design low-fidelity wireframes for a simple task (for example, ordering from a market stall) across three screens.",
        tools: ["Design tool (any)", "Pen and paper"],
        skills: ["Wireframing", "Visual hierarchy"],
        watch: ["Watch a demonstration of turning a user task into three connected wireframe screens."],
        doSteps: [
          "Write the user goal in one sentence.",
          "Sketch the three screens on paper, then recreate them in your design tool using grey boxes only.",
          "Label the primary action on each screen.",
        ],
        experiment: "Show your wireframes to one person for 30 seconds, ask them what to tap first on each screen, and note where they hesitated.",
        show: "Submit images of the three wireframes, your one-sentence user goal and what the test person got wrong or right.",
        remediation: "Redraw the screen where the test person hesitated so the primary action is unmistakable, then resubmit.",
        rubric: [
          ["Clear user goal", "One specific user goal drives the flow.", 20],
          ["Flow coherence", "The three screens connect logically.", 30],
          ["Primary actions", "Each screen has one obvious primary action.", 30],
          ["Test insight", "Records real feedback and what it changed.", 20],
        ],
      },
      {
        code: "UXUI-L0-02", title: "Fix the hierarchy and contrast of a weak screen", minutes: 75, kind: "DESIGN", evidence: "SCREENSHOT", xp: 35,
        objective: "Take a cluttered screen and improve its hierarchy, spacing and colour contrast, proving each change.",
        tools: ["Design tool (any)", "Contrast checker"],
        skills: ["Visual hierarchy", "Colour contrast", "Layout and spacing"],
        watch: ["Watch a demonstration of a before-and-after redesign that fixes hierarchy and contrast."],
        doSteps: [
          "Pick one real app screen you find confusing and screenshot it.",
          "List three problems (hierarchy, spacing, contrast).",
          "Redesign the screen fixing each problem and check text contrast with a checker.",
        ],
        experiment: "Squint or blur the screen: can you still tell what matters most? Adjust until you can.",
        show: "Submit the before and after images, your three problems, and the contrast ratios you measured.",
        remediation: "Revisit any text pair below 4.5:1 contrast and fix it, then resubmit the measured ratios.",
        rubric: [
          ["Problem diagnosis", "Names three real problems on the original screen.", 25],
          ["Hierarchy", "The most important element stands out clearly.", 30],
          ["Contrast", "Body text meets 4.5:1 and the ratios are shown.", 30],
          ["Before and after", "Both versions shown side by side.", 15],
        ],
      },
    ],
  },
  {
    code: "sec",
    milestone: "Run a documented, fully legal scan and review of your own isolated lab and write up what you found.",
    skills: [
      ["Legal scope and ethics", "Only test systems you own or are authorised to test."],
      ["Lab setup", "Build an isolated practice environment."],
      ["Network basics", "Understand IP addresses, ports and services."],
      ["Reading logs", "Find evidence of activity in system logs."],
    ],
    missions: [
      {
        code: "SEC-L0-01", title: "Set up an isolated practice lab", minutes: 90, kind: "BUILD", evidence: "SCREENSHOT", xp: 40,
        objective: "Create a virtual lab on your own computer that is isolated from your real network, for safe practice.",
        tools: ["Virtualisation software", "Operating system image"],
        skills: ["Legal scope and ethics", "Lab setup"],
        watch: ["Watch a demonstration of creating a virtual machine on a host-only network."],
        doSteps: [
          "Write your lab rules: what you may test (only your own machines) and what you must never test.",
          "Install virtualisation software and create one virtual machine.",
          "Set its network to host-only or internal so it cannot reach the internet or other people's devices.",
          "Take a snapshot of the clean state.",
        ],
        experiment: "Try to reach the internet from the VM and confirm it cannot, then explain why this protects you.",
        show: "Submit screenshots of the VM network settings, the snapshot list, and your written lab rules.",
        remediation: "Correct the network mode so isolation is proven, then resubmit the failed-ping screenshot.",
        rubric: [
          ["Written rules", "States clear legal and ethical boundaries.", 30],
          ["Isolation", "Network mode proves the lab is isolated.", 35],
          ["Snapshot", "A clean snapshot exists for recovery.", 15],
          ["Explanation", "Explains why isolation matters.", 20],
        ],
      },
      {
        code: "SEC-L0-02", title: "Map your lab network and its open services", minutes: 75, kind: "DRILL", evidence: "DOCUMENT", xp: 35,
        objective: "Discover the machines and open ports inside your own isolated lab and document them.",
        tools: ["Your isolated lab", "Network scanner (installed in the lab)"],
        skills: ["Network basics", "Reading logs"],
        watch: ["Watch a demonstration of listing devices and open ports inside a private lab network."],
        doSteps: [
          "Confirm you are scanning only your own lab addresses.",
          "Run a scan to list the hosts and open ports.",
          "For each open port, write which service it is and whether it needs to be open.",
        ],
        experiment: "Start or stop one service in the VM and re-scan to see the result change.",
        show: "Submit a one-page report: scope statement, scan output excerpt, a table of ports and services, and one recommendation.",
        remediation: "Add the missing scope statement or the services you did not explain, then resubmit.",
        rubric: [
          ["Scope statement", "Confirms only own lab addresses were scanned.", 30],
          ["Findings table", "Ports, services and need are recorded accurately.", 35],
          ["Experiment", "Shows the effect of changing a service.", 20],
          ["Recommendation", "Gives a sensible, specific recommendation.", 15],
        ],
      },
    ],
  },
  {
    code: "cloud",
    milestone: "Launch, secure and then delete a small cloud server while keeping spending under control.",
    skills: [
      ["Cloud concepts", "Explain regions, instances and storage in plain words."],
      ["Identity and access", "Use MFA and least-privilege access."],
      ["Compute instances", "Launch and connect to a virtual machine."],
      ["Cost control", "Set budgets and shut down unused resources."],
    ],
    missions: [
      {
        code: "CLOUD-L0-01", title: "Secure a cloud account and set a billing alert", minutes: 60, kind: "BUILD", evidence: "SCREENSHOT", xp: 35,
        objective: "Prepare a cloud account safely: multi-factor authentication on, no daily use of the root login, and a spending alert.",
        tools: ["Cloud provider free tier account", "Authenticator app"],
        skills: ["Identity and access", "Cost control"],
        watch: ["Watch a demonstration of enabling MFA, creating a limited user and setting a budget alert."],
        doSteps: [
          "Enable multi-factor authentication on the account owner login.",
          "Create a separate limited user for daily work.",
          "Create a budget alert at a small amount you choose.",
        ],
        experiment: "Sign in as the limited user and try an action it should not be allowed to do. Record the result.",
        show: "Submit screenshots of MFA enabled, the limited user permissions, the budget alert, and the denied action. Hide any account numbers or secrets.",
        remediation: "Tighten the user permissions or add the missing alert, then resubmit the new screenshot.",
        rubric: [
          ["MFA", "Multi-factor authentication is enabled.", 30],
          ["Least privilege", "A limited user exists with restricted permissions.", 30],
          ["Budget alert", "A spending alert is configured.", 20],
          ["Safe evidence", "Screenshots hide secrets and identifiers.", 20],
        ],
      },
      {
        code: "CLOUD-L0-02", title: "Launch and destroy a small virtual machine", minutes: 75, kind: "BUILD", evidence: "SCREENSHOT", xp: 40,
        objective: "Launch the smallest free-tier virtual machine, connect to it, and then delete it to avoid costs.",
        tools: ["Cloud provider console", "SSH client"],
        skills: ["Compute instances", "Cost control"],
        watch: ["Watch a demonstration of launching, connecting to and terminating a small virtual machine."],
        doSteps: [
          "Launch the smallest instance type that your free tier allows.",
          "Restrict inbound access to only your own IP address.",
          "Connect over SSH and run one command that shows the machine name.",
          "Terminate the instance and confirm nothing is still running.",
        ],
        experiment: "Before deleting, note how a rule change (blocking SSH) affects your connection.",
        show: "Submit screenshots of the running instance, your successful connection, the restricted access rule, and the empty resource list after deletion.",
        remediation: "Delete any leftover resource and resubmit the clean resource list.",
        rubric: [
          ["Launch", "A small instance was launched and reached.", 25],
          ["Restricted access", "Inbound access is limited to your IP.", 30],
          ["Cleanup", "All resources are deleted and shown.", 30],
          ["Experiment", "Explains the effect of the access rule.", 15],
        ],
      },
    ],
  },
  {
    code: "sysadmin",
    milestone: "Administer a Linux server over SSH: manage users, permissions and one service, and document it.",
    skills: [
      ["Linux shell", "Navigate and manage files from the command line."],
      ["File permissions", "Read and set owner, group and mode."],
      ["Users and groups", "Create users and control access."],
      ["SSH", "Connect to servers with keys."],
    ],
    missions: [
      {
        code: "SYS-L0-01", title: "Navigate a Linux server from the command line", minutes: 60, kind: "DRILL", evidence: "SCREENSHOT", xp: 30,
        objective: "Move around a Linux system, create and edit files, and find things using only the terminal.",
        tools: ["Linux machine or VM", "Terminal"],
        skills: ["Linux shell"],
        watch: ["Watch a demonstration of core shell commands for moving, listing, creating, searching and reading files."],
        doSteps: [
          "Create a folder structure for a small project.",
          "Create and edit three text files.",
          "Find a file by name and search inside files for a word.",
        ],
        experiment: "Predict the output of five commands before running them, then compare.",
        show: "Submit a terminal screenshot showing the structure, the search results, and your five predictions with outcomes.",
        remediation: "Repeat the commands you mispredicted and write what each one actually does.",
        rubric: [
          ["Structure", "Folders and files are created as asked.", 25],
          ["Find and search", "Locates files and text correctly.", 30],
          ["Predictions", "Five predictions recorded with real results.", 30],
          ["Clarity", "The screenshot is readable and complete.", 15],
        ],
      },
      {
        code: "SYS-L0-02", title: "Create users and lock down permissions", minutes: 75, kind: "DRILL", evidence: "SCREENSHOT", xp: 35,
        objective: "Create two users and a shared folder, then set permissions so each user can only do what they should.",
        tools: ["Linux machine or VM", "Terminal"],
        skills: ["Users and groups", "File permissions"],
        watch: ["Watch a demonstration of creating users and groups and setting folder permissions."],
        doSteps: [
          "Create two users and one group.",
          "Create a shared folder owned by the group.",
          "Set permissions so one user can write and the other can only read.",
        ],
        experiment: "Log in as each user and try to write a file. Record which attempts succeed and which are denied.",
        show: "Submit screenshots of the users, the folder permissions, and the allowed and denied attempts, plus two sentences explaining the permission string.",
        remediation: "Correct any permission that allowed too much access and resubmit the denied attempt.",
        rubric: [
          ["Users and group", "Created correctly with the right membership.", 25],
          ["Permissions", "Write for one user and read-only for the other.", 35],
          ["Proof", "Allowed and denied attempts are shown.", 25],
          ["Explanation", "Explains the permission string correctly.", 15],
        ],
      },
    ],
  },
  {
    code: "ai",
    milestone: "Build a small automation that uses an AI model and a script, with tested prompts and a note on its limits.",
    skills: [
      ["Prompt design", "Write clear, testable instructions for a model."],
      ["Evaluating output", "Check AI output for errors and bias."],
      ["Scripting basics", "Automate a repeated task with code."],
      ["API basics", "Call a service and read its response."],
    ],
    missions: [
      {
        code: "AI-L0-01", title: "Write and test five prompts for one task", minutes: 60, kind: "DRILL", evidence: "DOCUMENT", xp: 30,
        objective: "Pick one real task and compare five prompt versions, judging each output against a checklist.",
        tools: ["An AI assistant of your choice"],
        skills: ["Prompt design", "Evaluating output"],
        watch: ["Watch a demonstration of improving a prompt step by step and judging the results."],
        doSteps: [
          "Write a three-point checklist for a good answer to your task.",
          "Write five versions of the prompt, each changing one thing.",
          "Score each output against your checklist.",
        ],
        experiment: "Ask the model to do the task wrongly on purpose to see how it fails, then add an instruction that prevents it.",
        show: "Submit a document with the checklist, the five prompts, their outputs, scores and your conclusion.",
        remediation: "Add the missing scoring or conclusion and resubmit.",
        rubric: [
          ["Checklist", "Specific, testable criteria were set first.", 25],
          ["Prompt variations", "Each version changes one clear thing.", 30],
          ["Honest scoring", "Outputs are scored against the checklist.", 30],
          ["Conclusion", "States what worked and why.", 15],
        ],
      },
      {
        code: "AI-L0-02", title: "Automate a repeated task with a script", minutes: 90, kind: "BUILD", evidence: "CODE", xp: 40,
        objective: "Write a small script that automates one boring task you do regularly, such as renaming files or formatting notes.",
        tools: ["Code editor", "Python or JavaScript runtime"],
        skills: ["Scripting basics", "API basics"],
        watch: ["Watch a demonstration of turning a manual task into a short script."],
        doSteps: [
          "Describe the manual task and how long it takes.",
          "Write a script that does it on a sample folder.",
          "Add a dry-run option that shows what would change without changing anything.",
        ],
        experiment: "Run the script on a copy with unusual data (empty folder, odd characters) and fix what breaks.",
        show: "Submit the repository URL, a screen recording or screenshots of a dry run and a real run, and the time saved.",
        remediation: "Handle the failing case you found and resubmit with the new run.",
        rubric: [
          ["Task definition", "Clear manual task and expected time saved.", 20],
          ["Working script", "Does the task correctly on sample data.", 35],
          ["Dry run", "Safely previews changes before making them.", 25],
          ["Edge cases", "Handles unusual input without damage.", 20],
        ],
      },
    ],
  },
  {
    code: "photo",
    milestone: "Deliver a set of five well-exposed, well-composed photos on one subject, with notes on your settings.",
    skills: [
      ["Exposure", "Balance aperture, shutter speed and ISO."],
      ["Composition", "Frame subjects with thirds, lines and space."],
      ["Light", "Read and use natural light."],
      ["Basic editing", "Crop, straighten and adjust exposure."],
    ],
    missions: [
      {
        code: "PHOTO-L0-01", title: "Shoot one subject in three exposures", minutes: 60, kind: "SHOOT", evidence: "PHOTO", xp: 30,
        objective: "Photograph the same subject under-exposed, correctly exposed and over-exposed to understand how settings change the result.",
        tools: ["Camera or phone with manual controls"],
        skills: ["Exposure", "Light"],
        watch: ["Watch a demonstration of changing exposure on one subject and reading the result."],
        doSteps: [
          "Choose a still subject in steady light.",
          "Take one correctly exposed shot and note the settings.",
          "Take one darker and one brighter shot by changing a single setting.",
        ],
        experiment: "Repeat with a different single setting (for example ISO instead of shutter speed) and compare the quality.",
        show: "Submit the three photos side by side with the settings written beneath each, and two sentences on what changed.",
        remediation: "Reshoot the frame where the exposure is not clearly different and resubmit with the settings.",
        rubric: [
          ["Correct exposure", "The main shot is well exposed.", 30],
          ["Controlled change", "Only one setting changed between shots.", 30],
          ["Settings recorded", "Settings are written for every shot.", 20],
          ["Reflection", "Explains what each change did.", 20],
        ],
      },
      {
        code: "PHOTO-L0-02", title: "Compose five shots using thirds and leading lines", minutes: 75, kind: "SHOOT", evidence: "PHOTO", xp: 35,
        objective: "Take five photos of one location, each using a deliberate composition technique.",
        tools: ["Camera or phone"],
        skills: ["Composition", "Basic editing"],
        watch: ["Watch a demonstration of the rule of thirds, leading lines and framing in a real location."],
        doSteps: [
          "Choose one location and walk around it before shooting.",
          "Take five photos, naming the technique used in each.",
          "Crop and straighten your best three.",
        ],
        experiment: "Photograph the same scene once by breaking the rule on purpose and compare which looks better.",
        show: "Submit the five photos, the technique named for each, and your before and after crop on one image.",
        remediation: "Reshoot or recrop any photo where the technique is not visible and resubmit.",
        rubric: [
          ["Technique visible", "The named technique is clearly visible.", 40],
          ["Variety", "Five different framings of the location.", 20],
          ["Editing", "Crops and straightening improve the image.", 20],
          ["Rule-break test", "Compares a broken-rule version honestly.", 20],
        ],
      },
    ],
  },
  {
    code: "video",
    milestone: "Publish a clean 60-second edited video with clear audio and a sensible export.",
    skills: [
      ["Cutting", "Make clean cuts that follow the action."],
      ["Pacing", "Control rhythm and length."],
      ["Audio basics", "Balance levels and reduce noise."],
      ["Export settings", "Choose a sensible format and quality."],
    ],
    missions: [
      {
        code: "VID-L0-01", title: "Edit a 30-second clip with clean cuts", minutes: 90, kind: "EDIT", evidence: "VIDEO", xp: 35,
        objective: "Cut raw footage into a tight 30-second story with no wasted frames.",
        tools: ["Video editing software", "Your own raw footage"],
        skills: ["Cutting", "Pacing"],
        watch: ["Watch a demonstration of trimming, cutting on action and tightening a rough edit."],
        doSteps: [
          "Shoot or choose at least two minutes of your own footage.",
          "Import it and mark the best moments.",
          "Cut to a 30-second sequence with a clear beginning, middle and end.",
        ],
        experiment: "Make a second cut that is 20 seconds long and compare which one tells the story better.",
        show: "Submit the exported 30-second video and one sentence on what you removed and why.",
        remediation: "Tighten any section that drags and resubmit the new export.",
        rubric: [
          ["Story structure", "Clear beginning, middle and end.", 30],
          ["Clean cuts", "Cuts follow the action without jumps.", 30],
          ["Length", "Close to the 30-second target with no filler.", 20],
          ["Reflection", "Explains what was removed and why.", 20],
        ],
      },
      {
        code: "VID-L0-02", title: "Fix the audio of a clip", minutes: 75, kind: "EDIT", evidence: "VIDEO", xp: 35,
        objective: "Improve a clip's sound: balance voice and music levels and reduce background noise.",
        tools: ["Video editing software", "Headphones"],
        skills: ["Audio basics", "Export settings"],
        watch: ["Watch a demonstration of setting levels, reducing noise and exporting with the right audio settings."],
        doSteps: [
          "Pick a clip with speech and some background noise.",
          "Set the speech to a consistent level and lower any music beneath it.",
          "Reduce the noise and export the clip.",
        ],
        experiment: "Export at two quality settings and compare the file size against the quality you can hear.",
        show: "Submit the before and after clips and a note on your levels and export choice.",
        remediation: "Fix any section where speech is hard to hear and resubmit.",
        rubric: [
          ["Speech clarity", "Speech is clear and consistent.", 40],
          ["Balance", "Music sits beneath speech.", 20],
          ["Noise", "Background noise is reduced without damage.", 20],
          ["Export choice", "Export settings are explained.", 20],
        ],
      },
    ],
  },
  {
    code: "biz",
    milestone: "Present a one-page CV and a clear one-paragraph value proposition for the BusinessOS Ghana capstone.",
    skills: [
      ["CV writing", "Present experience and skills clearly on one page."],
      ["Positioning", "State who you help and how in one paragraph."],
      ["Professional profile", "Keep a consistent online profile."],
      ["Budgeting", "Plan monthly income and costs."],
    ],
    missions: [
      {
        code: "BIZ-L0-01", title: "Write a one-page CV", minutes: 75, kind: "WRITE", evidence: "DOCUMENT", xp: 30,
        objective: "Write a one-page CV that highlights your practical projects and skills, free of errors.",
        tools: ["Word processor"],
        skills: ["CV writing"],
        watch: ["Watch a demonstration of structuring a one-page CV around evidence and results."],
        doSteps: [
          "List your projects, skills and any work or volunteering with one result each.",
          "Draft a one-page layout with a short profile line at the top.",
          "Proofread it aloud and fix every error.",
        ],
        experiment: "Ask one person to read it for 20 seconds and tell you what they remember most.",
        show: "Submit the CV as a PDF and what the reader remembered.",
        remediation: "Reword unclear points and fix errors, then resubmit.",
        rubric: [
          ["One-page structure", "Fits one page with clear sections.", 25],
          ["Evidence", "Claims are backed by projects or results.", 35],
          ["Accuracy", "No spelling or formatting errors.", 20],
          ["Reader test", "Records and uses the reader's feedback.", 20],
        ],
      },
      {
        code: "BIZ-L0-02", title: "Draft a value proposition for BusinessOS Ghana", minutes: 60, kind: "WRITE", evidence: "DOCUMENT", xp: 30,
        objective: "Write one paragraph that says who BusinessOS Ghana helps, what problem it solves and why it is different.",
        tools: ["Word processor"],
        skills: ["Positioning"],
        watch: ["Watch a demonstration of turning a customer problem into a clear value proposition."],
        doSteps: [
          "Name one specific type of Ghanaian small business you want to help.",
          "Write their biggest problem in their own words.",
          "Write a four-sentence value proposition: who, problem, solution, difference.",
        ],
        experiment: "Read it to someone who runs a business and note what they would change.",
        show: "Submit the paragraph and the feedback you received.",
        remediation: "Make the customer more specific and resubmit with the new version.",
        rubric: [
          ["Specific customer", "Names a specific type of business.", 30],
          ["Real problem", "Describes a real, believable problem.", 25],
          ["Clear difference", "Explains why the solution is different.", 25],
          ["Feedback", "Records real feedback and a change made.", 20],
        ],
      },
    ],
  },
];
