# Remaining Development Phases

Audit date: 2026-11-18, code `738ae0f`. This list contains only work that the audit found still to do. Earlier roadmaps were not copied. Effort is engineering days for one experienced developer, excluding content-expert review time, which is shown separately and is the longest pole. Estimates assume the current stack and no scope change.

Launch scopes used below:
- **MVP**: a supervised beta with two pilot programmes (Web Development and Business and Entrepreneurship, Levels 0 and 1), self-assessment plus optional human review, clearly disclosed.
- **Full vision**: nine programmes, five levels, AI-assisted assessment with evidence inspection.

## P0: critical launch blockers (MVP)

### P0-1 Credential and access hygiene
Status: not started. Tasks: rotate the Neon owner password and update cPanel `DATABASE_URL`; stop using the password exposed in chat; set `TRUSTED_PROXY_HOPS` after checking LiteSpeed forwarded headers; switch to `sslmode=verify-full`; raise Prisma transaction/connection timeouts. DB changes: none. Tests: connection smoke test on production health. Acceptance: old password rejected, `/api/health` ok, rate-limit IP test behind the proxy. Effort 1 day. Depends on: owner access. Blocks launch: yes.

### P0-2 Personalised learner home ("My Learning Home")
Status: missing. The dashboard `/` is legacy. Tasks: for `PERSONALISED` learners show today's sessions, next session, week view, plan progress, catch-up prompts and a clear next action; keep the legacy Command view for LEGACY learners; redirect confirmation to it; empty-state copy. Files: `src/app/(app)/page.tsx`, `src/lib/dashboard.ts`, `src/lib/plan/service.ts` (`getPlanView`), `src/components/dashboard/*`. DB: none. Security: owner scoping. Tests: service tests for the view data; component test; browser test. Acceptance: a confirmed learner lands on a page that shows their real schedule. Design approval is needed (visual identity must be preserved). Effort 4 days. Blocks launch: yes.

### P0-3 Pilot curriculum to publishable quality
Status: 71 drafts, none approved. Tasks: subject-expert review of fswd and biz L0 to L1 and the shared modules they need; approve and publish through the sync tooling; author rubrics; add real resources with link validation; resolve how the 18 old Level 0 lessons relate to the new modules; decide the Graphic Design department and the Cloud/Sysadmin merge (needs owner decision, production data change). Files: `prisma/curriculum/*`, `scripts/curriculum-*.ts`. DB: new departments, missions, rubrics, resources via the existing sync (additive). Tests: validators and `mission-drafts` tests; plan generation on real content. Acceptance: each pilot programme yields a 3-month plan of at least 40 distinct assessed sessions; every mission has criteria and valid resources. Effort 6 engineering days plus 15 to 25 days of expert content review. Blocks launch: yes.

### P0-4 Credit integrity decision and enforcement
Status: self-scored XP. Tasks: decide the credit rule; require a human review (or a verified automatic check) before PASS and XP on curriculum missions; remove checkbox XP for published missions (S-04); cap the number of custom missions per day; label self-assessed items; keep placement baselines out of achievement measures (already done). DB: possible status field on assessment (`SELF`, `REVIEWED`). Tests: update `missions`, `assessments`, `reviews` tests. Acceptance: no XP from a checkbox on curriculum missions; reviewer queue handles the pilot volume. Effort 4 days. Depends on: P0-3 decisions. Blocks launch: yes (for any claim of verified skills).

### P0-5 Account recovery and email
Status: missing. Tasks: choose an email provider; password reset by single-use expiring token; email verification; rate limits; templates; commit and test the owner set-password tool as a fallback. DB: token table (additive). Security: token hashing, no enumeration, session revocation on reset. Tests: full flow, expiry, reuse, enumeration. Effort 5 days. Blocks launch: yes.

### P0-6 Operations baseline
Status: partial. Tasks: install the reminders cron and verify a reminder fires; scheduled backup of `~/jokzet-data/evidence` and a documented Neon restore/PITR procedure with a restore drill; uptime check on `/api/health`; basic error logging with a retention routine; a one-command deploy helper for the owner; a rollback drill; locate or retire evidence left in Netlify Blobs; repair the six profile-less users. Tests: cron secret test, restore drill. Effort 4 days. Blocks launch: yes.

