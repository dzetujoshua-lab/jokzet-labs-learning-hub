# Remaining Development Phases: JOKZET Labs Academy

Report date: 2026-11-18. Application: `jokzet-command-center/`. Production: https://jokzet-labs.iipghstudent.com (cPanel) with the existing Neon database. The original Base44 app at the repository root is out of scope and must not be touched.
Companion reports: `SECURITY_AUDIT_REPORT.md` (finding IDs `SEC-nn` are referenced below), `COMPREHENSIVE_PLATFORM_AUDIT.md`, `PRODUCTION_READINESS_SCORECARD.md`, `QA_AND_TEST_RESULTS.md`, `PRODUCTION_LAUNCH_CHECKLIST.md`, `EXECUTIVE_SUMMARY.md`.
This is a plan. Nothing in it has been implemented, approved or scheduled.

## 1. Current baseline
| Item | Fact |
|---|---|
| Audited commit | `738ae0f` (master). Current HEAD `e86edc0` adds documentation only; `git diff 738ae0f HEAD -- jokzet-command-center` is empty, so no audit finding changed because of code drift. |
| Verification | `npx eslint` exit 0; `npx tsc --noEmit` exit 0; `npx vitest run` 37 files, 523 of 523 passed; `npm run build` exit 0 (2026-11-18). |
| Live | Release `cpanel-20261116-173147-738ae0f` on cPanel; `/api/health` reports database up; sign-up redirects to `/onboarding`; private pages and APIs refuse unfinished learners. |
| Database | 19 migrations applied, schema in sync. Production aggregate counts: 14 users, 8 profiles (6 users have none), 2 active plans, 1 draft, 2 submissions, 1 assessment, 18 published lessons (2 per department), 0 resources. |
| Corrections to the earlier audit | The credential is not in Git history or the frontend bundle (SEC-01). Production serves `X-Frame-Options: SAMEORIGIN`, the code says DENY (SEC-07). Self-assessment is labelled `SELF`/`SELF_RECORDED`, skills `SELF_ASSESSED` (SEC-04). Custom missions have no creation limit (SEC-05). The effort estimate was revised upward (section 7). |
| Pilot programmes | Full-Stack Web Development (`fswd`) and Business and Entrepreneurship (`biz`), Levels 0 and 1, with the shared core modules they depend on. 71 mission drafts, all status DRAFT, in `prisma/curriculum/framework/missions/` (fswd 24, biz 26, shared 21 across L0 and L1). They are **not imported by the app or the seed**: only the 18 older Level 0 lessons in `prisma/curriculum/level0.ts` are published. |
| Local-only notes cited | `docs/NEON_CONNECTION_REPORT.md` (excluded from Git on purpose), `docs/CPANEL_DEPLOYMENT_REPORT.md` and `docs/ROLLBACK_PLAN.md` (untracked, not in the repository yet). Line numbers refer to the owner's local copies. |
| Resource catalogue | `prisma/curriculum/resources.ts` is intentionally empty; no link has been verified. |

Priority scale: **P0** blocks the supervised beta; **P1** blocks the general public launch; **P2** important after launch; **P3** future vision. Status values: COMPLETE, PARTIAL, NOT STARTED, BLOCKED, NEEDS VERIFICATION. Effort is engineering days for one experienced developer, excluding expert content review and owner decision time, which are stated separately.

## 2. Release scopes
- **Supervised beta:** named testers (suggested 10 to 30), two pilot programmes to Level 1, self-assessed credit clearly labelled, reviewer-confirmed credit for the pilot, owner-run support, manual onboarding of testers.
- **General public launch:** open registration, recovery by email, enforced security headers, CI gate, monitoring, public landing page, support process.
- **Full Academy vision:** nine programmes by five levels, combined pathways, AI-assisted assessment, evidence inspection, sandboxed code execution, adaptive plans, advanced analytics.

## 3. Delivery stages and phases

### Stage 1: Critical security and data protection

