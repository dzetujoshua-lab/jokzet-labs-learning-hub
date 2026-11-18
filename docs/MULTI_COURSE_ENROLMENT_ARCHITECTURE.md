# Multi-Course Enrolment Architecture (design for owner approval)

Date: 2026-11-18. Status: **DESIGN ONLY. No schema change, migration or enrolment code exists yet.** It needs the owner's approval before any build, because it changes the data model and adds learner-facing screens (which need design approval).

## 1. Product rule (from the owner's brief)
- Onboarding enrols the learner in **one initial course** only. It then generates that course's syllabus and timetable from approved, published curriculum and the learner reviews and confirms.
- The learner can **add another course at any time** through an explicit action (Explore Courses / Add a Course). Adding a course reuses the learner's profile, timezone and availability, creates a separate syllabus and progress for that course, adds its sessions to one unified timetable, and never touches the other course's plan, history or progress.
- The learning area shows only enrolled courses. The catalogue shows what can be joined. Unpublished or unapproved courses are never offered.
- Lifecycle: AVAILABLE (catalogue), then ENROLLED/ACTIVE, PAUSED, COMPLETED, WITHDRAWN, with history kept.

## 2. What exists today (verified in `prisma/schema.prisma` and `src/lib/plan/*`)
| Question | Answer from the code |
|---|---|
| Course = ? | A `Department` (nine rows: `fswd`, `uxui`, `sec`, `cloud`, `sysadmin`, `ai`, `photo`, `video`, `biz`). There is no separate "course" or "enrolment" entity. |
| How is a chosen course stored? | `LearningGoal(planId, userId, departmentId, weight, targetLevel, note)`, unique per `(planId, departmentId)`. |
| One plan or many per learner? | **One.** `LearningPlan.activeKey` and `draftKey` are unique, set to the user id, so a user has at most one ACTIVE and one DRAFT plan. A plan can contain several goals (courses) and one set of availability. |
| Where does availability live? | On the plan: `weekdays`, `startTime`, `sessionMinutes`, `dailyStudyMinutes`, `breakMinutes`, `flexibility`, `autoReschedule`, `timezone`. The timezone authority for reminders is `ReminderSettings.timezone`; `Profile.timezone` also exists. |
| Is each session tied to a course? | `LearningPlanItem` carries `departmentId` and `missionId`, but there is no enrolment identity that outlives a plan version. |
| Can a course be added later? | The service `changeSubjects` (`src/lib/plan/service.ts`) builds a **successor plan** (old plan SUPERSEDED, future planned sessions cancelled, completed and missed history kept, `parentPlanId` chain). **No screen calls it.** There is no add-course UI. |
| Pause or withdraw one course? | Only the whole plan can be paused (`pausePlan`/`resumePlan`). There is no per-course pause or withdrawal. |
| Idempotency | `generateDraft` is idempotent by input hash; one ACTIVE plan by unique key; `confirmPlan` tested for double-click. |
| Do progress, XP, submissions and reviews link to the right course? | They link to `Mission → Department`, so progress and reviewer scope are already per course. Reminders follow plan items. |
| Curriculum versioning | A plan stores `catalogVersion` (hash of the published catalogue); rubrics are versioned and assessments keep a rubric snapshot. Missions are not versioned: editing a published mission changes it for everyone (see section 7). |

So the current model supports **several courses inside one plan**, not several independent enrolments. Creating a second `LearningPlan` row per course is not enough: the unique `activeKey` forbids it, availability would be duplicated, and nothing would stop two plans booking the same hour.

## 3. Recommended design: one learner schedule, first-class course enrolments
Keep **one learner schedule** (the existing `LearningPlan` as the container of shared availability and the unified timetable) and make a course a **first-class enrolment** inside it. This keeps one authoritative timezone and one capacity, makes conflicts impossible by construction, and avoids dual sources of truth.

### New table `CourseEnrolment` (additive)
| Field | Purpose |
|---|---|
| `id` | primary key |
| `userId` | owner (cascade on user delete, as everything else) |
| `departmentId` | the course (course = department today; a later `Course` table can wrap it without breaking this) |
| `status` | enum `EnrolmentStatus`: `ACTIVE`, `PAUSED`, `COMPLETED`, `WITHDRAWN` (AVAILABLE is a catalogue state, not a per-learner row) |
| `enrolledAt`, `pausedAt`, `completedAt`, `withdrawnAt` | lifecycle history |
| `targetLevel`, `note`, `weight` | moved from the goal (same meaning) |
| `startDate`, `endDate`, `durationKind`, `durationDays` | per-course duration (a second course may be shorter or longer than the first) |
| `curriculumVersion` | catalogue version hash when the syllabus was generated |
| `experience` | the learner's stated level for this course |
| `idempotencyKey` | unique per user and request, so a retry returns the same enrolment |
Constraints: `@@unique([id, userId])` (composite ownership key, like the existing plan), `@@unique([userId, departmentId])` where `status` is `ACTIVE` or `PAUSED` (partial unique index in the migration SQL, so a learner cannot hold two live enrolments in one course but may re-enrol after WITHDRAWN or COMPLETED), index on `(userId, status)`.
Existing `LearningGoal` rows stay as the per-plan-version record of what was planned; they gain a nullable `enrolmentId` so successive plan versions point at the same enrolment.
`LearningPlanItem` gains nullable `enrolmentId` with a composite foreign key `(enrolmentId, userId)` to `CourseEnrolment(id, userId)`, so a session can never reference another learner's enrolment.