## P1: required for a reliable launch

### P1-1 Browser end-to-end tests and onboarding polish
Playwright journey: register → each wizard step → build → review → confirm → home; refresh and resume at each step; mobile viewport; keyboard-only. Make baselines reachable from onboarding (allow baseline mission pages for unfinished learners) or hide the step until baselines are published; let unfinished learners reach Privacy; allow a "start over". Effort 5 days. Depends on P0-2.

### P1-2 Security headers and CI
Enforce CSP after a report-only review period; add HSTS; add a CI workflow for lint, typecheck, tests (with a service database) and `npm audit`; pin vitest to `devDependencies` if needed. Effort 3 days.

### P1-3 Performance and resilience
Profile the dashboard and plan build queries; add indexes where measured; load test 50 concurrent learners; tune Neon pooling and cold-start handling; paginate long lists. Effort 3 days. Depends on P0-2.

### P1-4 Accessibility and mobile pass
Audit with automated tools plus manual keyboard and screen-reader checks; fix contrast, focus, labels, touch targets; verify navigation links (`/calendar`, `/businessos`). Effort 3 days.

### P1-5 Reviewer and admin tooling
Role management and a reviewer queue overview without scripts; review SLA indicators; curriculum publish status view. Effort 5 days. Depends on P0-4.

### P1-6 Public landing page and policy updates
Public home with programme overview and sign-up call to action; update the policy page URL and contact data. Effort 2 days. Design approval needed.

## P2: important after the first safe release

### P2-1 Assessment engine v2: AI-assisted, advisory first
Provider abstraction with DeepSeek; server-side secret; JSON schema validation, retries, timeouts, idempotency keys; evidence provenance; confidence and automatic escalation to human review; prompt-injection defences (treat evidence text as data); audit rows for every call; cost limits. Start advisory only (never decides credit). DB: assessment source and provenance fields (additive). Effort 8 days. Depends on P0-4.

### P2-2 Evidence inspection services
GitHub repository inspection, live-site checks, screenshots, file analysis, Figma where supported. Needs outbound fetching with SSRF defences (allow-lists, size and time limits, no private addresses) and, for any code execution, an isolated sandbox service, never the app server. Effort 12 days. Depends on P2-1.

### P2-3 Content expansion
Levels 1 to 3 for the remaining programmes, then Level 4; expert review per programme. Content time dominates; engineering about 1 day per programme level for publishing and tests.

### P2-4 Achievements, notifications by email, calendar export
Award rules and UI for achievements; email reminders; ICS export. Effort 5 days. Depends on P0-5.

## P3: future expansion
Native or installable mobile experience, community and mentoring, certificates with verification, employer portfolio sharing, marketplace features, deeper BusinessOS Ghana capstone, multi-language content. Not required for launch.

## Dependency-aware order
1. Sequential first: P0-1 (hours) then P0-6 (operations) so that real data is protected.
2. In parallel: P0-2 (home), P0-3 (curriculum), P0-5 (recovery). P0-3 content review should start immediately because it has the longest lead time.
3. After P0-3 decisions: P0-4.
4. Then P1-1 (needs P0-2), P1-2, P1-3, P1-4, P1-6 in parallel; P1-5 after P0-4.
5. Launch gate: all P0 plus P1-1, P1-2, P1-3.
6. After launch: P2-1, then P2-2; P2-3 continues; P2-4 after P0-5.

## Time to launch
- MVP supervised beta: P0 about 24 engineering days plus 15 to 25 days of content review in parallel, so roughly **5 to 8 weeks elapsed** with one developer and one reviewer. Add 12 engineering days for the P1 gate items to reach a general launch, roughly **8 to 11 weeks**.
- Full vision (nine programmes, five levels, AI inspection): at least **6 to 9 months**, dominated by content.
These are estimates under stated assumptions, not commitments. The main uncertainty is content review capacity and the credit-model decision.

## Recommended first action
P0-1 today (rotate the credential), then start P0-3 content review and P0-2 in parallel.
