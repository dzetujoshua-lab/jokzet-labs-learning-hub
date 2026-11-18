# Production Launch Checklist

Audit date: 2026-11-18. Tick an item only with evidence (a test, a log, a screenshot or a command output). Items marked ✅ were verified in this audit.

## A. Security and access (blockers)
- [ ] Neon owner password rotated; cPanel `DATABASE_URL` updated; old password refused.
- [ ] Password reset and email verification working, tested (token expiry, reuse, no account enumeration).
- [ ] Credit rule decided and enforced: no XP from a checkbox on curriculum missions; reviewer or verified check before PASS.
- [ ] `TRUSTED_PROXY_HOPS` set and IP rate limits proven behind the proxy.
- [ ] CSP enforcing (after a clean report-only period) and HSTS sent.
- [ ] `npm audit` clean or each finding accepted in writing.
- [ ] ✅ No secrets in tracked files (scan clean).
- [ ] ✅ Sessions HttpOnly, Secure, `__Host-` prefixed; sign-in does not reveal whether an email exists.

## B. Learner journey
- [ ] ✅ Registration redirects to onboarding; private pages and APIs refuse unfinished learners.
- [ ] Browser test: register → every wizard step → build → review → confirm → home, including refresh and resume at each step, on desktop and mobile.
- [ ] Personalised learner home shows today's sessions and the active plan.
- [ ] Baseline path reachable, or the baseline step hidden until baselines are published.
- [ ] Unfinished learners can reach export and deletion.
- [ ] Six profile-less production accounts repaired.
- [ ] Public landing page and updated policy page.

## C. Curriculum
- [ ] Launch programmes chosen in writing (MVP: Web Development, Business and Entrepreneurship).
- [ ] Every launch mission has WATCH → DO → EXPERIMENT → SHOW → GET ASSESSED content, a rubric with criteria, a duration and prerequisites.
- [ ] Subject-expert sign-off recorded per programme level.
- [ ] Resources present, links validated, none broken.
- [ ] A 3-month plan for each launch programme yields at least 40 distinct assessed sessions.
- [ ] Graphic Design department decision; Cloud/Sysadmin decision.

## D. Assessment
- [ ] Reviewer accounts created and trained; queue capacity covers expected volume.
- [ ] Learners told plainly which results are self-assessed and which are reviewed.
- [ ] If AI assistance is offered: provider abstraction, schema validation, retries, timeouts, idempotency, escalation to human review, audit trail all tested (not required for MVP).

## E. Infrastructure and operations
- [ ] ✅ Production serves the audited release; `/api/health` reports database up.
- [ ] Reminders cron installed; one reminder observed firing in production.
- [ ] Backups: scheduled copy of `~/jokzet-data/evidence`; Neon restore/PITR window confirmed; one restore drill completed.
- [ ] Uptime check on `/api/health` with an alert to the owner.
- [ ] Application error logging reviewed on a schedule.
- [ ] One rollback drill (`switch-release.sh` to the previous release) completed.
- [ ] Evidence left in Netlify Blobs located and migrated or confirmed absent.
- [ ] Hosting limits (memory, processes) confirmed against a 50-learner load test.

## F. Quality
- [ ] ✅ Lint, typecheck, 523 unit/integration tests, production build pass.
- [ ] CI runs lint, typecheck, tests and audit on every pull request.
- [ ] Accessibility pass (automated plus keyboard and screen reader) with fixes.
- [ ] Mobile layout checked on at least two phone sizes.

## G. Privacy and legal
- [ ] Policy page shows the production URL and a working contact route.
- [ ] Retention periods stated and enforced or scheduled.
- [ ] ✅ Export, deletion and audit trail work.
- [ ] Adult-only (18+) statement consistent across sign-up and policy.

## Sign-off
Launch is approved only when sections A, B, C (launch programmes only) and E have no open blocker, and the owner has signed the decision on credit integrity.