This is the smallest addition that justifies a new table: the **identity of "this learner's enrolment in this course" must survive plan versions** (extend, change subjects, pause), which neither `LearningGoal` (per plan version) nor `LearningPlan` (one per learner) can provide.

### Plan generation per course
- First course (onboarding): as today, but with exactly one goal; creates the enrolment, the draft plan and its sessions; the learner reviews and confirms.
- Added course: a new function (proposed `addCourse(userId, request)`) that
  1. validates the course is published and has approved curriculum and required resources (otherwise it is not offered);
  2. loads the existing plan and its **occupied seats** (date and slot already used by planned, started, missed or completed sessions of any course);
  3. runs the generator **only for the new course** against the free seats from the chosen start date, using the shared availability, honouring prerequisites within that course;
  4. returns a **preview** (sessions, finish date, whether it fits) without writing anything;
  5. on explicit confirmation, writes the new enrolment and its items in one transaction, records a `LearningPlanEvent`, and leaves every existing item untouched.
- If it does not fit: explain the shortfall and offer, in order, more study time, more study days, a longer duration, or a later start. A rebalance that moves existing planned sessions must show a before/after preview and needs a separate confirmation; completed, started, submitted or assessed work is never moved (the existing reschedule rules already protect these).
- The generator change needed: accept a set of pre-occupied seats and a single-course goal; the current seat logic (`seatsFor`, `sessionsPerDay` in `src/lib/plan/availability.ts`) is reusable.

### Unified timetable
Already unified within a plan: one list of `LearningPlanItem` rows keyed by `(date, slotIndex)`, rendered at `/timetable`. Because added-course sessions are generated against free seats of the same plan, overlap is impossible. Add a unique index on `(planId, date, slotIndex)` for non-cancelled items as a database guard (check existing data first; additive, rehearsed on a branch).

### Pause, resume, withdraw, complete (per course)
- Pause: set enrolment `PAUSED`; cancel that course's future PLANNED items from the pause date (history kept, as `pausePlan` does for the whole plan); frees seats.
- Resume: regenerate that course's remaining sessions into free seats from today; never duplicate completed ones (idempotent by input hash).
- Withdraw: set `WITHDRAWN`, cancel future planned items; submissions, assessments, reviews and XP stay.
- Complete: set `COMPLETED` only when the approved completion rule for that course is met; other courses unaffected.
- The whole-plan pause stays as "pause everything".

### Reminders and notifications
Reminders already derive from plan items; with `enrolmentId` on items, notifications can name the course and deep-link to the right session. `ReminderSettings.timezone` remains the single live timezone authority (matching the audited design).

### Baseline per course
`BaselineAssessment` is per `(planId, departmentId)` today; keep it, keyed to the enrolment when a course needs one. A baseline never awards XP or mastery (unchanged).

## 4. Course catalogue and learner screens (new; need design approval)
- **Explore Courses / Add a Course**: lists only published courses with approved curriculum and resources, excluding those already enrolled; each card shows description, prerequisites, expected duration, workload and outcomes (the onboarding already has this copy in `src/lib/plan/programme-info.ts`).
- **Add flow**: course detail, workload impact ("you now study X hours a week"), start date and duration, preview, confirm.
- **Learner home**: one card per enrolled course (progress, next session, milestone) plus today's combined sessions.
- **Course page**: syllabus, learning plan, timetable filter, learning materials, progress.
- Admin and reviewer catalogue views stay separate from the learner's enrolled-course view.
No screen is built until the owner approves the design.

## 5. Syllabus and resource requirements
- The syllabus comes only from approved, versioned curriculum. If a course has no approved curriculum it is not offered (the app already hides programmes with no published lessons in onboarding; the catalogue must do the same, and must also require resources).
- WATCH resources: a real, reviewed, available link with title, provider, canonical URL, type, duration if known, language, topic and accessibility notes, who verified it and when; link re-checks on a schedule; embed only approved HTTPS hosts with a "open in a new tab" fallback; nothing invented. The resource tables exist (`LearningResource`, `MissionResource`, `ResourceReview`); the catalogue file `prisma/curriculum/resources.ts` is intentionally empty today (0 resources in production).
- A mission without its required resource is incomplete and is kept out of the learner syllabus until the content owner resolves it.
- AI may help explain or personalise; it must not invent topics, outcomes, rubrics or prerequisites.

