# Friday readiness report: product gap closure sprint

Date: 2026-11-18 (prepared for the review on Friday 20 November 2026). Branch: `feature/friday-sprint` (from master `b35f81d`). **Not deployed. No production migration. No schema change.**

## 1. Executive summary
- **The assessment-resource gap is fixed.** Root cause: the mission page showed approved resources, but the assessment page (before and after an attempt) never loaded them. It now shows "Prepare for this assessment" before an attempt and "Before you resubmit" after a revise or fail, with a plain "Video resource not yet available" notice when there is none. Verified in a browser.
- **The approved-resource catalogue is still empty (0 resources in production).** That is a content gap, not a code gap, and no video was invented. Until a reviewer approves real resources, learners see the honest notice. Admins now see a live list of every published mission without an approved primary resource.
- The learner home now has a Continue card, an Assessments panel, this week's planned versus done sessions, and skills. A shared animation system (one engine, four intensities) now covers the homepage, sign-in, onboarding and all signed-in pages.
- **The weighted readiness score is 65%, unchanged from the baseline.** 90% is not achievable safely: the remaining gap is content, real-provider verification of AI assessment, browser end-to-end tests and live verification, none of which can be closed by code alone before Friday. See section 3.

## 2. Phase 0: baseline and root cause
| Question | Finding (evidence) |
|---|---|
| Are resources rendered before an attempt? | Yes on the mission page (`src/app/(app)/missions/[code]/page.tsx` uses `getMissionWatch` and `WatchPanel`, with an honest empty state). |
| On the assessment page? | **No** (cause A). `src/app/(app)/assessments/[id]/page.tsx` did not import either. |
| Are resources linked to assessment-bearing missions? | No (cause B/D): production has 0 `LearningResource` rows; `prisma/curriculum/resources.ts` is intentionally empty. Draft, rejected and archived resources are correctly hidden (cause C holds as designed). |
| Is loading or ownership broken (cause E)? | No. `getMissionWatch` returns approved resources only, primary first, with the caller's own advisory state; tests confirm another learner's state is not shown. |
| Is a schema change needed? | No. `LearningResource`, `MissionResource` and the approval status are sufficient. Mapping a resource to an individual rubric criterion would need a new link table; it was **not built** (see section 8). |

## 3. Weighted readiness (evidence-backed)
Scoring: 0 absent, 0.25 scaffold, 0.5 partial, 0.75 functional but incomplete or insufficiently tested, 1.0 implemented and verified.
| Category | Weight | Baseline | Final | Evidence and what holds it back |
|---|---:|---:|---:|---|
| Core learner journeys (registration, onboarding, enrolment) | 15% | 0.75 | 0.75 | Server logic and live gate tested; no browser end-to-end test, wizard not driven by a test browser |
| Course catalogue, syllabus, learning resources | 15% | 0.50 | 0.50 | 18 published lessons; 0 approved resources; framework drafts unpublished. Rendering is now correct but there is nothing to render |
| Dashboard, navigation, timetable | 15% | 0.75 | 0.75 | Home and timetable work, checked in a local production build at 1280 px and 375 px; not yet deployed or seen live |
| Missions, evidence, assessment workflow | 20% | 0.75 | 0.75 | Workflow tested; resources now on the assessment page; no browser end-to-end test |
| AI assessment, feedback, remediation | 10% | 0.50 | 0.50 | Built and tested with a fake provider; **never called against the real DeepSeek API**; remediation is mission-level, not per criterion |
| Progress, mastery, portfolio | 10% | 0.50 | 0.50 | Reviewer-confirmed credit works; no mastery percentage by design; portfolio exists |
| Security, privacy, data integrity | 10% | 0.75 | 0.75 | Credentials rotated, CSP and HSTS live, limited database role; password reset and external review still open |
| QA, operations, deployment | 5% | 0.50 | 0.50 | Cron and heartbeat live; no CI gate, no browser tests, no monitoring |
| **Weighted total** | 100% | **65.0%** | **65.0%** | Baseline and final both = 0.15×0.75 + 0.15×0.5 + 0.15×0.75 + 0.20×0.75 + 0.10×0.5 + 0.10×0.5 + 0.10×0.75 + 0.05×0.5 |
The score did not move because the rubric credits only verified completion. This sprint made real improvements inside categories that were already "functional but incomplete"; none of them reached "verified against acceptance criteria" because browser end-to-end tests, live verification and real content are still missing. I have not raised any score without that evidence.
**Counts:** verified complete (code and automated tests): assessment-resource rendering and gap list, enrolled-only departments, home data, animation rules. Implemented but unverified live: everything in this branch. Blocked by missing content or credentials: approved videos (reviewer approval), real DeepSeek use (key). Deferred: criterion-to-resource mapping, Playwright tests, per-course pause or withdraw.

