# Comprehensive Platform Audit: JOKZET Labs Academy

Audit date: 2026-11-18. Code audited: `738ae0f` on master, `jokzet-command-center/`. Production: https://jokzet-labs.iipghstudent.com.
Method: code review of the actual implementation, the existing documentation, the automated test results (523/523), the production build, aggregate read-only counts from the production database, and the live checks listed in `QA_AND_TEST_RESULTS.md`. Visual and browser-level UI was **not** re-inspected in this audit.
Status labels: CV = complete and verified, IN = implemented but not verified, PI = partially implemented, NI = not implemented, BR = broken, BL = blocked.

## 1. Overall verdict
**Ready for internal testing. Not ready for a public launch.** The learner platform works end to end for account creation, personalised onboarding, plan generation, review and confirmation, evidence upload, self-assessment, optional human review, reminders and privacy requests. It is held back by four things: very little published curriculum (18 lessons, 2 per department), no learner home page for personalised plans, no automated or independent verification of skills, and weak operations (no password reset, no backups, no cron, no monitoring).

## 2. Feature classification (Workstream A)
| Feature | Status | Evidence |
|---|---|---|
| Public landing page | NI | No public home route. `/` is the signed-in Command page; unauthenticated visitors are sent to login. `/privacy-policy` is the only public content page. |
| Registration | CV | `(auth)/actions.ts`, tests (`auth`, `age-confirmation`, `onboarding-flow`), live check. Name, email, password, 18+ confirmation. |
| Login / sign-out | CV | `auth.test.ts` (12), live test earlier. |
| Authentication and sessions | CV | Argon2id, hashed session tokens, 14-day sliding sessions. |
| Profile management | PI | `Profile` model (name, timezone). No profile edit screen found beyond settings and reminder timezone. Six production users lack a profile row. |
| Onboarding (wizard) | CV for server logic, IN for the browser UI | 18 new tests plus 18 existing; live gate checks. Wizard UI never driven by a browser test. |
| Programme selection | CV | Up to 5 programmes, only those with published lessons. Descriptions and outcomes are static copy (`programme-info.ts`). |
| Learning goals | CV | Weight, target level, note per programme; secret detection on notes. |
| Experience level | CV | Four levels. Used as a generator input; it does **not** unlock or hide advanced material. |
| Baseline assessment | PI | Mechanism built (placement only, no XP). No baseline missions are published, so no learner can take one. The baseline mission pages sit behind the onboarding gate, so they would be unreachable during onboarding. |
| Duration | CV | 2 weeks to 1 year and custom 7 to 365 days; trade-off text. |
| Availability | CV | Days, daily minutes, session length, start time, breaks, flexibility; timezone from the plan (see section 6). |
| Syllabus generation | PI | Deterministic generator (33 tests) works from published missions only. With 18 published lessons the "syllabus" is short and repeats little real content. |
| Timetable generation | CV | Real availability, no overlaps, catch-up/review reserve, manual and automatic reschedule, missed history kept (tests). |
| Plan review and confirmation | CV (server) / IN (UI) | `buildPlanForReview`, `confirmPlan`; stale-plan and double-click protection tested. |
| Learner dashboard | **PI / gap** | `/` is the legacy Command page (`getDashboardData`, daily missions from the fixed Level 0 schedule). It does not show the learner's active plan. The plan is shown only at `/timetable`. A newly confirmed learner is sent to `/`, which shows little. |
| Daily activities | PI | Legacy daily missions only for legacy learners. Plan sessions appear in `/timetable`. |
| Curriculum progression | PI | Level calculation from XP (`levelFromXp`); no gating of Level 1+ on evidence of Level 0 beyond plan prerequisites. |
| Personal activities, recommended challenges | CV | `activities.test.ts` (16): create, rubric templates, accept challenges, rate limits. |
| Learning resources | PI | Model, validator, embed rules, 18 tests; **0 resources in production**. |
| Evidence submissions | CV | Upload validation by content, secret scan, owner-only access, 35 tests. |
| Assessment | PI | Self-assessment against rubrics (CV). No automated or AI assessment (NI). Human review (CV, optional). |
| Feedback | PI | Learner-written feedback and generated corrections. No AI or reviewer-facing feedback templates. |
| Progress tracking, analytics | CV | `/analytics`, `/departments`; placement baselines excluded from achievement measures. |
| Achievements | **NI** | `Achievement` / `UserAchievement` tables exist and are exported by the privacy tool, but no code awards or displays achievements. |
| Portfolio | CV | `/portfolio`, 8 tests. |
| Notifications / reminders | PI | Engine, scheduler, in-app poll and web push all tested (29). **Cron not installed**, 0 push subscriptions: server-side reminders do not run in production. |
| Settings | CV | Settings, reminders, timetable settings. |
| Account management | CV | Export, delete (password + phrase), audit trail, no password reset (NI). |
| Roles and reviewing | PI | Admin/reviewer roles by script (`scripts/roles.ts`); no admin UI. All 14 production users are learners. |
| Capstone / BusinessOS Ghana | IN | Pages and tests exist (10); not part of the plan flow. |

