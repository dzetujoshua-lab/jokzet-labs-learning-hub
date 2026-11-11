# EXISTING FEATURES (Base44 export)

Classification: **RD** reusable design · **RF** reusable frontend logic · **RB** requires rebuilding · **INC** incomplete · **NI** not implemented.
Based on static reading only; the app was not run.

| # | Feature | What exists | Class | Notes |
|---|---|---|---|---|
| 1 | App shell / sidebar | `Layout.jsx`: 7-item sidebar, programme level/XP footer, mobile nav | RD + RB | Layout idea good; rebuild in Next with shadcn sidebar |
| 2 | Dashboard | `Dashboard.jsx` + 8 dashboard components: today's missions, level band, weekly %, streak, reminders rail, department cards, capstone strip | RD, RF (streak/weekly maths), RB | Computed client-side from full-table fetches. No hours, no pending-assessment panel, no activity feed |
| 3 | Departments list | 9-card grid with icon map and tiles | RD | Departments are **not seeded**; list will be empty |
| 4 | Department detail | Level/XP bar, editable "next milestone", mission/evidence/assessment/portfolio lists | RD, INC | No roadmap, levels, skills, milestones as entities |
| 5 | Missions | List, filter, create form, toggle done/planned, delete | RD, RB | A mission is a title + date + minutes + XP. **No steps, objective, tools, video, experiment, rubric, passing score, remediation, WATCH→DO→EXPERIMENT→SHOW**. No start/save/submit workflow |
| 6 | XP / levels | `setMissionStatus` adjusts dept XP; `levelFromXp` = XP/300 | RF (concept) / RB | Client-side, non-atomic, forgeable. Move to server transaction |
| 7 | Streak | `computeStreak` over done-mission dates | RF | Uses moment and browser TZ; redo in Africa/Accra with date-fns-tz |
| 8 | Evidence vault | Form with type, description, link, optional file upload; media preview via signed URL; list/delete | RD, RB | Upload is Base44-only. No type/size validation, no GitHub/live URL types, no linkage to submissions. Status `verified` has no workflow |
| 9 | Assessments | Manual log of title/type/score/max/outcome/notes; tiles for average/passed/revise | RD, INC | Not rubric-based. No feedback, weakness tracking, corrections, resubmissions, link to missions |
| 10 | Portfolio | Pieces with status, tools, media/link URL, capstone flag, stage/stages | RD, INC | Media is a URL string, no upload. No skills/results aggregation |
| 11 | Reminders | List, create, done/snooze, delete; rail on dashboard | RD, INC | Date only (no time, no timezone, no 12:00 default), no notification delivery, no calendar view |
| 12 | Capstone (BusinessOS Ghana) | A strip showing a portfolio piece flagged capstone with stage x/8 | INC | None of sales, inventory, customers, suppliers, expenses, finance, analytics |
| 13 | Authentication | Login, register with email OTP, forgot/reset password, MFA UI, Google login, OAuth consent page | RB | Entirely Base44 SDK. ~1,500 lines to discard, UI patterns reusable |
| 14 | Authorization | Entity RLS by `created_by_id` | RB | Re-implement server-side with explicit ownership checks |
| 15 | Analytics | Tiles only | NI | No charts, hours, trends, weekly/monthly reports |
| 16 | Calendar / weekly schedule | – | NI | Weekday-to-department schedule, programme start 16 Nov 2026 not encoded anywhere |
| 17 | Learning methodology & content | – | NI | No curriculum, no resources. Must be authored without invented URLs |
| 18 | Notifications | – | NI | |
| 19 | Achievements / activity log | – | NI | |
| 20 | Skills / roadmaps / milestones | – | NI | |
| 21 | Loading skeletons / error states | Spinner at boot; `EmptyState` component; `skeleton.jsx` unused by pages | INC | |
| 22 | Toasts | `sonner` + radix toast both present | RF | Keep sonner only |
| 23 | Tests | – | NI | |
| 24 | PWA manifest | referenced, file missing | INC | |

## Reusable assets worth carrying over (as ideas, re-typed in TSX)

- Information architecture: Command, Missions, Departments, Evidence, Assessments, Portfolio, Reminders.
- Department codes `fswd, uxui, sec, cloud, sysadmin, ai, photo, video, biz` and icon mapping.
- Component split: `DepartmentCard`, `MissionRow`, `ProgressPanel`, `ReminderRail`, `LevelBand`, `EmptyState`, `PageHeader`, `FormField`.
- Mono-label eyebrow + display heading typography; dense panel cards.
- Enum vocabularies: evidence types, assessment outcomes (pass/revise), mission statuses.
