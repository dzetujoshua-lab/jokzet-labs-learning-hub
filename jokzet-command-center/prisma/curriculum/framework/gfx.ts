import { mod, type ProgrammeSpec } from "./types";

/** Adobe Photoshop and Illustrator are taught where they are the industry norm, always alongside a free alternative (GIMP, Inkscape, Figma, Canva) so no module needs a subscription. */
export const GFX: ProgrammeSpec = {
  code: "gfx",
  name: "Graphic Design",
  levelOutcomes: [
    "Explain what makes a design communicate, and produce a clear poster or social post with free tools.",
    "Use typography, colour, vector and raster tools to produce clean layouts and social designs.",
    "Design logos, advertising and print-ready materials from a client brief.",
    "Create a full brand identity system and packaging with documented guidelines.",
    "Lead the creative direction of a complete brand and campaign and present it professionally.",
  ],
  competencies: {
    "visual-communication": "Explain how a design communicates a message to an audience and judge whether it does.",
    "design-tools": "Set up and use free design tools for layout, vector and image editing.",
    "layout-typography": "Build clear layouts with a grid, type hierarchy and readable spacing.",
    "vector-graphics": "Create clean vector artwork with correct paths, shapes and colour.",
    "raster-graphics": "Edit and composite images with layers, masks and adjustments without destroying the original.",
    "composition-colour": "Apply composition and colour to guide attention and set mood.",
    "social-design": "Design for social platforms with correct sizes, safe areas and consistent style.",
    "logo-design": "Design a logo from research and sketches to a final, scalable mark.",
    "advertising-design": "Design advertising and marketing materials with a clear message and call to action.",
    "print-design": "Prepare print-ready files with bleed, colour mode, resolution and correct export.",
    "client-brief": "Turn a client brief into a design plan, and run revisions professionally.",
    "pro-tools": "Work efficiently in Photoshop and Illustrator, or equivalent professional tools.",
    "branding": "Build a brand identity system with logo, colour, type, imagery and usage rules.",
    "packaging": "Design packaging with dielines, hierarchy, regulatory text and print constraints.",
    "editorial-typography": "Set multi-page editorial layouts with advanced typography.",
    "brand-guidelines": "Write brand guidelines that someone else can follow correctly.",
    "creative-direction": "Set the creative direction for a project and guide others toward it.",
    "design-presentation": "Present design decisions clearly to a client and defend them.",
    "brand-delivery": "Deliver a complete brand identity system and practical marketing assets.",
  },
  modules: [
    // Level 0
    mod("GFX-L0-M01", 0, "Visual communication basics", "Take five existing designs, state the message and audience of each, and judge in writing whether the design delivers them.", 5, ["SH-L0-M03"], ["visual-communication"], ["DOCUMENT"], "GRAPHIC"),
    mod("GFX-L0-M02", 0, "Design tools setup", "Install and configure a free layout tool, a vector tool and an image editor, and recreate a simple logo in each.", 6, ["SH-L0-M01"], ["design-tools"], ["DESIGN_FILE", "SCREENSHOT"], "GRAPHIC"),
    mod("GFX-L0-M03", 0, "Your first poster", "Design an A3 event poster with a clear hierarchy, two typefaces at most, a limited palette and a call to action, exported as PDF and PNG.", 8, ["GFX-L0-M01", "GFX-L0-M02"], ["layout-typography", "composition-colour"], ["DESIGN_FILE"], "GRAPHIC"),
    // Level 1
    mod("GFX-L1-M01", 1, "Typography and layout", "Design a four-page document on a grid with a defined type scale, consistent margins and clear headings, and explain each type decision.", 14, ["SH-L1-M08"], ["layout-typography"], ["DESIGN_FILE", "DOCUMENT"], "GRAPHIC"),
    mod("GFX-L1-M02", 1, "Vector graphics", "Draw five icons and one illustration as clean vector paths with a consistent stroke and colour system, and show the points and paths.", 16, ["GFX-L0-M02"], ["vector-graphics"], ["DESIGN_FILE", "SCREENSHOT"], "GRAPHIC"),
    mod("GFX-L1-M03", 1, "Raster graphics and image manipulation", "Retouch a photograph and composite two images with layers and masks, keeping every edit non-destructive and showing the layer structure.", 16, ["GFX-L0-M02"], ["raster-graphics"], ["DESIGN_FILE", "SCREENSHOT"], "GRAPHIC"),
    mod("GFX-L1-M04", 1, "Composition and colour in application", "Redesign three weak designs, improving composition and colour, and state the contrast ratio and focal point before and after.", 12, ["SH-L1-M08", "GFX-L1-M01"], ["composition-colour"], ["DESIGN_FILE", "DOCUMENT"], "GRAPHIC"),
    mod("GFX-L1-M05", 1, "Social media design", "Design a consistent set of nine posts, a story set and a cover image sized for their platforms, with a short style rule sheet.", 14, ["GFX-L1-M01", "GFX-L1-M03"], ["social-design"], ["DESIGN_FILE"], "GRAPHIC"),
    // Level 2
    mod("GFX-L2-M01", 2, "Logo design process", "Take a logo from research and thirty sketches through three refined concepts to a final scalable mark, shown in colour, one colour and at 16 pixels.", 24, ["GFX-L1-M02"], ["logo-design"], ["DESIGN_FILE", "DOCUMENT"], "GRAPHIC"),
    mod("GFX-L2-M02", 2, "Advertising and marketing materials", "Design a flyer, a banner and a social ad for one offer, each with a single clear message and call to action, and justify the visual hierarchy.", 18, ["GFX-L1-M05"], ["advertising-design"], ["DESIGN_FILE", "DOCUMENT"], "GRAPHIC"),
    mod("GFX-L2-M03", 2, "Print design", "Prepare a brochure and a business card as print-ready files with bleed, crop marks, CMYK and correct resolution, and pass a pre-flight check.", 16, ["GFX-L1-M01"], ["print-design"], ["DESIGN_FILE", "SCREENSHOT"], "GRAPHIC"),
    mod("GFX-L2-M04", 2, "Client briefs and creative process", "Write a design plan from a client brief, present two options, handle two revision rounds with a written change log, and deliver final files.", 18, ["GFX-L2-M01", "SH-L2-M02"], ["client-brief"], ["DOCUMENT", "DESIGN_FILE"], "GRAPHIC"),
    mod("GFX-L2-M05", 2, "Professional tools workflows", "Recreate two of your earlier designs in Photoshop and Illustrator (or the stated equivalents) using layers, artboards, styles and libraries, and compare the workflow.", 16, ["GFX-L1-M02", "GFX-L1-M03"], ["pro-tools"], ["DESIGN_FILE", "DOCUMENT"], "GRAPHIC"),
    mod("GFX-L2-M06", 2, "Checkpoint project: a logo and mini brand kit", "Deliver a logo, a colour and type specification and three applications (social post, flyer, business card) for a small real or realistic client, in print-ready and screen-ready files.", 20, ["GFX-L2-M01", "GFX-L2-M02", "GFX-L2-M03"], ["logo-design", "advertising-design", "print-design"], ["DESIGN_FILE", "DOCUMENT"], "GRAPHIC", true),
    // Level 3
    mod("GFX-L3-M01", 3, "Brand identity systems", "Create a brand identity with logo variations, colour palette, typography, patterns, imagery rules and applications on at least five items.", 30, ["GFX-L2-M01", "GFX-L2-M02"], ["branding"], ["DESIGN_FILE", "DOCUMENT"], "GRAPHIC"),
    mod("GFX-L3-M02", 3, "Packaging design", "Design packaging for one product from a dieline, with front-of-pack hierarchy, required information and a mock-up, and prepare the print files.", 24, ["GFX-L2-M03"], ["packaging"], ["DESIGN_FILE", "PHOTO"], "GRAPHIC"),
    mod("GFX-L3-M03", 3, "Editorial layout and advanced typography", "Set a sixteen-page magazine or report with master pages, styles, a consistent grid and refined type details such as kerning and widows.", 24, ["GFX-L2-M03", "GFX-L1-M01"], ["editorial-typography"], ["DESIGN_FILE"], "GRAPHIC"),
    mod("GFX-L3-M04", 3, "Brand guidelines", "Write a ten-page brand guideline with correct-use and misuse examples, and have another learner produce a layout using only your guideline.", 20, ["GFX-L3-M01"], ["brand-guidelines"], ["DESIGN_FILE", "DOCUMENT"], "GRAPHIC"),
    mod("GFX-L3-M05", 3, "Creative direction", "Write a creative brief, direct two other learners through a small project, and give written feedback that moved their work toward the brief.", 16, ["GFX-L3-M01"], ["creative-direction"], ["DOCUMENT"], "GRAPHIC"),
    // Level 4
    mod("GFX-L4-M01", 4, "Capstone: brand identity and marketing assets", "Deliver a complete brand identity system with guidelines and a practical set of marketing assets (social, print, one packaging or signage piece) for a real or realistic client.", 80, ["GFX-L3-M01", "GFX-L3-M04", "GFX-L3-M02"], ["brand-delivery"], ["DESIGN_FILE", "DOCUMENT"], "GRAPHIC", true),
    mod("GFX-L4-M02", 4, "Multi-channel campaign", "Design a campaign across five touchpoints with a single idea, and show how the design adapts to each format without losing consistency.", 40, ["GFX-L3-M01", "GFX-L2-M02"], ["advertising-design", "branding"], ["DESIGN_FILE", "DOCUMENT"], "GRAPHIC"),
    mod("GFX-L4-M03", 4, "Professional presentation and portfolio", "Present a project to a panel in ten minutes, defend three decisions under questioning, and publish a portfolio of four finished projects.", 24, ["GFX-L3-M01"], ["design-presentation"], ["VIDEO", "LIVE_SITE", "DOCUMENT"], "GRAPHIC"),
    mod("GFX-L4-M04", 4, "Leading creative direction on a project", "Lead a small team through a complete project as creative director, with a brief, review points and a final result that matches the brief.", 40, ["GFX-L3-M05"], ["creative-direction"], ["DOCUMENT", "DESIGN_FILE"], "GRAPHIC"),
  ],
};
