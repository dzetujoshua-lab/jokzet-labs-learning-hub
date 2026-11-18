# Enrolled courses, add-a-course and AI assessment: implementation and deployment report

Date: 2026-11-18. Branch: `feature/enrolment-and-assessment` (from master `23d10a7`). **Not merged, not deployed, no production migration run.**

## 1. What was built
| Area | State |
|---|---|
| Departments shows only enrolled courses | Built and tested. Server-side: `listDepartments` (src/lib/missions/service.ts) filters by the signed-in learner's own enrolments (`visibleDepartmentIds`, src/lib/enrolment/service.ts). Every page that lists departments, and the department detail page, goes through it, so a department the learner is not in is simply absent (detail returns 404). The original fixed programme (LEGACY mode, or no profile) is built around all nine departments and keeps showing them. |
| One initial course | Built (merged earlier in PR 34): the server action refuses anything but exactly one course. Confirming the plan creates the enrolment. |
| Explore Courses / Add a Course | Built: `/courses` (catalogue of published, enrolable courses not already taken), a preview step, then an explicit confirm. Actions take the learner from the session. |
| Add a course to the unified timetable | Built and tested (`addCourse`, `previewAddCourse` in src/lib/plan/service.ts, generator `occupied` seats in src/lib/plan/generate.ts). The new course's sessions are placed only in seats the learner's other courses leave free; teaching, checkpoint, baseline, catch-up, started, done and missed sessions are never moved; spare planned practice/review sessions may give up their seat (cancelled, never deleted, recorded in the plan history, and the preview says how many). If the whole approved course does not fit, nothing is written. Retries and races are safe (request key, one live enrolment per learner and course enforced by a partial unique index). |
| Course-specific syllabus | Partly. Each course's sessions come from its published curriculum and carry the department and mission, so each course has its own sequence and progress. There is no separate syllabus page per course yet. |
| Resources and videos | The data model, validation and display already existed. `prisma/curriculum/resources.ts` is still **empty** (checked): no resource has been verified, none was invented. The catalogue shows honestly "learning videos not added yet". Resource curation by a human reviewer is the remaining work. |
| Per-course pause, resume, withdraw | Not built. The enrolment table has the states and the Departments filter respects them (withdrawn courses are hidden, history kept). |
| DeepSeek assessment | Built and tested with a fake provider (no network, no key). See section 3. **Disabled** until the owner configures it. |
| Course-specific syllabus view, per-course timetable filter, learner home by course | Not built. |

## 2. Database changes (additive only)
| Migration | Contents | Applied where |
|---|---|---|
| `20261127090000_course_enrolments` | enum `EnrolmentStatus`; table `CourseEnrolment` with composite owner key, per-request idempotency key, partial unique index (one ACTIVE or PAUSED enrolment per learner and course); backfill of enrolments from existing ACTIVE or PAUSED plans (production has 2 active plans) | Local test database and local development database only |
| `20261127100000_assessment_jobs` | enum `AssessmentJobStatus`; table `AssessmentJob` (one per submission, frozen rubric snapshot, attempts, retry time, lock, model and prompt version, short error code, escalation reason, confidence, result, token counts); `AssessmentStatus` gains `AI_ASSESSED` | Local test database and local development database only |
Nothing was run against Neon. Before production: take a Neon restore point, rehearse both migrations on a branch copy of production, compare the backfill count (expected 2 enrolments for the current 2 active plans, plus any plans confirmed since), then `prisma migrate deploy` with the owner's approval. **Rollback:** both migrations only add objects; stop using the new tables and leave them. The `AI_ASSESSED` enum value cannot be removed once added, which is harmless.
Privacy: `CourseEnrolment` and `AssessmentJob` were added to the data-export specification, so export and account deletion cover them (deletion cascades from the user).