## 6. Migration and backfill (not run, not written)
1. Additive migration: create `EnrolmentStatus` and `CourseEnrolment`; add nullable `enrolmentId` to `LearningGoal` and `LearningPlanItem` with composite foreign keys; add the partial unique index.
2. Backfill (read-only counts first, then an approved script): for each ACTIVE or PAUSED plan (2 ACTIVE today), create one enrolment per goal, copy weight, target level and plan dates, set `enrolmentId` on goals and on items matching the goal's department; DRAFT plans backfill at confirmation.
3. After verification, make `enrolmentId` required for new rows in application code (keep the column nullable for history).
4. Legacy learners (`LearnerMode LEGACY`, 4 production profiles) and the six profile-less users have no plan; they get no enrolments and are not forced into onboarding.
**Rollback:** all changes are additive; stop reading the new columns and leave them; Neon restore point taken first; rehearse on a Neon branch copy of production before any production run.

## 7. Versioning and integrity
- Add a content version to published missions (proposed, part of the publishing pipeline S3-02) so that editing a mission creates a new version and learner work stays tied to the version they used. A plan or enrolment records the catalogue version it was generated from; if the catalogue changes later the learner is told and chooses whether to refresh (the plan already flags `catalogOutdated`).
- All writes scoped by the authenticated `userId`; every identifier from the browser (course, enrolment, plan, session) re-checked server side; composite foreign keys prevent cross-user links.
- Idempotency: unique `(userId, idempotencyKey)`, one live enrolment per `(userId, departmentId)`, and a per-user advisory lock in the transaction so concurrent requests cannot create duplicates.
- Official credit follows the beta policy: self-assessment is formative; only a reviewer's confirmation awards XP and skills (implemented in this change set), tied to the learner, mission and rubric version.

## 8. Test matrix (to be written with the build)
First course: exactly one selectable; other courses not shown as enrolled; syllabus linked to the enrolment; timetable respects availability, duration, timezone, capacity; resources present; retry creates nothing new.
Second course: separate enrolment and syllabus; existing items byte-for-byte unchanged; no overlap; capacity warning and adjustment flow; concurrent double submit creates one enrolment; baseline scoped to the new course; reminders point to the right session.
Lifecycle: pause preserves progress; resume does not duplicate; withdraw keeps assessed work; completing one does not complete another; a third course changes neither existing one.
Security: learner A cannot read, add, pause or withdraw learner B's enrolment; cannot attach a submission across learners or courses; reviewer scope unchanged; unpublished courses and unapproved resources not exposed by learner APIs.
Regression: legacy learners unchanged; existing single-course learners not re-onboarded; privacy export and deletion include enrolments; rescheduling, catch-up, reminders, reviews unchanged.

## 9. Effort (planning range, engineering days, one developer; no calendar promised)
| Item | Range | Confidence |
|---|---|---|
| Schema, migration, backfill script, rehearsal | 3 to 5 | Medium |
| Generator support for occupied seats and per-course generation | 3 to 5 | Medium |
| `addCourse` preview and confirm, idempotency, capacity advice | 4 to 6 | Medium |
| Per-course pause, resume, withdraw, complete | 3 to 4 | Medium |
| Catalogue, add-course screens, course pages, learner home by course | 6 to 9 | Low until designs exist |
| Tests (service, security matrix, E2E for the second course) | 4 to 6 | Medium |
| **Total added by the multi-course requirement** | **about 23 to 35** | Medium to low |
This is **in addition to** the earlier supervised-beta estimate of about 47 days, so the beta estimate becomes roughly 65 to 80 engineering days if multi-course is in the beta scope. Expert content review (15 to 25 days for the two pilot programmes) is separate and runs in parallel. These are ranges, not commitments.

## 10. Options to decide
- **Option A (recommended above):** one schedule, `CourseEnrolment` table, incremental per-course generation. Smallest change, keeps conflicts impossible.
- **Option B:** an independent plan per course (drop the one-active-plan constraint, per-course `activeKey`). Larger and riskier: duplicated availability, cross-plan conflict detection, more places to go wrong.
- **Option C (beta shortcut):** a beta without add-course; learners get one course and the owner adds a second by hand through the existing `changeSubjects` successor-plan function. Cheapest, but not the stated product.
The owner decides; none is approved yet.

## 11. Current state of this branch
The code on branch `feature/p0-integrity-and-access` already enforces **exactly one course in onboarding** (server action and wizard). It does **not** add the Add-a-Course flow or any schema change. Until that flow exists, a learner who finishes onboarding has one course and no screen to add another.