## 3. Registration and onboarding (Workstream B)
| # | Question | Answer |
|---|---|---|
| 1 | Registration redirects to onboarding? | **Yes.** `register` redirects to `/onboarding` when personalised learning is on (now the default). Verified live. |
| 2 | Server enforces completion? | **Yes.** Page shell (`AuthGate`), every server action in the app area (`requireOnboardedUser`), and the evidence, notification, push and review APIs (`getOnboardedUser`, returns 401). Not enforced for account export/delete by design. |
| 3 | Bypass by entering URLs? | **No.** Direct requests render a streamed redirect to `/onboarding` (HTTP 200 with a redirect marker in the body, a Next.js streaming behaviour). Checked live: no learner data in the response. |
| 4 | Progress persisted? | **Yes**: answers in a DRAFT `LearningPlan` and `LearningGoal` rows; stage in `Profile.onboardingStatus` (`IN_PROGRESS`, `PLAN_GENERATING`, `PLAN_REVIEW`, `COMPLETE`). |
| 5 | Resume? | **Yes** by status. Not browser-tested across refresh/closure. |
| 6 | Multiple programmes? | Yes, up to 5 (`MAX_GOALS`). |
| 7 | Custom duration? | Yes, 7 to 365 days. |
| 8 | Actual personalised syllabus? | Yes in mechanism; shallow in substance because only 18 lessons are published. |
| 9 | Timetable from real availability? | Yes. |
| 10 | Review and confirm? | Yes. Nothing activates until `confirmPlan`. |
| 11 | Dashboard shows the active plan? | **No.** See section 2. |
| 12 | Duplicate plans prevented? | Yes: one DRAFT and one ACTIVE plan per user by unique keys (`draftKey`, `activeKey`); idempotent build; double-confirm test. |
| 13 | Orphans after failure? | Failure returns the learner to `IN_PROGRESS` and keeps the draft (reusable, not orphaned). A crash mid-generation leaves `PLAN_GENERATING`, which the page treats as in progress. Crash behaviour is reasoned, not tested. |
| 14 | Existing learners keep progress? | Yes. 4 legacy accounts are `COMPLETE` and unaffected. 6 accounts without a profile behave as legacy. |
| 15 | Legacy logic override a personalised plan? | No for registration and `ensureLearnerSetup` (tested). The dashboard still calls legacy daily-mission generation for everyone; it creates nothing without a legacy schedule. |

Production snapshot (aggregate): profiles LEGACY/COMPLETE 4, PERSONALISED/COMPLETE 2, PERSONALISED/IN_PROGRESS 1, PERSONALISED/PLAN_REVIEW 1; plans ACTIVE 2, DRAFT 1.
Remaining work: learner home for personalised plans, browser end-to-end tests, baseline path, profile backfill (see `REMAINING_DEVELOPMENT_PHASES.md`: S2-01, S2-03, S4-04, S7-01).

## 4. Curriculum (Workstream C)
Published and live: **18 lessons**, 2 per department across 9 departments (Level 0 only), 9 levels, 19 rubrics, 0 resources.
Authored but unpublished (framework in `prisma/curriculum/framework`, not imported by the app): module outlines for all nine programmes across Levels 0 to 4, plus 71 mission drafts, **all with status DRAFT**.

| Programme | L0 | L1 | L2 | L3 | L4 |
|---|---|---|---|---|---|
| Web (fswd) | 3 mod / 10 drafts | 4 / 14 | 6 / 0 | 8 / 0 | 4 / 0 |
| UI/UX | 3 / 0 | 5 / 0 | 5 / 0 | 5 / 0 | 4 / 0 |
| Cybersecurity | 3 / 0 | 5 / 0 | 6 / 0 | 6 / 0 | 4 / 0 |
| Photography | 3 / 0 | 5 / 0 | 6 / 0 | 5 / 0 | 4 / 0 |
| Video | 3 / 0 | 5 / 0 | 6 / 0 | 5 / 0 | 4 / 0 |
| Graphic Design (gfx) | 3 / 0 | 5 / 0 | 6 / 0 | 5 / 0 | 4 / 0 |
| AI and Automation | 3 / 0 | 4 / 0 | 6 / 0 | 6 / 0 | 4 / 0 |
| Business | 3 / 10 | 5 / 16 | 6 / 0 | 5 / 0 | 4 / 0 |
| Cloud and Server Admin | 3 / 0 | 6 / 0 | 9 / 0 | 10 / 0 | 9 / 0 |
Shared modules: 15, of which 6 have mission drafts (2+2+3+4+5+3+2 across L0/L1). Seven learning pathways are defined.

