import { mod, type ProgrammeSpec } from "./types";

/** Learners must regularly capture and submit their own photographs. No module can be passed with stock images. */
export const PHOTO: ProgrammeSpec = {
  code: "photo",
  name: "Photography",
  levelOutcomes: [
    "Take clear, intentional photographs on a phone or camera and explain what made each one work.",
    "Control exposure, focus and natural light manually and edit a set of photos consistently.",
    "Light and shoot portraits, products and scenes with artificial light and correct colour and retouch to a professional standard.",
    "Plan and deliver paid-quality studio, event and commercial work to a client brief.",
    "Lead a complete commercial photography project and run the business side: pricing, licensing, delivery and portfolio.",
  ],
  competencies: {
    "camera-basics": "Name and use the controls of a phone camera or camera and explain how an image is formed.",
    "phone-photography": "Take sharp, well-framed photos with a phone using focus, exposure and light on purpose.",
    "exposure": "Set aperture, shutter speed and ISO manually to get the exposure and look you intend.",
    "focus-depth": "Control focus and depth of field for the subject you choose.",
    "composition": "Compose images with deliberate framing, balance, lines and negative space.",
    "natural-light": "Read and use natural light at different times of day and in different weather.",
    "photo-editing": "Edit a set of images non-destructively for a consistent, natural result.",
    "artificial-light": "Light a subject with a flash or continuous source and control direction, hardness and ratio.",
    "portrait": "Direct a subject and photograph flattering, expressive portraits.",
    "product-photo": "Photograph products accurately with clean backgrounds, control of reflections and consistent colour.",
    "colour-retouching": "Correct colour and retouch skin, objects and backgrounds without making the image look artificial.",
    "landscape-street": "Photograph landscapes and street scenes with timing, patience and awareness of people and place.",
    "studio": "Plan and run a studio shoot with lighting set-ups, backdrops and a shot list.",
    "event": "Photograph an event in changing light and capture the moments that matter to the client.",
    "commercial": "Produce images to a commercial brief, including usage, deliverables and approvals.",
    "delivery": "Select, name, export and deliver photographs in the formats a client needs.",
    "client-management": "Manage a client from enquiry to delivery with a written agreement.",
    "photo-business": "Price, license and market photography work and maintain a portfolio.",
    "photo-delivery-project": "Deliver a complete commercial photography project from brief to final files.",
  },
  modules: [
    // Level 0
    mod("PHOTO-L0-M01", 0, "Cameras, phones and how an image is made", "Label the main controls on your own camera or phone and explain, with a simple diagram, how light becomes a photograph.", 5, ["SH-L0-M01"], ["camera-basics"], ["DOCUMENT", "PHOTO"], "PHOTO"),
    mod("PHOTO-L0-M02", 0, "Phone photography essentials", "Take ten photos that are sharp, level and well exposed using tap-to-focus, exposure adjustment and a clean lens, and note what you did for each.", 6, ["PHOTO-L0-M01"], ["phone-photography"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L0-M03", 0, "Photo walk: ten intentional photographs", "Take a walk of at least one hour, submit your best ten photographs with a one-line intention for each, and choose which one is weakest and why.", 8, ["PHOTO-L0-M02"], ["phone-photography", "composition"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    // Level 1
    mod("PHOTO-L1-M01", 1, "Exposure: aperture, shutter speed and ISO", "Photograph the same scene at three apertures, three shutter speeds and three ISO values in manual mode, and show how each setting changed the result.", 14, ["PHOTO-L0-M01"], ["exposure"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L1-M02", 1, "Focus and depth of field", "Create a set of six photographs that show shallow and deep depth of field with the focus point on purpose, and explain each focus decision.", 10, ["PHOTO-L1-M01"], ["focus-depth"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L1-M03", 1, "Composition in practice", "Shoot a six-photograph series that each demonstrate a different composition idea (lines, framing, balance, negative space, layers, scale) and mark the idea on each.", 12, ["SH-L1-M09"], ["composition"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L1-M04", 1, "Working with natural light", "Photograph one subject at four times of day or in four weather conditions and describe how the direction, colour and hardness of light changed the picture.", 14, ["PHOTO-L1-M01"], ["natural-light"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L1-M05", 1, "Editing basics with free tools", "Edit ten photographs from one shoot in a free editor with consistent exposure, white balance, crop and contrast, and show originals next to the edits.", 14, ["PHOTO-L1-M01"], ["photo-editing"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    // Level 2
    mod("PHOTO-L2-M01", 2, "Artificial lighting", "Light the same subject four ways (flash on camera, off camera, continuous, window plus reflector) and show how direction and hardness changed the mood.", 18, ["PHOTO-L1-M04"], ["artificial-light"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L2-M02", 2, "Portrait photography", "Photograph one person in three settings with direction and posing, deliver eight selected portraits, and get written feedback from the subject.", 20, ["PHOTO-L2-M01", "PHOTO-L1-M02"], ["portrait"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L2-M03", 2, "Product photography", "Photograph five products on a clean background with controlled reflections and accurate colour, including one on white and one in a lifestyle setting.", 20, ["PHOTO-L2-M01"], ["product-photo"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L2-M04", 2, "Colour correction and retouching", "Correct colour on a mixed-light set and retouch three portraits and two products to a natural standard, with before and after for each.", 18, ["PHOTO-L1-M05"], ["colour-retouching"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L2-M05", 2, "Landscape and street photography", "Make a series of five landscape and five street photographs, with notes on timing, permission and the ethics of photographing people.", 16, ["PHOTO-L1-M03"], ["landscape-street"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L2-M06", 2, "Checkpoint project: a themed photo essay", "Shoot and edit a themed essay of twelve photographs that uses controlled light, at least one portrait and one product or place image, with colour-corrected files and a written edit rationale.", 20, ["PHOTO-L2-M02", "PHOTO-L2-M03", "PHOTO-L2-M04"], ["composition", "colour-retouching", "delivery"], ["PHOTO", "DOCUMENT"], "PHOTO", true),
    // Level 3
    mod("PHOTO-L3-M01", 3, "Studio photography", "Plan and run a studio session with a shot list and three lighting set-ups, and deliver twelve finished images that match the plan.", 24, ["PHOTO-L2-M02", "PHOTO-L2-M03"], ["studio"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L3-M02", 3, "Event photography", "Cover a real event of at least two hours, deliver fifty edited photographs covering the key moments in mixed light, and record what the organiser asked for.", 24, ["PHOTO-L2-M01", "PHOTO-L2-M04"], ["event"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L3-M03", 3, "Commercial photography brief", "Produce a set of images to a written commercial brief with stated usage and deliverables, and show how each image answers a line of the brief.", 24, ["PHOTO-L3-M01"], ["commercial"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L3-M04", 3, "Advanced colour and retouching workflow", "Create a repeatable edit workflow (presets, batch export, colour-managed output) and apply it to a set of at least forty images with consistent results.", 16, ["PHOTO-L2-M04"], ["colour-retouching", "delivery"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L3-M05", 3, "Client management and delivery", "Run a job from enquiry to delivery with a written agreement, a proof gallery, client selections and a final delivery package, and ask the client for written feedback.", 16, ["SH-L2-M02", "PHOTO-L3-M03"], ["client-management", "delivery"], ["DOCUMENT", "LINK"], "BUSINESS"),
    // Level 4
    mod("PHOTO-L4-M01", 4, "Capstone: commercial photography project", "Deliver a complete paid or realistic commercial project: brief, plan, shoot, edit, delivery and client sign-off, with a behind-the-scenes account.", 70, ["PHOTO-L3-M03", "PHOTO-L3-M04", "PHOTO-L3-M05"], ["photo-delivery-project"], ["PHOTO", "DOCUMENT", "VIDEO"], "PHOTO", true),
    mod("PHOTO-L4-M02", 4, "Developing a personal style: a documentary series", "Produce a cohesive series of at least twenty photographs on one subject over at least a month, with an artist statement that explains your choices.", 50, ["PHOTO-L3-M02"], ["composition", "landscape-street"], ["PHOTO", "DOCUMENT"], "PHOTO"),
    mod("PHOTO-L4-M03", 4, "Photography business and portfolio", "Build a portfolio site with your best work, a price list based on your costs and a licensing policy, and test them against two real enquiries.", 24, ["PHOTO-L3-M05", "SH-L2-M02"], ["photo-business"], ["LIVE_SITE", "DOCUMENT"], "BUSINESS"),
    mod("PHOTO-L4-M04", 4, "Specialism: advanced genre project", "Choose one genre (weddings, fashion, food, architecture, wildlife or another) and deliver a portfolio set that a specialist client would hire you for.", 40, ["PHOTO-L3-M01"], ["commercial"], ["PHOTO", "DOCUMENT"], "PHOTO"),
  ],
};
