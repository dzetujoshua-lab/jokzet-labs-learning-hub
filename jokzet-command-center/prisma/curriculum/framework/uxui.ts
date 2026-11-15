import { mod, type ProgrammeSpec } from "./types";

export const UXUI: ProgrammeSpec = {
  code: "uxui",
  name: "UI/UX Design",
  levelOutcomes: [
    "Critique an existing app against usability principles and redesign one screen in Figma.",
    "Produce research-informed wireframes and a polished high-fidelity interface for a small product.",
    "Build a reusable component library and an interactive, responsive, accessible prototype and test it with real people.",
    "Create a documented design system and hand a complete design to developers, with decisions justified by evidence.",
    "Lead a full product design from research to validated, shipped interface and present it as a portfolio case study.",
  ],
  competencies: {
    "ux-analysis": "Evaluate an interface against recognised usability heuristics and explain each problem.",
    "figma-basics": "Create frames, shapes, text and layouts in Figma with sensible naming and structure.",
    "visual-hierarchy": "Direct attention with size, weight, contrast, spacing and layout grids.",
    "user-research": "Plan and run interviews and surveys and turn the answers into findings.",
    "personas-journeys": "Synthesise research into personas and user journeys that drive design decisions.",
    "wireframing": "Produce low-fidelity wireframes that test structure before visual polish.",
    "hifi-ui": "Produce pixel-accurate high-fidelity screens for web and mobile.",
    "components-variants": "Build Figma components with Auto Layout, variants and properties.",
    "prototyping": "Build an interactive prototype that supports a realistic task flow.",
    "information-architecture": "Structure content and navigation using card sorting and tree testing.",
    "responsive-design": "Adapt a design across screen sizes with clear breakpoints.",
    "usability-testing": "Plan, run and report moderated usability tests with at least five participants.",
    "design-systems": "Create and document tokens, components and usage rules that a team can adopt.",
    "dev-handoff": "Prepare specifications and work with developers until the built result matches the design.",
    "motion-interaction": "Design purposeful motion and micro-interactions with clear timing and accessibility.",
    "product-metrics": "Connect design decisions to measurable product outcomes.",
    "product-design-delivery": "Deliver a complete product design backed by research, prototypes, a design system and test findings.",
    "design-leadership": "Run critiques, set design standards and guide other designers' work.",
    "case-study": "Present a design project as a clear case study with problem, process, evidence and outcome.",
  },
  modules: [
    // Level 0
    mod("UXUI-L0-M01", 0, "What UX and UI design are", "Evaluate a mobile app you use against five named usability heuristics and write a one-page critique with annotated screenshots.", 6, ["SH-L0-M01"], ["ux-analysis"], ["DOCUMENT", "SCREENSHOT"], "UXUI"),
    mod("UXUI-L0-M02", 0, "Figma fundamentals", "Recreate a given screen in Figma using frames, text styles and shapes, named and organised so another person can edit it.", 8, ["SH-L0-M03"], ["figma-basics"], ["DESIGN_FILE", "SCREENSHOT"], "UXUI"),
    mod("UXUI-L0-M03", 0, "Redesign one screen", "Redesign one poorly designed screen, and show before and after with a list of the principles you applied and why.", 8, ["UXUI-L0-M01", "UXUI-L0-M02"], ["visual-hierarchy", "ux-analysis"], ["DESIGN_FILE", "DOCUMENT"], "UXUI"),
    // Level 1
    mod("UXUI-L1-M01", 1, "Hierarchy, layout grids and spacing", "Design a three-screen flow on a 12-column grid with a consistent spacing scale and a clear type hierarchy, and mark the grid on each screen.", 14, ["SH-L1-M08"], ["visual-hierarchy"], ["DESIGN_FILE", "SCREENSHOT"], "UXUI"),
    mod("UXUI-L1-M02", 1, "User research fundamentals", "Interview three real people about a task, record consent and notes, and write five findings each linked to a quote.", 14, ["UXUI-L0-M01"], ["user-research"], ["DOCUMENT"], "UXUI"),
    mod("UXUI-L1-M03", 1, "Personas and user journeys", "Create two personas and one journey map grounded in your interview findings, marking the biggest pain point and an opportunity.", 10, ["UXUI-L1-M02"], ["personas-journeys"], ["DESIGN_FILE", "DOCUMENT"], "UXUI"),
    mod("UXUI-L1-M04", 1, "Wireframing", "Sketch and then wireframe a five-screen product flow in low fidelity, and explain which problem from your research each screen solves.", 12, ["UXUI-L1-M03"], ["wireframing"], ["DESIGN_FILE", "DOCUMENT"], "UXUI"),
    mod("UXUI-L1-M05", 1, "High-fidelity interface design", "Turn your wireframes into high-fidelity screens using your colour and type decisions, with real content instead of placeholder text.", 18, ["UXUI-L1-M04", "SH-L1-M08"], ["hifi-ui"], ["DESIGN_FILE", "SCREENSHOT"], "UXUI"),
    // Level 2
    mod("UXUI-L2-M01", 2, "Components, Auto Layout and variants", "Build a component set (buttons, inputs, cards, navigation) with Auto Layout and variants that resizes correctly and covers every state.", 20, ["UXUI-L1-M05"], ["components-variants"], ["DESIGN_FILE", "SCREENSHOT"], "UXUI"),
    mod("UXUI-L2-M02", 2, "Interactive prototyping", "Build a prototype that lets a tester complete three realistic tasks without help, including error states and transitions.", 16, ["UXUI-L2-M01"], ["prototyping"], ["DESIGN_FILE", "VIDEO", "LINK"], "UXUI"),
    mod("UXUI-L2-M03", 2, "Information architecture and navigation", "Run a card sort with at least eight participants or a tree test, and restructure a product's navigation from the results, showing the change.", 16, ["UXUI-L1-M02"], ["information-architecture"], ["DOCUMENT", "DESIGN_FILE"], "UXUI"),
    mod("UXUI-L2-M04", 2, "Responsive and accessible design", "Adapt a design to mobile, tablet and desktop and audit it for contrast, target size, focus order and text scaling, fixing every failure.", 16, ["UXUI-L2-M01", "SH-L1-M04"], ["responsive-design"], ["DESIGN_FILE", "DOCUMENT"], "UXUI"),
    mod("UXUI-L2-M05", 2, "Usability testing", "Test your prototype with five participants, rate each issue by severity, and deliver a report with prioritised recommendations and the changes you made.", 18, ["UXUI-L2-M02"], ["usability-testing"], ["DOCUMENT", "VIDEO", "DESIGN_FILE"], "UXUI"),
    // Level 3
    mod("UXUI-L3-M01", 3, "Design systems", "Build a documented design system with colour, type and spacing tokens, at least twelve components and written usage rules, and apply it to two different screens.", 30, ["UXUI-L2-M01", "UXUI-L2-M04"], ["design-systems"], ["DESIGN_FILE", "DOCUMENT", "LINK"], "UXUI"),
    mod("UXUI-L3-M02", 3, "Developer handoff and collaboration", "Hand a design to a developer with specifications and exported tokens, then review their build against the design and log every deviation until it matches.", 20, ["UXUI-L3-M01", "SH-L1-M03"], ["dev-handoff"], ["DESIGN_FILE", "LIVE_SITE", "DOCUMENT"], "UXUI"),
    mod("UXUI-L3-M03", 3, "Motion and micro-interactions", "Design five purposeful micro-interactions with stated timing and easing, a reduced-motion alternative for each, and show them in a prototype.", 14, ["UXUI-L2-M02"], ["motion-interaction"], ["DESIGN_FILE", "VIDEO"], "UXUI"),
    mod("UXUI-L3-M04", 3, "Product thinking and metrics", "Define success metrics for a feature, design an A/B test for two variants, and justify which you would ship from sample results you are given.", 16, ["UXUI-L2-M05"], ["product-metrics"], ["DOCUMENT"], "UXUI"),
    mod("UXUI-L3-M05", 3, "Capstone: complete product design", "Deliver a complete product design with research evidence, a tested prototype, a design system, an accessibility audit and usability findings, for a problem you chose.", 60, ["UXUI-L3-M01", "UXUI-L3-M04", "UXUI-L2-M05"], ["product-design-delivery"], ["DESIGN_FILE", "DOCUMENT", "VIDEO", "LINK"], "UXUI", true),
    // Level 4
    mod("UXUI-L4-M01", 4, "Capstone: shipped product design", "Design and iterate a real product for a real user group through at least two research and test cycles, have it built, and show measured improvement.", 90, ["UXUI-L3-M05", "UXUI-L3-M02"], ["product-design-delivery"], ["DESIGN_FILE", "LIVE_SITE", "DOCUMENT", "VIDEO"], "UXUI", true),
    mod("UXUI-L4-M02", 4, "Design leadership and critique", "Run three structured design critiques with written feedback another designer acted on, and write design standards for a small team.", 20, ["UXUI-L3-M01"], ["design-leadership"], ["DOCUMENT", "VIDEO"], "UXUI"),
    mod("UXUI-L4-M03", 4, "Portfolio case studies", "Publish three case studies, each stating the problem, your role, process, evidence and outcome, readable in under five minutes each.", 30, ["UXUI-L3-M05"], ["case-study"], ["LIVE_SITE", "DOCUMENT"], "UXUI"),
    mod("UXUI-L4-M04", 4, "Advanced product design specialism", "Choose one specialism (accessibility, data-heavy dashboards, or mobile design) and deliver an audit or redesign that a practitioner would pay for, with evidence.", 30, ["UXUI-L3-M05"], ["product-design-delivery"], ["DESIGN_FILE", "DOCUMENT"], "UXUI"),
  ],
};
