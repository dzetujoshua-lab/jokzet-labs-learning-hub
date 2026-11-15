import { mod, type ProgrammeSpec } from "./types";

/** Every software workflow here has a free route (for example DaVinci Resolve free edition, Kdenlive or Shotcut). No module may require a paid subscription. */
export const VIDEO: ProgrammeSpec = {
  code: "video",
  name: "Video Editing and Production",
  levelOutcomes: [
    "Plan, shoot and edit a clear 60-second video with usable audio on free software.",
    "Record good picture and sound, organise a project, and edit a short piece with clean cuts, titles and captions.",
    "Tell a story across short and long formats, correct colour, mix sound and deliver in the right format for each platform.",
    "Grade, animate and finish professional work, and run a commercial job with a client from brief to delivery.",
    "Lead a complete commercial production, optimise your workflow and present a professional showreel.",
  ],
  competencies: {
    "video-basics": "Explain how video is captured and plan a simple video with a shot list.",
    "shot-types": "Use shot size, angle and movement deliberately.",
    "first-edit": "Assemble a short edit on a timeline with clips, trims and music.",
    "camera-settings": "Set frame rate, resolution, shutter speed and exposure for the look you want.",
    "audio-recording": "Record clean dialogue and ambient sound and avoid common audio problems.",
    "editing-workflow": "Organise media and edit efficiently with cuts, trims and a clear project structure.",
    "titles-captions": "Add readable titles and accurate captions with consistent style.",
    "audio-editing": "Clean, level and balance audio so dialogue is clear.",
    "storytelling": "Structure a story with a beginning, tension and resolution in a short script and edit.",
    "short-form": "Make vertical short-form video that holds attention and fits platform rules.",
    "colour-correction": "Match shots and correct exposure and white balance.",
    "sound-design": "Layer music, effects and ambience to support the story.",
    "export-delivery": "Choose export settings and formats for web, social, broadcast and archive.",
    "colour-grading": "Create a deliberate look with grading tools and keep it consistent across a project.",
    "motion-graphics": "Animate titles, lower thirds and simple graphics with clear timing.",
    "vfx-basics": "Perform keying, tracking and clean-up for simple visual effects.",
    "long-form": "Edit interviews and long-form content to a clear, watchable structure.",
    "commercial-video": "Deliver video to a client brief with approvals, revisions and final delivery.",
    "video-workflow": "Use proxies, templates and archiving to make editing faster and safer.",
    "showreel": "Curate and present your best work as a short, professional showreel.",
    "production-leadership": "Plan and lead a shoot with roles, call sheet, budget and schedule.",
  },
  modules: [
    // Level 0
    mod("VIDEO-L0-M01", 0, "Video production fundamentals", "Plan a 60-second video with a one-paragraph idea, a shot list and a simple storyboard, and explain how each shot supports the idea.", 6, ["SH-L0-M01"], ["video-basics"], ["DOCUMENT", "DESIGN_FILE"], "VIDEO"),
    mod("VIDEO-L0-M02", 0, "Shot types and framing", "Shoot a set of twelve shots (wide, medium, close-up, over the shoulder, high and low angle) on a phone and label what each one communicates.", 8, ["VIDEO-L0-M01"], ["shot-types"], ["VIDEO", "DOCUMENT"], "VIDEO"),
    mod("VIDEO-L0-M03", 0, "Your first edit", "Edit your shots into a 60-second video on free software with cuts, trimmed clips, a title and music, exported as an MP4.", 10, ["VIDEO-L0-M02"], ["first-edit"], ["VIDEO"], "VIDEO"),
    // Level 1
    mod("VIDEO-L1-M01", 1, "Camera settings: frame rate, resolution and exposure", "Record the same scene at two frame rates and two shutter speeds and show how motion and exposure change, stating when you would use each.", 10, ["VIDEO-L0-M02"], ["camera-settings"], ["VIDEO", "DOCUMENT"], "VIDEO"),
    mod("VIDEO-L1-M02", 1, "Recording good audio", "Record the same sentence with three microphone positions in a quiet and a noisy room, and show which gives the clearest dialogue and why.", 8, ["VIDEO-L0-M03"], ["audio-recording"], ["AUDIO", "DOCUMENT"], "VIDEO"),
    mod("VIDEO-L1-M03", 1, "Editing workflow and timeline skills", "Organise raw footage into a project structure and cut a two-minute piece using trims, ripple edits and J and L cuts, with a tidy timeline.", 16, ["VIDEO-L0-M03"], ["editing-workflow"], ["VIDEO", "SCREENSHOT"], "VIDEO"),
    mod("VIDEO-L1-M04", 1, "Transitions, titles and captions", "Add purposeful transitions, a title sequence and accurate captions to your two-minute piece, and justify each transition choice.", 10, ["VIDEO-L1-M03"], ["titles-captions"], ["VIDEO", "DOCUMENT"], "VIDEO"),
    mod("VIDEO-L1-M05", 1, "Audio editing basics", "Clean noise, level dialogue and add music under speech so that speech is always clear, and show the waveform and loudness before and after.", 10, ["VIDEO-L1-M02", "VIDEO-L1-M03"], ["audio-editing"], ["AUDIO", "VIDEO", "SCREENSHOT"], "VIDEO"),
    // Level 2
    mod("VIDEO-L2-M01", 2, "Storytelling and scripting", "Write a three-minute script with a clear arc, shoot it, and edit it so a viewer can state the point of the story after one viewing.", 24, ["SH-L1-M09", "VIDEO-L1-M04"], ["storytelling"], ["DOCUMENT", "VIDEO"], "VIDEO"),
    mod("VIDEO-L2-M02", 2, "Short-form vertical content", "Produce five vertical videos under sixty seconds, each with a hook in the first three seconds, captions and platform-correct framing.", 16, ["VIDEO-L1-M04"], ["short-form"], ["VIDEO"], "VIDEO"),
    mod("VIDEO-L2-M03", 2, "Colour correction", "Correct exposure and white balance and match shots from two cameras across a three-minute edit, and show scopes before and after.", 16, ["VIDEO-L1-M03"], ["colour-correction"], ["VIDEO", "SCREENSHOT"], "VIDEO"),
    mod("VIDEO-L2-M04", 2, "Sound design and mixing", "Build a sound design for a one-minute scene with ambience, effects and music, and deliver a mix that meets a stated loudness target.", 16, ["VIDEO-L1-M05"], ["sound-design"], ["AUDIO", "VIDEO"], "VIDEO"),
    mod("VIDEO-L2-M05", 2, "Export settings and delivery formats", "Export the same video for web, social, and archive with correct codec, bitrate and resolution, and explain each choice in a table.", 10, ["VIDEO-L1-M04"], ["export-delivery"], ["VIDEO", "DOCUMENT"], "VIDEO"),
    mod("VIDEO-L2-M06", 2, "Checkpoint project: a three-minute story with sound", "Produce a three-minute story from script to delivery with corrected colour, a mixed soundtrack and platform-correct exports, and write what you would change on a second edit.", 24, ["VIDEO-L2-M01", "VIDEO-L2-M03", "VIDEO-L2-M04", "VIDEO-L2-M05"], ["storytelling", "export-delivery"], ["VIDEO", "DOCUMENT"], "VIDEO", true),
    // Level 3
    mod("VIDEO-L3-M01", 3, "Colour grading", "Create three distinct looks for the same footage, apply one consistently across a five-minute project, and explain how the look supports the story.", 20, ["VIDEO-L2-M03"], ["colour-grading"], ["VIDEO", "SCREENSHOT", "DOCUMENT"], "VIDEO"),
    mod("VIDEO-L3-M02", 3, "Motion graphics", "Animate an opening title, three lower thirds and a simple explainer graphic with clear timing and easing.", 24, ["VIDEO-L2-M01"], ["motion-graphics"], ["VIDEO"], "VIDEO"),
    mod("VIDEO-L3-M03", 3, "Visual effects fundamentals", "Complete three effects shots: a green-screen key, a tracked graphic on a moving object, and a clean-up that removes an unwanted object.", 24, ["VIDEO-L2-M03"], ["vfx-basics"], ["VIDEO"], "VIDEO"),
    mod("VIDEO-L3-M04", 3, "Long-form and interview editing", "Edit a ten-minute interview-based piece with B-roll, a clear structure and clean audio, and write an editing note explaining the structure.", 30, ["VIDEO-L2-M01", "VIDEO-L2-M04"], ["long-form"], ["VIDEO", "DOCUMENT"], "VIDEO"),
    mod("VIDEO-L3-M05", 3, "Commercial video production and client workflow", "Produce a thirty to sixty-second commercial for a real or realistic client with a brief, two rounds of revisions and a signed-off final delivery.", 30, ["SH-L2-M02", "VIDEO-L2-M05", "VIDEO-L2-M01"], ["commercial-video"], ["VIDEO", "DOCUMENT"], "VIDEO"),
    // Level 4
    mod("VIDEO-L4-M01", 4, "Capstone: commercial video production", "Deliver a complete commercial production from brief to final files, including planning documents, shoot, edit, grade, mix and client sign-off.", 80, ["VIDEO-L3-M01", "VIDEO-L3-M04", "VIDEO-L3-M05"], ["commercial-video", "colour-grading"], ["VIDEO", "DOCUMENT"], "VIDEO", true),
    mod("VIDEO-L4-M02", 4, "Workflow optimisation and archiving", "Build a project template, a proxy workflow and an archive plan, and show with timings that your workflow edits the same project faster.", 16, ["VIDEO-L3-M04"], ["video-workflow"], ["DOCUMENT", "VIDEO"], "VIDEO"),
    mod("VIDEO-L4-M03", 4, "Professional showreel", "Create a ninety-second showreel and a portfolio page of your best three projects, with credit for your exact role on each.", 20, ["VIDEO-L3-M05"], ["showreel"], ["VIDEO", "LIVE_SITE"], "VIDEO"),
    mod("VIDEO-L4-M04", 4, "Leading a production", "Plan and lead a shoot with a call sheet, crew roles, a budget and a schedule, and write a short report on what went to plan and what did not.", 30, ["VIDEO-L3-M05"], ["production-leadership"], ["DOCUMENT", "VIDEO"], "VIDEO"),
  ],
};