#### S1-01 Rotate the database credential and split roles
- **Priority:** P0. **Status:** NOT STARTED (needs the owner's Neon and cPanel access).
- **Objective:** make any leaked credential useless and stop the app running as database owner.
- **Problem and evidence:** the owner-role password was exposed in working sessions and is unrotated (`docs/NEON_CONNECTION_REPORT.md:51`); not in Git history or the bundle (SEC-01).
- **Tasks:** follow the nine-step procedure in `SECURITY_AUDIT_REPORT.md` section 5; create an application role with data privileges only; keep the owner role for migrations; check Neon connection history; change the disclosed learner password (SEC-02).
- **Files and places:** Neon console; cPanel Node.js App environment variable `DATABASE_URL`; local `.env.neon` (ignored); `prisma.config.ts`, `src/lib/db.ts` (read only).
- **Database changes:** new role and grants; no schema change.
- **Security:** secrets never typed into chat, tickets or Git; verify the old string fails.
- **Dependencies:** none. **Testing:** connection and sign-in smoke test; `prisma migrate status` with the migration role.
- **Acceptance:** old password rejected; `/api/health` up; sign-in and upload work; app role cannot run DDL.
- **Deployment:** environment change plus app restart. **Rollback:** restore the previous working connection string for the app role only if the new grants are wrong; fix grants rather than reverting to the owner role.
- **Effort:** 1 day. **Launch impact:** blocks beta and public launch. **Definition of done:** acceptance met and the rotation recorded in an operations log without secrets.

#### S1-02 Production environment and connection hardening
- **Priority:** P0. **Status:** NEEDS VERIFICATION.
- **Objective:** make rate limiting, TLS and timeouts correct in production.
- **Problem and evidence:** `TRUSTED_PROXY_HOPS` unset, so per-IP limits may trust a spoofable header (SEC-08, `src/lib/ratelimit.ts:33-49`); `sslmode` warning from `pg`; one Prisma transaction timeout (P2028) on a cold Neon branch; `X-Frame-Options` overridden at the edge (SEC-07).
- **Tasks:** determine what LiteSpeed forwards and set `TRUSTED_PROXY_HOPS`; use `sslmode=verify-full`; raise the Prisma transaction wait and the pool connection timeout; locate the header override; add a startup check that fails fast when a required variable is missing (`DATABASE_URL`, `APP_URL`, `CRON_SECRET`, `STORAGE_*`, VAPID keys).
- **Files:** `src/lib/ratelimit.ts`, `src/lib/db.ts`, `next.config.ts`, `deploy/cpanel/env.production.example`, new `src/lib/env.ts` (proposed).
- **Database changes:** none. **Security:** SEC-07, SEC-08. **Dependencies:** S1-01 (same environment edit window).
- **Testing:** unit test for the env validator; a header-trust test in `tests/security-hardening.test.ts` style; manual check from two networks.
- **Acceptance:** the stored session IP equals the real client address and cannot be set by a request header; cold-start sign-in succeeds; missing variable stops startup with a clear message.
- **Deployment:** release plus environment changes. **Rollback:** previous release folder via `switch-release.sh`.
- **Effort:** 1.5 days. **Launch impact:** beta (verify), public (fix). **Definition of done:** acceptance met, headers documented.

#### S1-03 Protect and back up uploaded learner files
- **Priority:** P0. **Status:** NOT STARTED.
- **Objective:** no learner evidence is lost, stranded or unreadable by others.
- **Problem and evidence:** files in `~/jokzet-data/evidence` have no backup (`docs/CPANEL_DEPLOYMENT_REPORT.md:27`, SEC-10); earlier files may sit in Netlify Blobs; storage code in `src/lib/storage/index.ts`.
- **Tasks:** locate or retire Netlify Blobs data; scheduled copy of the folder to storage outside the hosting account (encrypted); a documented restore; confirm directory permissions (not world-readable) and that the folder is outside the web root; reconcile `SubmissionFile` rows against files on disk with a read-only report script.
- **Files:** `src/lib/storage/index.ts`, `scripts/` (new `storage-report.ts`, proposed), `deploy/cpanel/` (new backup script, proposed).
- **Database changes:** none. **Security:** backups encrypted; access limited to the owner; no learner data in logs.
- **Dependencies:** S1-01 for operator access; an external storage location (cost unknown, owner to choose).
- **Testing:** restore drill into an empty folder and download one file through the app; report script test.
- **Acceptance:** a backup exists and is less than 24 hours old; a file restored from it opens; report lists zero missing files.
- **Deployment:** scripts and cPanel cron. **Rollback:** disable the backup cron; no application effect.
- **Effort:** 2 days. **Launch impact:** blocks beta. **Definition of done:** drill recorded.

#### S1-04 Neon backup and recovery procedure
- **Priority:** P0. **Status:** PARTIAL (a manual restore branch exists from an earlier phase).
- **Objective:** know how far back the database can be restored and that the procedure works.
- **Tasks:** confirm the plan's point-in-time restore window in the Neon console (NEEDS VERIFICATION); write the restore runbook; restore to a branch and verify row counts and a sign-in against the branch; take a labelled restore point before every migration (already in `docs/ROLLBACK_PLAN.md`).
- **Files:** `docs/ROLLBACK_PLAN.md` (extend, do not replace); new `docs/OPERATIONS_RUNBOOK.md` (proposed).
- **Database changes:** none. **Security:** restore branches contain learner data: delete after the drill. **Dependencies:** S1-01.
- **Testing:** the drill. **Acceptance:** documented window; one successful restore drill. **Deployment:** none. **Rollback:** delete the drill branch.
- **Effort:** 1.5 days. **Launch impact:** blocks beta. **Definition of done:** runbook reviewed by the owner.

### Stage 2: Core learner experience

#### S2-01 Personalised learner home
- **Priority:** P0. **Status:** NOT STARTED (the plan is visible only at `/timetable`).
- **Objective:** a confirmed learner sees, in one screen: what they are learning, what to do today, how much time they have, what is next, and how they are progressing.
- **Problem and evidence:** `/` renders the legacy Command page from `getDashboardData` (`src/lib/dashboard.ts`), built on the fixed Level 0 schedule; it does not read the learning plan. `getPlanView` (`src/lib/plan/service.ts`) already returns today's sessions, items and summary, used only by `src/app/(app)/timetable/page.tsx`.
- **Tasks:** for `PERSONALISED` learners render a home with: plan title and dates, today's sessions (start time in the plan timezone, length, mission, objective, a start button), the next three sessions, time available today, a week strip, weekly progress, catch-up prompts for missed sessions; empty states (plan not started yet, nothing today, finished); LEGACY learners keep the current page; the six profile-less users keep a safe fallback. Reuse the existing visual identity (Base44 design) and obtain design approval before building new screens.
- **Files:** `src/app/(app)/page.tsx`, `src/lib/dashboard.ts`, `src/lib/plan/service.ts`, `src/components/dashboard/*` and new `src/components/home/*` (proposed), `src/lib/navigation.ts`.
- **Database changes:** none expected. **Security:** every query scoped by `userId`; no other learner's plan data.
- **Dependencies:** none. **Testing:** service tests for the view model; component tests for empty and full states; browser test in S7-01.
- **Acceptance:** after confirming a plan the learner lands on a page showing their real schedule for today and the week; a learner with no sessions today sees the next session date.
- **Deployment:** normal release. **Rollback:** previous release folder. **Effort:** 4 days. **Launch impact:** blocks beta. **Definition of done:** acceptance met on desktop and a 375 px phone.

#### S2-02 Milestones, progress and completion visibility
- **Priority:** P0. **Status:** PARTIAL (phases and a weekly objective exist in `LearningPlanPhase`; weekly milestones are generated text, not curriculum-authored).
- **Tasks:** show phase and week objectives; completed versus planned sessions; mission status (passed, needs revision, waiting for review) with the self-assessed versus reviewed label; plan end date and finish projection; a completion screen when the plan ends.
- **Files:** `src/lib/plan/service.ts`, `src/lib/analytics/service.ts`, `src/app/(app)/analytics/page.tsx`, the new home components.
- **Database changes:** none. **Security:** none new. **Dependencies:** S2-01, S4-02 (labels). **Testing:** service tests. **Acceptance:** numbers match the database for a seeded learner. **Deployment/rollback:** as S2-01. **Effort:** 2 days. **Launch impact:** blocks beta (progress visibility). **Definition of done:** reviewed on seeded data.

#### S2-03 Onboarding to home transition and mobile experience
- **Priority:** P0. **Status:** PARTIAL.
- **Tasks:** after confirmation show a short "your plan is ready" summary then the home; fix the wizard on narrow screens (programme cards, review lists, sticky action bar); keep focus management between steps; let unfinished learners reach Privacy and Settings (SEC-13); handle the baseline step (reachable or hidden until baselines exist).
- **Files:** `src/components/onboarding/onboarding-wizard.tsx`, `src/app/onboarding/page.tsx`, `src/components/layout/auth-gate.tsx`, `src/lib/auth/dal.ts`.
- **Database changes:** none. **Security:** exemptions limited to Privacy, Settings and the export route. **Dependencies:** S2-01. **Testing:** browser tests at 375 px and 1280 px. **Acceptance:** no horizontal scroll, all controls reachable by keyboard and touch. **Deployment/rollback:** as above. **Effort:** 1.5 days. **Launch impact:** blocks beta. **Definition of done:** checked on two phone sizes.

### Stage 3: Pilot curriculum

#### S3-01 Pilot scope decision and content freeze
- **Priority:** P0. **Status:** NEEDS VERIFICATION (owner decision).
- **Objective:** a written scope: pilot programmes, levels, and whether Graphic Design is in scope.
- **Tasks:** confirm `fswd` and `biz` Levels 0 and 1 plus the shared modules they need (15 shared modules exist, 6 have drafts); decide whether the 18 older Level 0 lessons stay, are replaced or are mapped to the new modules (`docs/curriculum/missions/MISSION_RECONCILIATION.md`); decide the nine-programme department structure (Graphic Design absent; `cloud` and `sysadmin` are two departments, the intended structure is one).
- **Effort:** 0.5 day plus owner time. **Dependencies:** none. **Acceptance:** signed scope note in `docs/curriculum/`. **Launch impact:** blocks beta. **Definition of done:** note committed. (No code; no database change; rollback not applicable.)

#### S3-02 Curriculum publishing and versioning pipeline
- **Priority:** P0. **Status:** NOT STARTED.
- **Objective:** approved content moves from reviewed files to the database safely, with versions.
- **Problem and evidence:** the framework and 71 drafts live in `prisma/curriculum/framework/` and are referenced only by `scripts/mission-docs.ts`, `scripts/mission-report.ts` and tests; the seed (`prisma/seed.ts`) publishes only `level0.ts`. Rubric versioning exists (`prisma/curriculum/sync.ts`: `syncRubric` bumps `version`, refuses to drop scored criteria); plans record a `catalogVersion` hash (`src/lib/plan/catalog.ts`).
- **Tasks:** add a sync that creates departments, levels, missions, steps, skills and rubrics from APPROVED drafts only; statuses DRAFT, IN_REVIEW, APPROVED, PUBLISHED, RETIRED enforced; never edit a published mission in place (publish a new version and retire the old); keep existing learner progress and assessments bound to the version they used; dry-run mode that prints the plan of changes; refuse destructive changes; link resources only when approved.
- **Files:** `prisma/curriculum/sync.ts`, `prisma/seed.ts`, `prisma/curriculum/framework/*`, new `prisma/curriculum/publish.ts` and `scripts/curriculum-publish.ts` (proposed).
- **Database changes:** likely additive fields for content version and status on `Mission` (design first; migration reviewed and rehearsed on a Neon branch before production).
- **Security:** only the owner runs it; dry-run first; production run only with written approval. **Dependencies:** S3-01. **Testing:** pure tests on the diff builder; integration test on the test database for create, update, retire; test that learners keep their progress.
- **Acceptance:** publishing the approved subset on a test database yields missions that the plan generator uses; a second run changes nothing. **Deployment:** script run by the owner after migration. **Rollback:** Neon restore point taken before the run; retire (do not delete) the new missions.
- **Effort:** 5 days. **Launch impact:** blocks beta. **Definition of done:** one rehearsal on a branch copy of production.

#### S3-03 Review, correct and approve the pilot content (Levels 0 and 1)
- **Priority:** P0. **Status:** NOT STARTED (71 drafts, all DRAFT).
- **Objective:** every pilot lesson and mission is accurate, complete and assessable.
- **Tasks (expert and engineer):** subject experts check each mission for accuracy, order, prerequisites and time estimates; confirm the five-part structure WATCH, DO, EXPERIMENT, SHOW, GET ASSESSED; confirm each rubric has measurable criteria and a passing score; confirm learning objectives and required evidence type; engineer fixes validation failures reported by `scripts/mission-report.ts` and `scripts/curriculum-report.ts`; set status to APPROVED with reviewer name and date in the file.
- **Files:** `prisma/curriculum/framework/missions/*.ts`, `docs/curriculum/missions/*.md`, `prisma/curriculum/framework/validate.ts`.
- **Database changes:** none until S3-02 publishes. **Security:** none; do not paste learner data.
- **Dependencies:** S3-01; may start immediately on the drafts. **Testing:** `tests/mission-drafts.test.ts`, `tests/curriculum-framework.test.ts` stay green; add a test that no APPROVED draft lacks a rubric or resource slot.
- **Acceptance:** all pilot drafts APPROVED or explicitly cut; a 3-month plan for each pilot programme yields at least 40 distinct assessed sessions (generator test on the test database).
- **Deployment:** through S3-02. **Rollback:** unpublish by retiring the version.
- **Effort:** engineering 3 days; **expert review 15 to 25 days** (the long pole; scales with reviewer availability). **Launch impact:** blocks beta. **Definition of done:** reviewer sign-off recorded in each file.

#### S3-04 Verified learning resources
- **Priority:** P0. **Status:** NOT STARTED (catalogue empty by design).
- **Tasks:** reviewers open and approve real resources for each WATCH step (never invented, never marked verified without a named reviewer and date); add them to `prisma/curriculum/resources.ts` with `approvedBy`, `approvedAt` and review records; run the link validator before each release; schedule a link re-check.
- **Files:** `prisma/curriculum/resources.ts`, `prisma/curriculum/resource-validate.ts`, `prisma/curriculum/resource-sync.ts`, `src/lib/resources/embed.ts`.
- **Database changes:** none (tables exist). **Security:** only `https` and approved hosts (embed rules). **Dependencies:** S3-03. **Testing:** `tests/resources.test.ts` plus a link-check script (proposed). **Acceptance:** every pilot mission has one approved primary resource, no broken link. **Effort:** engineering 1 day; expert 3 to 5 days. **Launch impact:** blocks beta. **Deployment/rollback:** seed and retire entries. **Definition of done:** link-check report committed.

#### S3-05 Legacy lesson reconciliation
- **Priority:** P0. **Status:** NOT STARTED. **Tasks:** per S3-01 decision, map or retire the 18 older lessons so learners do not see duplicate or conflicting Level 0 content; existing learner records keep their history. **Effort:** 1 day. **Dependencies:** S3-02. **Rollback:** restore point. **Acceptance:** no duplicate Level 0 topics in a generated plan. **Definition of done:** reconciliation note updated.

#### S3-06 Graphic Design and Cloud/Systems structure
- **Priority:** P2 (becomes P0 only if the owner brings Graphic Design into the pilot). **Status:** NOT STARTED. **Tasks:** add the `gfx` department and decide `cloud`/`sysadmin`; additive migration; seed. **Database changes:** new `Department` rows (additive). **Effort:** 1.5 days plus content. **Acceptance:** programme appears in onboarding only after it has published lessons (the app already filters by published lessons).

### Stage 4: Learning integrity and progression

#### S4-01 Close the XP loopholes
- **Priority:** P0. **Status:** NOT STARTED (SEC-05).
- **Problem and evidence:** custom board missions award 5 to 50 XP when ticked (`src/lib/missions/service.ts:106`, `:156`), unlimited in number (`src/app/(app)/actions.ts:50` has no limiter); published missions not in a plan can be ticked for full XP.
- **Tasks:** custom missions earn 0 XP (as personal activities do) or add a per-day cap and limiter; refuse the checkbox for curriculum missions; keep un-tick revocation; recompute department XP from reviewed and assessed records for any account that exceeded expected levels (owner decision).
- **Files:** `src/lib/missions/service.ts`, `src/lib/missions/schema.ts`, `src/app/(app)/actions.ts`, `src/lib/ratelimit.ts`.
- **Database changes:** none. **Security:** SEC-05. **Dependencies:** none.
- **Testing:** update `tests/missions.test.ts`; new tests: custom mission yields no XP, creation limited, curriculum checkbox refused, no double award.
- **Acceptance:** department XP cannot change without an assessed or reviewed pass. **Deployment/rollback:** normal. **Effort:** 2 days. **Launch impact:** blocks beta. **Definition of done:** tests green.

#### S4-02 Credit model: self-assessed versus reviewed
- **Priority:** P0. **Status:** PARTIAL (labels `SELF`, `SELF_RECORDED`, `SELF_ASSESSED`, `VERIFIED` exist in `src/lib/assessments/service.ts:85` and `src/lib/reviews/service.ts:347`).
- **Tasks:** owner decides the beta rule (recommended: XP and level count only after reviewer confirmation for pilot curriculum missions; self-assessment gives feedback and a provisional mark); show the tier wherever XP and skills appear; reviewer queue capacity plan (volume per reviewer per week); resubmission rules (attempt counter, who can resubmit, effect on awarded XP); an evidence rule per mission (file required or link acceptable); make link-only evidence require a reviewer.
- **Files:** `src/lib/assessments/service.ts`, `src/lib/reviews/service.ts`, `src/lib/missions/earned.ts`, `src/lib/analytics/service.ts`, `src/app/(app)/assessments/*`, `src/app/(app)/review/*`.
- **Database changes:** possible additive status for "provisional" credit; design first, rehearse on a branch. **Security:** SEC-04. **Dependencies:** S4-01, S3-03 for real rubrics.
- **Testing:** concurrent assessment awards once; PASS without review gives no reviewed-tier credit; baseline never awards XP; repeat requests idempotent; a revision cycle keeps history immutable.
- **Acceptance:** no learner can raise reviewed-tier XP or skills without a reviewer decision. **Deployment/rollback:** normal; data migration reviewed. **Effort:** 3 days. **Launch impact:** blocks beta. **Definition of done:** owner sign-off on the written rule.

#### S4-03 Duplicate submissions, repeat requests and state transitions
- **Priority:** P1. **Status:** PARTIAL (transactions and status guards exist: `submitMission` refuses a submission while one waits and after PASS; `assessSubmission` refuses non-SUBMITTED).
- **Tasks:** add concurrency tests (two parallel submits, two parallel assessments, two review claims); a state-transition table in `docs/` with tests for every illegal transition; idempotency for retries after network loss.
- **Files:** `src/lib/missions/progress.ts`, `src/lib/assessments/service.ts`, `src/lib/reviews/service.ts`, `tests/`. **Database changes:** none. **Effort:** 2 days. **Dependencies:** S4-02. **Acceptance:** tests prove exactly one award per mission under concurrency. **Launch impact:** public launch.

#### S4-04 Baseline assessments end to end
- **Priority:** P1. **Status:** PARTIAL (mechanism and placement-only rule built and tested; no baseline mission published; baseline pages sit behind the onboarding gate).
- **Tasks:** author and approve one baseline per pilot programme (content, through S3); let unfinished learners open only their own baseline missions; keep results out of XP, level and achievement measures (`src/lib/missions/earned.ts`); do not unlock advanced modules without evidence. **Files:** `src/lib/plan/onboarding.ts`, `src/lib/plan/baseline.ts`, `src/lib/auth/dal.ts`. **Effort:** 2 days plus content. **Dependencies:** S3-03. **Acceptance:** a learner can take a baseline during onboarding and the plan starts at the placed level with no XP. **Launch impact:** public launch (the beta may hide the step).

### Stage 5: Authentication and account recovery

#### S5-01 Email service and password reset
- **Priority:** P0. **Status:** NOT STARTED (SEC-03).
- **Tasks:** choose a transactional email provider; verify sending domain records (SPF, DKIM; needs DNS access by the owner); reset request page always answering the same message; single-use random token, only its hash stored, 30-minute expiry; reset page; end all sessions on success; rate limits per address and IP; templates without personal data beyond the first name; commit and test the owner set-password tool as the support fallback.
- **Files (proposed):** `src/lib/email/*`, `src/lib/auth/recovery.ts`, `src/app/(auth)/forgot-password/`, `src/app/(auth)/reset-password/`; existing `src/lib/auth/password.ts`, `src/lib/ratelimit.ts`.
- **Database changes:** additive table `EmailToken` (userId, purpose, tokenHash, expiresAt, usedAt) with ownership constraint; reviewed and rehearsed on a branch. **Security:** no enumeration (same response and comparable timing); token never logged; provider key in server environment only.
- **Dependencies:** S1-02 (client IP). **External:** email provider (cost: owner to obtain quotes; not estimated here), DNS access.
- **Testing:** token single use, expiry, reuse, wrong purpose, enumeration parity, rate limit, session revocation, set-password fallback. **Acceptance:** a real mailbox completes a reset on a preview environment. **Deployment:** environment variable for the provider key; migration before release. **Rollback:** feature hidden behind a flag; revert release; leave the table.
- **Effort:** 4 days. **Launch impact:** blocks beta and public launch (the exec summary lists it as a blocker; for a handful of named testers the owner could accept the manual fallback in writing, which is a business decision, not an engineering one). **Definition of done:** acceptance met and fallback documented.

#### S5-02 Email verification
- **Priority:** P0 for public launch, P1 for beta. **Status:** NOT STARTED. **Tasks:** `User.emailVerifiedAt`; verification email at sign-up; unverified accounts may use the app but receive no email reminders and cannot hold a reviewer role; resend with limits; verification required for any email change. **Database changes:** additive column plus backfill decision for existing users (grandfather or require). **Dependencies:** S5-01. **Effort:** 2 days. **Testing:** token and state tests. **Acceptance:** an address cannot be claimed by someone who does not control it for any email-based feature.

#### S5-03 Session management
- **Priority:** P2. **Status:** PARTIAL (tokens, expiry, rotation on sign-in, logout verified; SEC-16). **Tasks:** "sign out everywhere", session list, revoke on password change; optional sign-in alert email. **Effort:** 1.5 days. **Dependencies:** S5-01.

### Stage 6: Production operations

#### S6-01 Reminders cron and delivery
- **Priority:** P0. **Status:** NOT STARTED (endpoint and installer exist; 0 push subscriptions; cron line not added).
- **Tasks:** set `CRON_SECRET` (24 or more characters), run `deploy/cpanel/install-cron.sh`, add the cPanel cron line, observe one reminder firing; configure and verify VAPID keys (`scripts/push-keys.mjs`); make the dispatcher idempotent under overlapping runs (verify, add test); decide email reminders (needs S5).
- **Files:** `deploy/cpanel/install-cron.sh`, `src/app/api/cron/dispatch/route.ts`, `src/lib/notifications/scheduler.ts`, `scripts/dispatch.mjs`.
- **Database changes:** none. **Security:** the secret stays in a mode 600 file, constant-time compare already in `src/lib/http.ts`. **Dependencies:** S1-02. **Testing:** `tests/notifications.test.ts`; manual end-to-end reminder. **Acceptance:** a scheduled reminder reaches a tester's browser within two minutes of its time. **Deployment:** cPanel cron. **Rollback:** remove the cron line. **Effort:** 1 day. **Launch impact:** blocks beta. **Definition of done:** one observed delivery.

#### S6-02 Monitoring, logging and error reporting
- **Priority:** P0 (minimum), P1 (full). **Status:** NOT STARTED (five `console.error` calls; no monitoring).
- **Tasks:** external uptime check on `/api/health` with an alert to the owner; structured server logging with redaction (no emails, passwords, tokens or file names); error reporting for server errors; a weekly log review routine; incident response notes (who, what, how to roll back, how to inform learners).
- **Files:** `src/instrumentation.ts`, `src/app/api/health/route.ts`, new `src/lib/log.ts` (proposed), `docs/OPERATIONS_RUNBOOK.md` (proposed). **Database changes:** none. **Security:** logs contain no secrets or personal data. **Dependencies:** S1-02. **Testing:** a test that the logger redacts known patterns. **Acceptance:** stopping the app triggers an alert within five minutes. **Effort:** 2 days. **Launch impact:** blocks beta (minimum). **External:** monitoring service (cost: not estimated).

#### S6-03 Deployment automation and rollback drill
- **Priority:** P0. **Status:** PARTIAL (GitHub Actions builds the release; fetch and switch are typed by hand; two typing errors already occurred).
- **Tasks:** one short command that fetches the latest release, runs the integrity and native-library checks, switches and verifies `/api/health`; automatic rollback to the previous folder if the health check fails; keep the last three releases; perform one rollback drill; document the migration step order (restore point, review SQL, `prisma migrate deploy`, then release).
- **Files:** `deploy/cpanel/fetch-release.sh`, `deploy/cpanel/switch-release.sh`, `.github/workflows/cpanel-release.yml`, `docs/ROLLBACK_PLAN.md`. **Database changes:** none. **Security:** the script never prints secrets; downloads verified by checksum (already done). **Dependencies:** S6-02 (health alerts). **Testing:** `tests/cpanel-readiness.test.ts` extended; drill. **Acceptance:** a release and a rollback each complete with one command and a passing health check. **Effort:** 2.5 days. **Launch impact:** blocks beta. **Definition of done:** drill logged.

#### S6-04 Environment validation and background job reliability
- **Priority:** P1. **Status:** NOT STARTED. **Tasks:** startup validation (also S1-02); scheduler and cron overlap protection; confirm Passenger keeps long jobs alive or move work into short cron calls; monitor `RateLimitBucket` growth. **Effort:** 1.5 days. **Acceptance:** two simultaneous cron calls produce one set of notifications.

### Stage 7: Quality and reliability

#### S7-01 Browser end-to-end tests
- **Priority:** P0. **Status:** NOT STARTED (no browser tests; server logic is covered by 523 tests).
- **Tasks:** add Playwright with a test database and seeded data; journeys: register, every wizard step, build, review, confirm, home; refresh and resume at each onboarding state; direct URL access while unfinished; sign-out and sign-in; submit evidence; request review; reschedule a session; delete account; each at 375 px and 1280 px.
- **Files (proposed):** `e2e/`, `playwright.config.ts`, CI job. **Database changes:** none. **Security:** tests use throwaway local accounts only. **Dependencies:** S2-01 (home), S3-02 (real content for the plan). **Acceptance:** the suite passes on a clean machine and in CI. **Deployment:** none. **Effort:** 5 days. **Launch impact:** blocks beta. **Definition of done:** green run attached to the release gate.

#### S7-02 Cross-user isolation sweep
- **Priority:** P0. **Status:** PARTIAL (route tests exist; no exhaustive sweep). **Tasks:** automatically enumerate server actions and route handlers and call each as learner B with learner A's identifiers, expecting 404 or refusal; include reviewer scope boundaries and cron. **Files:** `tests/`. **Effort:** 1.5 days. **Acceptance:** zero cross-user successes. **Launch impact:** blocks beta.

#### S7-03 Accessibility
- **Priority:** P1. **Status:** NOT STARTED. **Tasks:** automated checks (axe) in Playwright; keyboard path through every journey; screen-reader pass on onboarding and home; contrast checks on the dark theme; reduce-motion; fix findings. **Effort:** 3 days. **Acceptance:** no serious or critical automated violations; keyboard-only completion of onboarding.

#### S7-04 Performance and load
- **Priority:** P1. **Status:** NOT STARTED (nothing measured). **Tasks:** profile dashboard and plan-build queries; add indexes only where measured; load test 50 concurrent learners against a staging copy; set budgets (page load, API latency) and record real numbers; check cPanel memory and process limits. **Effort:** 3 days. **Dependencies:** S2-01. **Acceptance:** documented measurements meeting the agreed budgets.

#### S7-05 Browser compatibility, failure recovery and regression
- **Priority:** P1. **Tasks:** current Chrome, Safari (iOS), Firefox, Edge; offline and flaky network behaviour of wizard saves; Neon cold-start handling; a regression checklist run before each release. **Effort:** 2 days.

#### S7-06 CI gate
- **Priority:** P1. **Status:** NOT STARTED (SEC-12). **Tasks:** pull-request workflow running lint, typecheck, unit and integration tests with a database service, `npm audit` (fail on high in production dependencies), build; the release workflow requires it; protect master. **Files:** `.github/workflows/` (new `ci.yml`, proposed). **Effort:** 2 days. **Acceptance:** a failing test blocks merge.

### Stage 8: Supervised beta

#### S8-01 Beta operations package
- **Priority:** P0. **Status:** NOT STARTED.
- **Tasks:** eligibility (invited adults, 18+, named list, 10 to 30 people); consent and disclosure text (self-assessed credit labelled, pilot content, data handling); onboarding of testers by the owner; reviewer assignment and a weekly review capacity; support channel and response targets; feedback form and weekly summary; incident handling; success criteria; rollback conditions.
- **Files:** `docs/BETA_PLAN.md` (proposed), `src/lib/legal.ts` and `src/app/privacy-policy/page.tsx` (update the production URL and contact). **Database changes:** none. **Dependencies:** all P0 phases. **Effort:** 2 days plus owner time. **Acceptance:** the beta gate in section 5 is signed. **Launch impact:** is the beta. **Definition of done:** plan approved by the owner.
- **Suggested success criteria (owner to confirm):** at least 70% of testers confirm a plan; at least 60% complete one reviewed mission in two weeks; no data-loss or cross-user incident; reminder delivery above 95% of due reminders; median review turnaround under 3 days.
- **Rollback conditions:** any cross-user data exposure, loss of learner files, credential compromise, or reminder or sign-in outage above 24 hours pauses the beta; roll back the release, restore data from backup if needed, inform testers.

### Stage 9: General public launch

#### S9-01 Public landing page
- **Priority:** P1. **Status:** NOT STARTED (the only public pages are `/login`, `/register`, `/privacy-policy`). **Tasks:** public home with programme overview, how it works, honest statement of what verified means, sign-up call to action; design approval first. **Files:** new public route group (proposed), `src/proxy.ts` public path list. **Effort:** 2 days.

#### S9-02 Enforced security headers
- **Priority:** P1. **Status:** NOT STARTED (SEC-06, SEC-07). **Tasks:** review the CSP reports; nonces to remove `'unsafe-inline'` scripts; enforce CSP; HSTS; `poweredByHeader: false`; resolve the X-Frame-Options override. **Files:** `next.config.ts`, `src/proxy.ts`. **Effort:** 2 days. **Acceptance:** `curl -I` shows enforced policy and HSTS; browser console clean on the main journeys.

#### S9-03 Reviewer and admin tooling
- **Priority:** P1. **Status:** PARTIAL (review queue, claim, score and release exist under `src/app/(app)/review/`; roles by script only). **Tasks:** role grant and revoke screen with audit view; reviewer scope management; queue ageing indicators; curriculum publish status view; reviewer guidance for opening untrusted files. **Database changes:** none expected (tables `ReviewerScope`, `RoleAudit` exist). **Effort:** 5 days. **Dependencies:** S4-02.

#### S9-04 Legal, privacy and retention
- **Priority:** P1. **Status:** PARTIAL (export, deletion, audit trail exist; policy page names the old host). **Tasks:** update policy text and URL; state and implement retention for sessions, rate-limit buckets and old evidence; subject-access process timing; terms of use; cookie statement. **Effort:** 1.5 days plus legal review.

#### S9-05 Upload scanning and abuse controls
- **Priority:** P1. **Status:** NOT STARTED (SEC-15). **Tasks:** malware scanning before reviewers open files; quarantine state; per-account abuse limits review. **Effort:** 2 days; scanning service cost not estimated.

#### S9-06 External penetration test and capacity plan
- **Priority:** P1. **Tasks:** independent test of the production-like environment; fix findings; confirm hosting limits and a scale-up plan (cost not estimated). **Effort:** 2 days internal plus external tester.

### Stage 10: Full Academy vision

| ID | Phase | Priority | Status | Effort | Notes |
|---|---|---|---|---|---|
| S10-01 | Curriculum for nine programmes by five levels: Levels 1 to 4 for pilots, then Levels 0 to 4 for the other seven; Graphic Design and the Cloud/Systems merge | P2 to P3 | NOT STARTED (framework outline exists for all nine) | engineering about 1 day per programme level for publishing and tests; expert review dominates (months) | S3-02 pipeline is reused. |
| S10-02 | Combined learning pathways | P3 | PARTIAL (seven pathways defined in `prisma/curriculum/framework/pathways.ts`, not wired to onboarding) | 5 days | Needs content in several programmes. |
| S10-03 | AI-assisted assessment (advisory first) | P2 | NOT STARTED | 8 days | Provider abstraction (DeepSeek or other), server-side key, JSON schema validation, retries and timeouts, idempotency, confidence, escalation to human, audit rows, spend limits. Controls in `SECURITY_AUDIT_REPORT.md` section 7. Depends on S4-02. |
| S10-04 | Automated evidence inspection (repository, live site, screenshots, files, design files) | P2 | NOT STARTED | 12 days | Needs an SSRF-safe fetch worker (section 7 of the security report), isolated from the web process. |
| S10-05 | Secure code execution environments | P3 | NOT STARTED | 15 days | Separate sandbox service, no network, resource limits; never on the app server. |
| S10-06 | Advanced reviewer workflows | P2 | PARTIAL | 5 days | Second-reviewer samples, calibration, SLA reports. |
| S10-07 | Adaptive learning plans | P2 | PARTIAL (rebalancing and reschedule exist; assessment-driven adaptation limited to baseline placement) | 6 days | Needs reliable reviewed results first. |
| S10-08 | Advanced learner analytics | P3 | PARTIAL (`/analytics`) | 5 days | Privacy review required. |
| S10-09 | Achievements, certificates with verification, email reminders, calendar export | P2 | NOT STARTED (`Achievement` tables exist, nothing awards them) | 8 days | Certificates depend on verified credit. |

## 4. Release gates
Every gate lists mandatory requirements and the evidence that proves them. A single failed security or data-integrity item fails the gate regardless of any score.

### Gate A: Internal testing (met today, with the exceptions listed)
| Requirement | Evidence | Today |
|---|---|---|
| Lint, typecheck, tests, build pass | command outputs in `QA_AND_TEST_RESULTS.md` | Met |
| Onboarding gate enforced | tests plus live check | Met |
| No cross-user access in tested routes | route tests | Met |
| Testers know data may be reset and credit is self-assessed | written notice | Owner to confirm |
| Known blockers listed | this document | Met |

### Gate B: Supervised beta (all must be true)
| Requirement | Evidence |
|---|---|
| S1-01, S1-02, S1-03, S1-04 complete | operations log, restore drill, backup listing |
| S2-01 to S2-03 complete | screenshots on desktop and phone; E2E run |
| S3-01 to S3-05 complete: pilot content approved and published, resources verified | reviewer sign-offs, link-check report, generated plan test |
| S4-01, S4-02 complete: no credit from a checkbox, reviewer rule in force, labels shown | tests, screenshots |
| S5-01 complete (or the owner's written acceptance of the manual recovery fallback for named testers) | email test, or signed note |
| S6-01 to S6-03 complete: cron delivery observed, uptime alert tested, rollback drilled | logs |
| S7-01, S7-02 green | CI or recorded run |
| S8-01 complete: beta plan, consent text, reviewers named, support channel | document and owner sign-off |
| No open CRITICAL or HIGH security finding in `SECURITY_AUDIT_REPORT.md` except those accepted in writing for named testers (SEC-04 labelling) | updated report |

### Gate C: General public launch (Gate B plus all of)
| Requirement | Evidence |
|---|---|
| S5-02 verification and S5-03 session controls (as scoped) | tests, mailbox run |
| S6-04, S7-03 to S7-06 complete | accessibility report, load test numbers, CI protecting master |
| S9-01 to S9-06 complete; CSP enforced; HSTS on | `curl -I`, pen test report with findings closed |
| S4-03, S4-04 complete | concurrency tests, baseline run |
| Beta success criteria met for at least four weeks with no data-integrity incident | beta report |
| Hosting capacity and cost plan approved | capacity note |
| Support and incident process staffed | runbook |

### Gate D: Full Academy vision
All nine programmes published to five levels with expert sign-off; combined pathways working; AI assessment advisory results compared with reviewers on a sample and meeting an agreed agreement rate before it influences credit; evidence inspection and code execution isolated and independently tested; adaptive plans and analytics reviewed for privacy; certificates verifiable.

## 5. Dependencies and implementation order

### Dependency graph
```
S1-01 ─┬─> S1-02 ─┬─> S5-01 ─> S5-02 ─> S5-03
       │          ├─> S6-01
       │          └─> S6-02 ─> S6-03
       ├─> S1-03
       └─> S1-04
S3-01 ─> S3-02 ─> S3-05
S3-01 ─> S3-03 ─> S3-04      (S3-03 can start now on the drafts; publishing waits for S3-02)
S4-01 ─> S4-02 ─> S4-03 ; S3-03 ─> S4-04
S2-01 ─> S2-02, S2-03 ─> S7-01 (also needs S3-02 content) ─> S7-03, S7-04, S7-05
S7-02, S7-06 (independent)
S4-02 ─> S9-03 ─> S10-06 ; S4-02 ─> S10-03 ─> S10-04
all P0 ─> S8-01 ─> Gate B ─> beta ─> Gate C
```

### Recommended order
1. **Week 0, this week:** S1-01, then S1-02 (same maintenance window). Start expert review of the pilot drafts (S3-03) immediately; it needs no code.
2. **In parallel, first block:** S2-01 and S2-03 (developer), S4-01 (quick), S1-03 and S1-04, S3-01 decision.
3. **Second block:** S3-02 (pipeline), S4-02, S5-01, S6-01 and S6-02.
4. **Third block:** S3-04, S3-05, S6-03, S2-02, S7-02.
5. **Fourth block:** S7-01 (needs the home and real content), S8-01, Gate B review.
6. **After beta start:** S7-03 to S7-06, S4-03, S4-04, S5-02, S9-01 to S9-06 in parallel by availability.
7. **After public launch:** Stage 10 in priority order: S10-03, S10-04, S10-09, S10-06, S10-07, then content expansion continuously.

Can run in parallel: S1 work, S2 work, expert content review, S4-01, S5-01 (email provider setup), S6-01. Must be sequential: S1-01 before anything that changes the environment; S3-02 before publishing; S2-01 before S7-01; S4-02 before S9-03 and any AI credit logic.
**Critical path:** expert review of the pilot content (15 to 25 days of reviewer time, calendar-bound) then S3-02 publish, then S7-01 verified on real content, then S8-01 and Gate B. Engineering effort is not the constraint if reviewers start now.

## 6. Effort summary (engineering days, one developer)
| Group | Phases | Days |
|---|---|---|
| Stage 1 | S1-01 to S1-04 | 6 |
| Stage 2 | S2-01 to S2-03 | 7.5 |
| Stage 3 (engineering) | S3-01 (0.5), S3-02 (5), S3-03 (3), S3-04 (1), S3-05 (1) | 10.5 |
| Stage 4 | S4-01, S4-02 | 5 |
| Stage 5 | S5-01 | 4 |
| Stage 6 | S6-01 to S6-03 | 5.5 |
| Stage 7 | S7-01, S7-02 | 6.5 |
| Stage 8 | S8-01 | 2 |
| **Beta total (P0)** | | **47** |
| P1 for public launch | S4-03 (2), S4-04 (2), S5-02 (2), S6-04 (1.5), S7-03 (3), S7-04 (3), S7-05 (2), S7-06 (2), S9-01 (2), S9-02 (2), S9-03 (5), S9-04 (1.5), S9-05 (2), S9-06 (2) | 32 |
| **General launch total** | | **about 79** |
| P2 and P3 (Stage 10 engineering, excluding content) | S10-02 to S10-09 and S3-06, S5-03 | about 70 |

**Expert content review (separate, parallel):** 15 to 25 days for pilot Level 0 and 1 (S3-03) plus 3 to 5 days for resources (S3-04). Expansion of the other seven programmes and Levels 2 to 4 is measured in months of reviewer time and is not estimated here.

### Reassessment of the earlier estimates
The executive summary said about 24 engineering days for the supervised beta, 5 to 8 weeks elapsed. The detailed breakdown is larger because it now includes the curriculum publishing pipeline (S3-02, 5 days), browser tests (S7-01, 5 days), email recovery (S5-01, 4 days), backups with restore drills (S1-03, S1-04, 3.5 days) and deployment automation (S6-03, 2.5 days), which the first estimate did not itemise. **Revised: about 47 engineering days for the beta.** With one developer that is roughly 9 to 10 weeks elapsed; with two developers working the parallel tracks above, roughly 5 to 6 weeks, provided expert review proceeds in parallel. The earlier general-launch figure of 8 to 11 weeks holds only with two developers (about 79 days); with one developer expect about 16 weeks. The full vision estimate of 6 to 9 months stays, driven by content. These are planning figures, not commitments, and no calendar dates are given.

## 7. External dependencies and costs (known and unknown)
| Item | Need | Cost |
|---|---|---|
| Transactional email provider and DNS records (SPF, DKIM) | S5-01, S5-02, S6-01 email | Not estimated; owner to obtain quotes. Needs DNS access. |
| Offsite backup storage | S1-03 | Not estimated. |
| Neon plan features (restore window, IP allow-list, role management) | S1-01, S1-04 | Depends on the current plan; NEEDS VERIFICATION. |
| Uptime and error monitoring service | S6-02 | Not estimated; free tiers may suffice for the beta. |
| Subject-expert reviewers | S3-03, S3-04 | Owner-arranged; the main constraint. |
| Malware scanning and external penetration test | S9-05, S9-06 | Not estimated. |
| AI provider (DeepSeek or other) usage | S10-03 | Usage-based; budget limits required before enabling. |
| cPanel plan limits (memory, processes, storage) | S7-04, S9-06 | NEEDS VERIFICATION; no server access in this audit. |

## 8. Items not verified in this report
Neon console state; cPanel and LiteSpeed configuration and file permissions; live headers on authenticated pages; presence of old evidence in Netlify Blobs; Neon restore window; the owner's decisions on pilot scope, credit rule and email provider; performance and accessibility (never measured); behaviour under Node 24 of the full test suite (tests ran on the audit machine's Node 26).