## 4. Competitor benchmark (patterns, not copies)
| Area | Reference pattern | JOKZET decision |
|---|---|---|
| Dashboard hierarchy | Khan: dashboard as home base with a learning queue; Codecademy: resume the latest course and weekly targets | **Adopt:** Continue card first, then Today, week strip, this week's goal |
| Navigation and discovery | Coursera: My Learning separate from discovery | **Adopt (already built):** Departments shows enrolled courses only; Explore Courses is separate |
| Course overview and syllabus | Pluralsight: paths by level | **Postpone:** needs approved curriculum first |
| Lesson and video | Pluralsight: video with hands-on labs | **Adapt:** WATCH panel on mission and assessment pages; labs rejected (no code execution on the server) |
| Assessment preparation | Coursera: duration, grading and retake rules visible up front | **Adopt:** pass threshold and rubric on the mission page, preparation resources on the assessment page; retake rules not configured, so none shown |
| Feedback | Khan: recommendations after practice | **Adapt:** resources reappear on a revise or fail result; per-criterion mapping postponed |
| Skill mastery | Khan: mastery per skill | **Adapt cautiously:** counts only reviewer-confirmed skills; no mastery percentage from mission completion |
| Projects and portfolio | freeCodeCamp: required projects, public work | **Postpone** public sharing |
| Mobile and accessibility | all | **Adopt:** checked at 375 px, labelled progress bars, headings and landmarks |
No competitor text, branding or layout was copied.

## 5. What was built
**Phase 1: assessment resources.** `PreparePanel` (`src/components/assessments/prepare-panel.tsx`) on the assessment page, before an attempt and again for review and resubmission; reuses `getMissionWatch` and `WatchPanel` (new `heading` prop; "Optional" label on supplementary resources). `listContentGaps` (`src/lib/resources/gaps.ts`) feeds an admin-only "Content gaps" panel on `/review`. Resource engagement stays advisory (a test proves watching or completing a video awards no XP, pass or mastery).
**Phase 2: learner home** (`src/lib/plan/home.ts`, `src/components/home/learner-home.tsx`): Continue card (revision, then in-progress, then next session), Assessments panel (waiting, to revise, next checkpoint, recent results labelled self-assessed, AI-assessed, waiting for a reviewer or confirmed), weekly planned versus done sessions and minutes (planned time is separate from done time), skills to work on from real weakness tags with the count of reviewer-confirmed skills. Only enrolled courses appear. The original Command page remains for other learners.
**Phase 3 (partial):** assessment brief and rubric were already on the mission page; remediation resources appear on revise or fail. No per-criterion mapping.
**Phase 4: animation.** One engine (`src/components/home/background-doodles.tsx`, `doodles.css`) with intensity set per route by `RouteAtmosphere` (`src/lib/atmosphere.ts`). Page entrance via `template.tsx` in `(app)` and `(account)`.
| Area | Intensity | Doodles visible (desktop) |
|---|---|---|
| Public homepage `/welcome` | rich | 20 plus gradients and 6 particles |
| Dashboard `/`, sign-in, register | medium | 13 |
| Departments, courses, missions, timetable, portfolio, onboarding and other pages | low | 6 |
| Assessments, review, evidence, settings, privacy | minimal | 3, slower and fainter |
Phones: fewer doodles and no particles. Reduced motion: every continuous animation stops. Doodles are `aria-hidden`, never take pointer events and sit behind content (`z-index: -1` in the app). Not applied: a separate light treatment for the reviewer or admin areas beyond the "minimal" level they already share with assessments.

## 6. Resources
**No resource was added.** `prisma/curriculum/resources.ts` stays empty: approving a resource needs a named reviewer who has opened it, and the owner has not approved any. Nothing was invented or marked verified. The Content gaps panel lists the 18 published missions that currently have no approved primary resource.

## 7. Checks actually performed
- Browser (local production build, throwaway two-course learner, deleted afterwards): `/welcome`, `/login` and the signed-in dashboard at 1280 px; the dashboard and assessment page at 375 px: no horizontal overflow, assessment page shows "Prepare for this assessment" with a fixture resource (start here, duration, provider, external "Open" link), minimal atmosphere there, medium on the dashboard, rich on the homepage. Console: no hydration errors; 401 messages seen were from a stale session before sign-in, and `/api/notifications/pending` returned 200 afterwards.
- Automated: see section 9 for the full-suite result. New tests: `assessment-resources` (9), `learner-home` (12), `homepage` (15, including 5 for the animation system).
- **Not performed:** Playwright or any automated browser test; a tablet width; reduced-motion in a live browser (CSS rule and test only); a real screen-reader pass; live-site verification; AI assessment against the real provider.

## 8. Limitations and not done
Criterion-to-resource mapping (needs a link table and content); per-course syllabus page, pause and withdraw; Playwright end-to-end tests; approved videos; public portfolio sharing; the sidebar's original level and XP summary is unchanged; reviewer and admin areas share the "minimal" background rather than a separate setting; production deployment.

## 9. Test and build results
Final full run on branch `feature/friday-sprint`, 2026-11-18:
- `npx eslint src tests`: clean.
- `npx tsc --noEmit`: clean.
- `npx vitest run` (real local test database): 45 files, **609 tests, 609 passed, 0 failed, 0 skipped**.
- `npm run build`: exit 0, "Compiled successfully".
These results are local only. Nothing has been deployed or verified on the live site.
