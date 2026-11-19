# Administration Centre, Phase 1

Branch `feature/admin-centre`. Visual reference: the supplied dark glassmorphism dashboard (layout and mood only; no branding or content copied). **Not deployed. No schema change, no migration.**

## What exists
| Route | Purpose |
|---|---|
| `/admin` | Dashboard: latest-conditions ticker, hero, five KPI cards, learner overview, learners by programme, assessment insights, 8-week learning activity, upcoming, quick actions, administrator panel, recent activity |
| `/admin/staff` | **Staff and roles**: assign or remove roles, reviewer departments, staff directory with search, `?role=AUTHOR` preselects Curriculum Manager |
| `/admin/curriculum` | Lessons without an approved primary resource, and every resource's review state |

Navigation lists only these pages plus the existing Review Queue (`/review`) and the learner view, so there are no dead links.

## Real data, no invention
Every figure is an aggregate read at request time (`src/lib/admin/overview.ts`): learners, learners active in the last 14 days, assessments waiting for a reviewer, active and paused enrolments, resources awaiting review, results by outcome, stopped AI jobs, recorded activity per week. "Trends" are counts for the last 7 days from stored dates, never percentages. The ticker and the header count show only conditions that are true now (reviews waiting, AI jobs stopped or waiting, lessons without a video, resources awaiting review, AI switched off, scheduler silent for 15 minutes). Upcoming shows only AI retries and reviews waiting; there are no announcements or events in the database, so none are shown. Recent activity names no learner: registrations, enrolments, submissions (lesson title only), completed reviews, approvals and role changes (staff emails only, visible to administrators).

## Theme isolation
`src/components/admin/admin-theme.css` is loaded only by the admin shell and every rule is under `.admin-theme` (a test checks this). It redefines the colour tokens for the admin subtree only; `globals.css` is untouched and a test checks the learner primary colour is unchanged.

## Permissions (Phase 1)
| Capability | Academy Admin | Curriculum Manager | Assessment Reviewer | Learner |
|---|---|---|---|---|
| Open the Administration Centre, staff and roles | yes | no | no | no |
| `/curriculum` (read-only) | yes | yes | no | no |
| `/review` queue | yes | no | yes (own departments) | no |
Checks: the admin layout, every admin page and both staff actions call `requireRole("ADMIN")`, and the services re-read the acting account from the database. There are no admin API routes in this phase.

## Tests
`tests/admin-centre.test.ts` (11) and the updated `curriculum-decisions` tests; browser: `e2e/admin-centre.spec.ts` (signed-out and learner turned away; admin dashboard, theme isolation, navigation, staff page, search, learner colours unchanged) at desktop and phone width. Full-suite results are recorded in the pull request.

## Not done (next phases)
Learner directory, courses, assessments pages, learning-resource workflow, AI Assessment Centre, analytics and reports pages, notifications and settings pages, system monitoring, security and audit-log pages. The brief's extra roles (Super Admin, Support Admin, System Operator), a dedicated audit log (today `RoleAudit` records role changes only), the draft, submitted, approved, published workflow for resources, account suspension and score overrides all need a schema change and your approval to migrate. "Add learner", "Add learning resource", "Publish curriculum", "View reports" and "Manage settings" quick actions are omitted until those workflows exist. The tablet layout was not separately tested.