## 3. How an assessment runs
1. The learner submits. In the same transaction the submission and its evidence are stored and, when AI assessment is enabled and the learner is under their daily limit, one `AssessmentJob` is created (the rubric is frozen into it). Nothing has gone to the provider yet.
2. After the response is sent (`after()`), and again from the cron call to `/api/cron/dispatch` (the reminders cron is not installed on the server yet), a worker claims the job (atomic claim; a second worker gets nothing). A job whose worker died is reclaimed after 10 minutes.
3. The worker builds the evidence package from this learner's own submission only: written explanation, written notes, text and code files (size-capped), and images only for a model that can see. Anything that looks like a secret is withheld. Links are listed but are **not fetched or inspected**; PDFs and videos are not inspected.
4. It calls the provider (timeout, bounded retries with growing delay) and validates the JSON strictly: exact criterion ids, no duplicates or missing ones, scores within bounds, totals and percentage and pass/fail consistent with the rubric, evidence references that exist, confidence in range, no extra fields. Anything else is rejected and retried, then goes to a human. No score is ever invented.
5. A valid result is stored once, in one transaction, as an assessment marked `AUTOMATED` / `AI_ASSESSED`, with per-criterion scores and feedback. Low confidence, or only links submitted, creates a human review request instead of leaving it as an AI result.
6. **Credit:** an AI result is formative, like a self-assessment. It awards no official XP or skills. A reviewer's confirmation does, once. This is the supervised-beta policy; AI-only credit needs the owner's decision.
7. The learner sees the status steps (queued, reviewing evidence, AI assessment, result), then the score, per-criterion points and feedback, strengths, improvements, next steps, the AI's stated limits, its confidence, and that it is AI-assessed and not yet confirmed. Self-assessment is blocked only while the AI owns the submission; if it fails or hands over, the learner can score themselves (labelled self-assessed) or ask a reviewer.

## 4. DeepSeek: verified facts and configuration
Verified from the official documentation at https://api-docs.deepseek.com on 2026-11-18 (pages: pricing, create chat completion, list models, JSON output, vision, error codes, rate limits):
- Base URL `https://api.deepseek.com`; endpoint `POST /chat/completions`; `Authorization: Bearer <key>`.
- Model identifiers accepted: **`deepseek-flash`** (text and image input) and **`deepseek-v4-pro`** (text only). The older `deepseek-v4-flash` still works but is retired.
- JSON mode: `response_format: {"type":"json_object"}`; the prompt must contain the word "json" and an example; blank content can come back and should be retried. Output is cut with `finish_reason: "length"`.
- Rate limit is a per-account concurrency limit (HTTP 429); 500/503 should be retried after a short wait.
| Variable | Purpose | Configured in this work |
|---|---|---|
| `DEEPSEEK_ENABLED` | owner kill switch; must be exactly `true` | not set (disabled) |
| `DEEPSEEK_API_KEY` | secret, server only, never logged or sent to the browser | not set |
| `DEEPSEEK_BASE_URL` | default `https://api.deepseek.com`; must be https | default |
| `DEEPSEEK_ASSESSMENT_MODEL` | default `deepseek-flash` | default |
| `DEEPSEEK_ADVANCED_MODEL` | optional; `deepseek-v4-pro`, used only for large text-only evidence | not set |
| `DEEPSEEK_TIMEOUT_MS`, `DEEPSEEK_MAX_ATTEMPTS`, `DEEPSEEK_USER_DAILY_LIMIT`, `DEEPSEEK_GLOBAL_DAILY_LIMIT`, `DEEPSEEK_MIN_CONFIDENCE`, `DEEPSEEK_MAX_OUTPUT_TOKENS` | tuning and spend limits (defaults 90 s, 3, 10, 200, 0.6, 4000) | defaults |
The real network adapter is unit-tested against mocked responses only. **It has never been called against DeepSeek**, because no key exists. First real use needs: the owner sets the key in the cPanel environment (typed there, never in chat), a test submission, and a look at the result before turning it on for learners.

## 5. Known limits and remaining work
- AI assessment inspects only what is stored in the Academy: text, code and (with `deepseek-flash`) images. Repositories, live sites, Figma, PDFs and video are not inspected; a link alone sends the work to a reviewer.
- The prompt is not yet calibrated against real learner work and real DeepSeek behaviour; agreement with human reviewers should be measured before any AI-only credit.
- Reviewers must be able to see AI-escalated work: it appears in the existing review queue through a review request.
- Per-course pause/resume/withdraw, a per-course syllabus page, per-course timetable filter and the learner home by course are not built.
- No browser end-to-end tests exist for the new journeys.
- Curriculum is still 2 lessons per department; videos are not curated.