Findings: the framework is a credible five-level structure (modules, prerequisites, pathways, rubric families) validated by 48 tests, but only two pilot programmes (web, business) have missions at all, only to Level 1, and none are approved or published. **Graphic Design has no department in the database; Cloud Computing and Server Administration are two departments (`cloud`, `sysadmin`)** while the intended structure is one programme. The 18 published Level 0 lessons come from an older seed, not from the framework. Resources, broken-link checking and subject-expert review have not been done. The WATCH → DO → EXPERIMENT → SHOW → GET ASSESSED model is built into the mission schema (steps, experiment challenge, submission requirements, rubric); it is untested on real content because the drafts are unpublished.

## 5. Assessment engine and AI (Workstream E)
- **No AI integration exists.** There is no DeepSeek (or any other provider) code, configuration, schema validation, retry or prompt handling in the repository.
- **No evidence inspection.** The server never reads a repository, live website, screenshot or design file. It stores uploaded files after content checks and secret detection. There is no outbound fetch from the server.
- Scoring is by the learner (`assessSubmission`: one transaction, scores, corrections, XP once, skills, evidence marked verified) and optionally by a human reviewer (claim, score, release, audited access).
- Present: structured criterion scoring, resubmission, feedback and corrections, audit log for reviewer evidence access, rate limits.
- Not present: AI-assisted scoring, confidence, escalation rules, idempotent external calls, provenance of AI results, technical verification (repo, site, Lighthouse), Figma handling, prompt-injection defences (no AI to attack yet).
- Learner code is never executed on the app server; no execution feature exists.

## 6. Personalisation and timetable (Workstream D)
Verified by tests: study-day and capacity maths, session placement, no overlaps, reserved review/catch-up/checkpoint time, prerequisite order, manual move, automatic rebalance, missed sessions kept immutable with linked catch-ups, pause/resume, plan versions on change. Timezone: the plan stores an IANA zone; `Africa/Accra` is UTC+0 with no daylight saving and is the default. A non-existent local time resolves one hour earlier and an ambiguous one to the first occurrence; tests cover a New York day crossing and the spring-forward gap (`availability.test.ts`). Reminder instants follow the reminder settings' timezone, with the plan keeping a snapshot.
Gaps: no reschedule or availability controls inside the wizard-confirmed dashboard (they live under `/timetable`); assessment-driven schedule adjustment is limited to baseline placement; the weekly milestone and objectives are generated text, not curriculum-authored; capacity vs content shortfall is reported but with 18 lessons almost any plan under-fills.

## 7. UI and experience (Workstream H)
Not visually re-inspected in this audit. From code: the wizard is a six-step guided flow with progress chips, programme cards, trade-off text and a review step; labels and `aria` attributes are present on controls; no automated accessibility or mobile test exists. Items to verify: mobile layout of programme cards and the review lists, keyboard order, focus after step changes, loading states during plan build, whether navigation links such as `/calendar` and `/businessos` in `src/lib/navigation.ts` point at routes that exist (they do not appear in the route list). No full redesign is indicated by the evidence.

## 8. Performance and reliability (Workstream J)
No measurements were taken. Known risks: Neon cold start (one transaction timeout seen), dashboard performs several sequential queries and legacy generation on every load, plan generation up to 1200 items in one request, no caching or pagination review, no load test, no error monitoring. Build: 41 static pages generated in 5.7 s, compile 5.2 s (audit machine).

## 9. Database (Workstream G)
64 models, 19 applied migrations, all additive in the recent history. Ownership is enforced in queries and by composite unique keys (`@@unique([id, userId])` patterns). Production schema is in sync with the code. Risks: six profile-less users; `LearnerMode` default is PERSONALISED while older accounts were backfilled to LEGACY; no scheduled backups; cascade delete behaviour is exercised only by the privacy deletion tests; `pg` SSL mode warning.

## 10. What is complete, partial, missing
Complete and verified: registration, sign-in, sessions, onboarding server logic and gate, plan generation/review/confirmation, timetable and rescheduling logic, evidence upload and access control, self-assessment, human review, personal activities, privacy export/deletion, reminder engine (code), cPanel deployment, Neon migrations.
Partial: dashboard for personalised learners, baselines, curriculum (pilot drafts only), resources, reminders in production, profiles, reviewer tooling.
Missing: landing page, password reset and email verification, AI and automated assessment, evidence inspection, achievements, graphic design programme, content for seven programmes, backups, monitoring, CI, browser end-to-end tests.
