# Security Audit Report: JOKZET Labs Academy

Report date: 2026-11-18. Application: `jokzet-command-center/`. Production: https://jokzet-labs.iipghstudent.com (cPanel, LiteSpeed/Passenger) with the existing Neon PostgreSQL database.
This report supersedes the shorter version first delivered on the same day. An older report at `docs/audit/SECURITY_AUDIT_REPORT.md` is preserved unchanged.

## 1. Baseline and method
| Item | Value |
|---|---|
| Audited commit | `738ae0f` (master, merge of PR 32). Current HEAD `e86edc0` adds documentation only: `git diff 738ae0f HEAD -- jokzet-command-center` is empty. |
| Working tree | Uncommitted, not deployed: Neon Auth experiment (`src/app/neon-auth`, `src/app/api/auth`, `src/components/neon-auth`, `src/lib/neon-auth`, `neon.ts`, edits to `package.json`, `package-lock.json`, `src/proxy.ts`) and the owner set-password tool (`scripts/set-password.ts`, `src/lib/auth/reset.ts`, `tests/set-password.test.ts`). |
| Method | Source review, schema review, test results, a scan of Git history and of the built frontend bundle, `npm audit`, and three safe `HEAD`/`GET` requests to production to read response headers. |
| Test evidence | `npx vitest run`: 37 files, 523 tests, 523 passed, 0 failed (recorded 2026-11-18 in `docs/QA_AND_TEST_RESULTS.md`). `npx eslint`: exit 0. `npx tsc --noEmit`: exit 0. `npm run build`: exit 0. |
| Not done | No exploitation, no fuzzing, no authenticated testing of production, no credential use, no rotation, no changes of any kind. Server-side items (file permissions, cPanel account, LiteSpeed configuration, Neon console) were not accessible and are marked NEEDS VERIFICATION. |
| Secrets | No secret value appears in this report. Counts and file names only. |

## 2. Position in one paragraph
There is **no verified Critical vulnerability**. The core controls are sound (Argon2id, hashed session tokens, ownership-scoped queries, same-origin checks, content-sniffed uploads, a server-side onboarding gate, tested privacy deletion). Three things block a public launch: no account recovery (SEC-03), an exposed and unrotated database credential (SEC-01), and credit that learners award themselves with unlimited ways to farm it (SEC-04, SEC-05). The most important process failure is that nothing in the pipeline runs tests or audits before release (SEC-12).

### Differences from the earlier audit summary
- Earlier text said the credential was "exposed in earlier working sessions". This audit checked whether it reached Git: **it did not** (SEC-01 evidence). The exposure is in conversation transcripts and notes, not in the repository, which lowers the spread risk but not the need to rotate.
- Earlier text said `X-Frame-Options` is DENY. The code sets DENY, but **production serves `SAMEORIGIN`** (SEC-07). Something in front of the app changes it.
- Earlier text called evidence-free XP a single finding. It is two: the checkbox path (SEC-05) and self-recorded assessment (SEC-04). Assessments are labelled `SELF`/`SELF_RECORDED` and skills `SELF_ASSESSED`, which the earlier text did not credit. That labelling reduces but does not remove the integrity problem.
- Earlier text said unfinished learners cannot reach Privacy. Confirmed (SEC-13).

## 3. Threat model
**Assets (highest first):** the Neon database (all learner accounts, hashes, submissions, assessments, plans); account sessions; uploaded evidence files (private work, possibly personal); integrity of XP, skills and assessment history; the production host; reminders and push subscriptions; the release pipeline.
**Roles:** anonymous visitor, learner, reviewer (scoped by `ReviewerScope`), admin and author (roles exist; no UI to grant them, set by `scripts/roles.ts`), owner/operator (cPanel, GitHub, Neon access).
**Trust boundaries:** browser ↔ LiteSpeed/Passenger ↔ Next.js app ↔ Neon over TLS; GitHub Actions ↔ release asset ↔ cPanel Terminal; cron ↔ `/api/cron/dispatch`; web push providers.
**Entry points:** `/register`, `/login`, server actions in `(app)`, `/onboarding` and `/privacy`; route handlers `api/evidence` (upload, owner file download), `api/review/.../file`, `api/notifications/*`, `api/push/*`, `api/account/export`, `api/cron/dispatch`, `api/health`.
**External services:** Neon, GitHub (build and release), web-push services, YouTube no-cookie embeds (framed). No email provider, no AI provider, no analytics, no outbound server-side HTTP.
**Actors and abuse scenarios:**
| Actor | Scenario | Control today | Residual |
|---|---|---|---|
| Anyone with the Neon password | Read, change or delete all data | Not in Git or bundle; exposed elsewhere | **High until rotated** (SEC-01) |
| Credential guesser | Password guessing / spraying | Per email+IP, per email and per IP limits; Argon2id; generic errors | Per-IP limits weak if proxy trust unset (SEC-08) |
| Locked-out learner | Cannot recover account | Owner script only | **No self-service** (SEC-03) |
| Dishonest learner | Self-award XP and mastery | Labelled SELF; plan missions protected from the checkbox | Unlimited custom missions and URL-only evidence (SEC-04, SEC-05) |
| Learner A → learner B data | IDOR | Every query scoped by `userId`; 404 for others; tests | Low; keep cross-user tests (see Section 6) |
| Malicious uploader | Stored XSS, malware, storage exhaustion | Content sniffing, extension allow-list, inline only for images/video, `nosniff`, quotas (500 MB/account), rate limits | No malware scan (SEC-15) |
| Compromised dependency | Supply chain | Lockfile, `npm ci` on GitHub | 5 high advisories in the test tool chain (SEC-14); no CI audit |
| Insider/operator error | Wrong release, lost data | Rollback script | No backups of uploads, typed commands (SEC-10, SEC-12) |
| Rogue reviewer | Read evidence they should not | Claim-based access, per-department scope, access log | Requires a reviewer-grant procedure (SEC-17) |

## 4. Findings
Severity scale: CRITICAL, HIGH, MEDIUM, LOW, INFORMATIONAL. "Blocks" means release-blocking for the stated launch.

### SEC-01 Neon owner credential exposed and not rotated
- **Severity:** HIGH. **Status:** OPEN. **Blocks:** supervised beta and public launch.
- **Component:** Neon project `neondb_owner` role; cPanel `DATABASE_URL`; `docs/NEON_CONNECTION_REPORT.md` (line 51 records the exposure and the rotation recommendation). That file is **local to the owner's machine and deliberately excluded from Git** (`.git/info/exclude`), so reviewers working from the repository cannot open it; the other local-only notes cited here are `docs/CPANEL_DEPLOYMENT_REPORT.md` and `docs/ROLLBACK_PLAN.md` (untracked).
- **Description:** The password for the database owner role appeared in clear text in earlier working sessions. The application connects as the same owner role, so a holder of the password can read, alter and delete everything and bypass the application entirely. Neon endpoints are reachable from the internet unless an IP allow-list is configured (NEEDS VERIFICATION).
- **Evidence (verified):** Git history scan: `git log --all -S"npg_"` returned 0 commits; a regex for connection strings with a password and an `ep-` host returned 0 commits; `git grep` of HEAD for the same token prefix returned 0 files; the only `.env` file ever committed is `.env.example`, which holds placeholders. The built frontend (`.next/static`) contains none of `DATABASE_URL`, `CRON_SECRET`, `VAPID_PRIVATE`, the production host or the owner role name (0 of the files). `.gitignore` excludes `.env*` except `.env.example`. Not verified: chat logs, terminal logs, screenshots and clipboard history held outside the repository.
- **Impact:** Full compromise of learner data and integrity if the password reached an untrusted party.
- **Exploitability:** Requires possession of the password plus network access to the Neon endpoint.
- **Remediation:** Rotate (procedure in Section 5), then create a least-privilege application role so the app no longer runs as owner; enable an IP allow-list if the plan supports it; review Neon's audit/connection history for the exposure window.
- **Files:** `.env.neon` (local, ignored), cPanel Node.js App environment, `src/lib/db.ts`, `prisma.config.ts`.
- **Tests required:** none automated; verification procedure below.
- **Verification:** old password fails to connect; `/api/health` reports `database: up`; a sign-in and an upload succeed; `prisma migrate status` still works with the new URL; the old secret string is searched for in the owner's local files.

### SEC-02 A learner password was typed into chat
- **Severity:** MEDIUM. **Status:** OPEN. **Blocks:** no.
- **Description:** During support, an account's password was typed into the conversation. Treat that password as disclosed even though it was never stored or used by the assistant.
- **Remediation:** Change that password. Until password reset exists (SEC-03) this needs the owner tool (`scripts/set-password.ts`, uncommitted) run by the owner, or delete and recreate the account.
- **Verification:** old password refused, new one accepted, previous sessions ended (the tool deletes all of the account's sessions; `tests/set-password.test.ts` proves it).

### SEC-03 No password reset and no email verification
- **Severity:** HIGH. **Status:** OPEN. **Blocks:** supervised beta (recovery by owner script is acceptable for a handful of named testers) and public launch (not acceptable).
- **Component:** `src/app/(auth)/`, `src/lib/auth/`; no email provider exists in `package.json`.
- **Evidence:** a search for `reset`, `verify`, `forgot` and `emailVerified` in `src/` finds only the uncommitted owner tool. The `User` model has no verified-email field or token table.
- **Impact:** a locked-out learner is permanently locked out; anyone can register any email address, including one they do not own, and the real owner cannot reclaim it. Notification and recovery emails cannot be trusted.
- **Exploitability:** trivial: register with another person's address.
- **Remediation:** single-use hashed tokens with short expiry, sent by an email provider; identical response whether or not the address exists; rate limits by address and IP; end all sessions on reset; email verification before reminders by email or any reviewer role.
- **Files (proposed):** `src/lib/auth/recovery.ts`, `src/app/(auth)/forgot-password`, `reset-password`, `verify-email`; migration adding `EmailToken` and `User.emailVerifiedAt`.
- **Tests required:** token single use, expiry, replay, wrong user, enumeration parity, rate limit, session revocation.
- **Verification:** run the flow with a real mailbox on a staging branch; confirm timing and response bodies match for known and unknown addresses.

### SEC-04 Learner credit is self-assigned; URL-only evidence is accepted unchecked
- **Severity:** HIGH for public launch; MEDIUM for a disclosed beta. **Status:** PARTIALLY REMEDIATED (labelling exists). **Blocks:** public launch; beta only if learners are told.
- **Component:** `src/lib/assessments/service.ts` (`assessSubmission`, from line 34), `src/lib/missions/progress.ts` (`submitMission`, line 98).
- **Description:** The learner scores every criterion of their own rubric. A PASS awards the mission XP once (`xpAwarded === 0` guard), marks the mission PASSED, marks evidence VERIFIED and creates skills at tier `SELF_ASSESSED`. Skills only reach `VERIFIED` through a human review (`src/lib/reviews/service.ts:347`). A submission is valid if it has a vault file or any `https` link in `githubUrl` or `liveUrl`; the link is never fetched or checked, so a learner can submit an arbitrary URL and score themselves full marks.
- **Evidence:** `assessorKind: "SELF"`, `status: "SELF_RECORDED"` are written at line 85; `earnsCredit` excludes personal activities and baselines (line 116, XP once at line 117); duplicate assessment of a submission is refused (`status !== "SUBMITTED"`); resubmission increments `attempt`.
- **Impact:** XP, level and skills do not demonstrate competence. No other learner or outside party is harmed, but any certificate, ranking or employer-facing claim built on them would be unreliable.
- **Exploitability:** any learner, with no tooling.
- **Remediation:** decide the credit rule. Minimum: publish the distinction (self-assessed versus reviewed) everywhere XP and skills are shown; require reviewer confirmation for XP on curriculum missions at beta scale; later add automated evidence checks (future scope, see roadmap).
- **Tests required:** PASS without review does not raise reviewed-tier credit; link evidence cannot satisfy a mission that requires a file; duplicate and concurrent assessment attempts award once.
- **Verification:** review the learner screens for labelling; run the new tests.

### SEC-05 XP can be farmed with custom board missions and the checkbox
- **Severity:** MEDIUM. **Status:** OPEN. **Blocks:** supervised beta (integrity of progress), not security of data.
- **Component:** `src/app/(app)/actions.ts:50` (`createMission`), `src/lib/missions/service.ts:106` (`setMissionDone`) and `:156` (`createCustomMission`), `src/lib/missions/schema.ts:14` (`MAX_CUSTOM_XP = 50`).
- **Description:** A learner can create a custom mission worth 5 to 50 XP and tick it done for full XP. `createMission` has no rate limit and no count cap (compare personal activities: `MAX_PERSONAL_ACTIVITIES = 200`, a limiter, and 0 XP). `adjustDepartmentXp` raises the department XP and level. For learners without a plan, the same checkbox also awards the full XP of published curriculum missions. Plan-linked missions are protected (`isPlanLinked`, `src/lib/plan/guards.ts`), and un-ticking revokes the XP, so toggling alone does not farm.
- **Evidence:** read from source as above; not exercised against production. Production has 4 profiles in LEGACY mode (and 6 users without a profile) that are not plan-protected.
- **Impact:** inflated levels for any learner who chooses to; undermines the meaning of progress.
- **Exploitability:** any learner, a few clicks, no tooling.
- **Remediation:** give checkbox missions 0 XP (as personal activities), or cap creation per day and per account with a limiter; refuse the checkbox for published curriculum missions.
- **Tests required:** custom mission yields 0 XP or is capped; creation limited; curriculum mission checkbox refused.
- **Verification:** run the tests; confirm department XP is unchanged after ticking a custom mission.

### SEC-06 Content-Security-Policy is report-only; HSTS is missing; the policy allows inline scripts
- **Severity:** MEDIUM. **Status:** OPEN. **Blocks:** public launch.
- **Component:** `next.config.ts:26`, LiteSpeed.
- **Evidence (live response headers, 2026-11-18):** `Content-Security-Policy-Report-Only` present on `/`, `/login` and `/api/health`; no `Content-Security-Policy` (enforced) header; no `Strict-Transport-Security` header; policy contains `script-src 'self' 'unsafe-inline'`. Present and enforced: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), microphone=(), camera=()`. Authenticated pages return `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` (`/login` sampled; private pages not sampled while signed in, NEEDS VERIFICATION). `X-Powered-By: Next.js` is sent.
- **Impact:** a stored or reflected script injection would not be blocked by the browser; no protection against HTTPS downgrade on first visit.
- **Remediation:** collect reports, move to nonce-based scripts, enforce; send HSTS (start with a short `max-age`, no `includeSubDomains` until subdomains are known); set `poweredByHeader: false`.
- **Tests:** a header test in `tests/` that reads `next.config.ts`; an end-to-end check of the live response.
- **Verification:** `curl -I` on production shows the enforced header and HSTS; browser console shows no violations on the main journeys.

### SEC-07 Production serves `X-Frame-Options: SAMEORIGIN`, the code sets `DENY`
- **Severity:** LOW. **Status:** NEEDS VERIFICATION. **Blocks:** no.
- **Evidence:** `next.config.ts:27` sets `DENY`; the live response shows `SAMEORIGIN` (`curl -I` against the production address). A front layer (LiteSpeed or cPanel) overrides it. `frame-ancestors 'none'` exists only in the report-only policy.
- **Impact:** the application can be framed by itself only; same-origin framing is low risk. The mismatch shows that headers are modified outside the repository.
- **Remediation:** find where it is set (cPanel/LiteSpeed rules or `.htaccess`), remove the override or accept it in writing, and enforce `frame-ancestors 'none'` with SEC-06.

### SEC-08 Client IP trust is not configured behind LiteSpeed
- **Severity:** MEDIUM. **Status:** NEEDS VERIFICATION. **Blocks:** supervised beta (verify), public launch (fix).
- **Component:** `src/lib/ratelimit.ts:33-49` (`clientIp`), env `TRUSTED_PROXY_HOPS` (unset in production).
- **Description:** With the variable unset, the function uses `x-real-ip` and then the left-most `x-forwarded-for` value, which a client can set. If LiteSpeed does not overwrite them, an attacker can rotate fake addresses to evade per-IP limits (`registerIp` 20 per hour, `loginIp` 60 per 15 minutes, `evidenceIp` 150 per hour). Per-email limits (`loginEmail` 25 per hour) still apply.
- **Exploitability:** unknown until header behaviour is checked.
- **Remediation:** determine what LiteSpeed forwards, set `TRUSTED_PROXY_HOPS` accordingly.
- **Verification:** from two networks, confirm the stored IP in a `Session` row (not printed here) matches the real address and cannot be set by a request header.

### SEC-09 The rate limiter fails open
- **Severity:** LOW. **Status:** ACCEPTED RISK (design) pending decision. **Blocks:** no.
- **Evidence:** `src/lib/ratelimit.ts:69` (also line 82): on a database error it logs and allows the request. Sign-in itself needs the database, so the practical exposure is small.
- **Remediation:** keep, but add an alert on repeated limiter errors and fail closed for login and registration if monitoring shows sustained outages.

### SEC-10 Uploaded evidence is unprotected by backup; old evidence may be stranded
- **Severity:** MEDIUM (data loss). **Status:** OPEN. **Blocks:** supervised beta.
- **Evidence:** files live in `~/jokzet-data/evidence` (`STORAGE_DRIVER=local`, `src/lib/storage/index.ts`). `docs/CPANEL_DEPLOYMENT_REPORT.md:27` lists the backup as an unowned item. Earlier uploads may be in Netlify Blobs, which is unreachable (the old site returns a usage-exceeded error). Production has 2 submissions; whether their files exist was not checked.
- **Remediation:** scheduled copy of the folder to storage outside the account; restore drill; locate or retire Netlify Blobs data.

### SEC-11 Six production users have no profile row
- **Severity:** MEDIUM (integrity). **Status:** OPEN. **Blocks:** no, fix before beta.
- **Evidence:** read-only aggregate query on 2026-11-18: 14 users, 8 profiles; the 6 without one were created on 2026-11-12 and 2026-11-13, have 18 or 19 learner missions and 9 department records each, 0 to 4 sessions. Registration creates the profile in the same transaction, so these likely predate the profile model or came from another path (cause NEEDS VERIFICATION).
- **Impact:** code that reads the profile uses defaults; the onboarding gate treats these as non-personalised; adult confirmation and timezone are absent.
- **Remediation:** a reviewed, additive backfill migration, and a guard in `requireUser` or registration.

### SEC-12 No automated gate in the release pipeline
- **Severity:** MEDIUM. **Status:** OPEN. **Blocks:** public launch.
- **Evidence:** `.github/workflows/` contains only `cpanel-release.yml`, which runs `npm ci`, `next build` and packaging; it runs no lint, typecheck, tests or `npm audit`. Deployment on the server is by hand-typed commands.
- **Remediation:** a pull-request workflow (lint, typecheck, tests against a service database, audit); a release workflow that depends on it; a single short deploy command.

### SEC-13 Learners who have not confirmed a plan cannot reach Privacy or Settings
- **Severity:** LOW (privacy rights usability). **Status:** OPEN. **Blocks:** no.
- **Evidence:** `/privacy` and `/settings` sit inside the gated `(app)` shell; `api/account/export` is not gated.
- **Remediation:** exempt those two routes from the onboarding redirect while keeping authentication.

### SEC-14 Dependency advisories in the test tool chain
- **Severity:** LOW. **Status:** OPEN.
- **Evidence:** `npm audit --omit=dev`: 5 high, 0 critical (`vitest` direct; `vite`, `picomatch` (ReDoS), `tinyglobby`, `fdir` transitive). `vitest` is listed by npm as direct in the production audit; check it sits in `devDependencies` (`package.json` line 64 area) and is not installed on the server. No known advisory in `next`, `react`, `prisma`, `pg`, `zod`, `@node-rs/argon2` or `web-push` was reported.

### SEC-15 No malware scanning of uploads
- **Severity:** LOW. **Status:** ACCEPTED RISK pending decision.
- **Evidence (controls present):** content sniffing for PNG, JPEG, GIF, WebP, PDF, MP4, WebM (`src/lib/evidence/files.ts`); extension allow-list; `.env`, key and certificate names refused; text files must be valid UTF-8; sizes 10 MB image, 20 MB PDF, 50 MB video, 1 MB code; 500 MB per account; filenames sanitised; files stored outside the web root and served by an owner-checked route (`src/app/api/evidence/[id]/file/route.ts`) with `nosniff`; only images and video render inline; secret detection on text. Scripts are stored as inert `text/plain`.
- **Residual:** a PDF or media file could carry an exploit for a viewer; reviewers open these files. Mitigate with a scan service before beta scale, and reviewer guidance.

### SEC-16 Session management gaps
- **Severity:** LOW. **Status:** OPEN.
- **Evidence (controls present):** 32 random bytes, only the SHA-256 hash stored, 14-day expiry renewed in the last 7 days, cookie `__Host-jz_session` HttpOnly Secure SameSite=Lax, a fresh token on every sign-in (no fixation), logout deletes the row and cookie, deactivated users resolve to no session, expired sessions purged. **Gaps:** no "sign out everywhere" or session list for learners; sessions are not revoked on password change except by the owner tool; sign-in does not notify by email (no email).

### SEC-17 Reviewer and admin roles have no grant workflow or audit view
- **Severity:** LOW. **Status:** OPEN. **Blocks:** beta if reviewers are used.
- **Evidence:** roles are set by `scripts/roles.ts`, with a `RoleAudit` table; reviewer file access is scoped and logged (`EvidenceAccessLog`, `tests/review-routes.test.ts`); all 14 production users are learners. No UI shows who holds roles.

### SEC-18 Neon Auth experiment present in the working tree
- **Severity:** MEDIUM if committed by mistake; INFORMATIONAL as it stands. **Status:** OPEN (not deployed).
- **Evidence:** untracked routes `src/app/api/auth/[...path]/route.ts` and `src/app/neon-auth/page.tsx`; edits to `src/proxy.ts` and dependencies; env names `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`. The committed `proxy.ts` is the audited one. Merging it would add a second, unreviewed authentication surface.
- **Remediation:** either remove it or review it as its own change; never include it in an unrelated commit.

### SEC-19 Operations: monitoring, logs, incidents, file permissions
- **Severity:** MEDIUM. **Status:** NEEDS VERIFICATION. **Blocks:** supervised beta (minimum monitoring).
- **Evidence:** the application writes five `console.error` messages and nothing else (`src/instrumentation.ts`, `src/lib/ratelimit.ts`, `src/lib/privacy/deletion.ts`); no error reporting, no uptime check, no incident procedure document. The deploy scripts are tracked as mode 100644 and run with `bash`, which is fine. Permissions of `~/jokzet-data`, `~/.jokzet-cron.curl` (script sets mode 600) and the release folders were not inspected (no server access).

### SEC-20 Reminders cron not installed
- **Severity:** LOW (availability). **Status:** OPEN.
- **Evidence:** `deploy/cpanel/install-cron.sh` exists and writes the Bearer secret to a mode 600 file so it never appears in the crontab; `hasValidCronSecret` uses `timingSafeEqual` (`src/lib/http.ts:29-35`); the route is closed when no secret is set. The cron line has not been added. An optional in-process scheduler exists (`ENABLE_IN_PROCESS_SCHEDULER`) but depends on Passenger keeping the process alive.

### SEC-21 No SSRF or code-execution surface today
- **Severity:** INFORMATIONAL.
- **Evidence:** a search of `src/` for `fetch(` finds only browser-side calls to the app's own routes; no server code fetches a user-supplied URL; submitted `githubUrl`/`liveUrl` and evidence links are validated as `https` and stored (`httpsUrl` in `src/lib/missions/progress.ts`; regex in `src/lib/evidence/service.ts:23`), rendered as links with `rel="noopener noreferrer"`. `javascript:` and `data:` links are rejected by the scheme check. No feature executes learner code.
- **Forward note:** every future feature that fetches a link (repository inspection, live-site checks, screenshots) becomes an SSRF surface and must apply the controls in Section 7.

### SEC-22 AI assessment is future scope
- **Severity:** INFORMATIONAL.
- **Evidence:** no DeepSeek or other provider code, configuration or dependency exists (search of `src/`, `prisma/`, `scripts/`, `package.json`). The only mention is the AI curriculum. Nothing here is a current vulnerability. Requirements for the future feature are in Section 7.

## 5. Safe rotation procedure for the Neon credential (to be run by the owner; not run by this audit)
1. Choose a quiet time. Note the current release folder name for rollback.
2. In the Neon console, create a **new role** for the app with only the privileges it needs on the application schema (`SELECT, INSERT, UPDATE, DELETE` on tables, `USAGE` on sequences); keep the owner role for migrations only. If a new role is not wanted, reset the owner password.
3. Copy the new pooled connection string into the cPanel Node.js App environment variable `DATABASE_URL` by typing or the cPanel UI; do not paste it into chat, tickets or Git.
4. Restart the app. Check `/api/health` returns `database: up`, sign in with a test account, upload a small image, confirm it reappears.
5. Reset the **old** owner password in Neon so it stops working; confirm a connection attempt with the old string fails.
6. Update the local ignored `.env.neon` with the migration role string only on the owner's machine; confirm `.env*` is still ignored (`git check-ignore`).
7. Review Neon's connection and query history for the exposure window for unfamiliar sessions or clients.
8. Search the owner's local notes, shell history and downloads for the old string and remove copies.
9. Record the date and result in the operations log (no secret in it).
**Rollback:** if the app cannot connect, put the old string back temporarily (only if it was not the compromised one) or fix the new role's grants; do not leave the app without a working connection.

## 6. Verification matrix: authorisation and ownership (reviewed in source and by tests)
| Surface | Result | Evidence |
|---|---|---|
| Server actions in `(app)` | Use `requireOnboardedUser` and pass `user.id` into services | `src/app/(app)/actions.ts`, `review/actions.ts`, `timetable/actions.ts` |
| Learner evidence file | Owner only, 404 otherwise | `api/evidence/[id]/file/route.ts`, `tests/review-routes.test.ts` |
| Reviewer evidence file | Only for a claimed request in scope; access logged | `api/review/...`, `tests/review-routes.test.ts` (6 tests) |
| Uploads | Same-origin, rate-limited, onboarding-gated | `api/evidence/route.ts`, `tests/security-routes.test.ts` |
| Notifications, push | Session required, 401 otherwise | `tests/security-routes.test.ts` |
| Learning plans, goals, baselines | Every query filters `userId`; composite `(id, userId)` keys | `prisma/schema.prisma` (`@@unique([id, userId])` at lines 553 and others), `src/lib/plan/*.ts`, `tests/onboarding-flow.test.ts` (cross-user confirm refused) |
| Export and deletion | Password and phrase required, rate limited, audited | `src/lib/privacy/*`, tests |
| Cron | Bearer secret, constant-time compare | `src/lib/http.ts`, `src/app/api/cron/dispatch/route.ts` |
Gaps to test: an automated sweep that calls every route and action as learner B with learner A's identifiers; a test that a REVIEWER of one department cannot read another's evidence beyond the claim (partly covered).

## 7. Requirements for future features
**URL fetching (repository, live site, screenshots):** resolve DNS server-side and reject loopback, private, link-local and metadata addresses (IPv4 and IPv6); re-validate after every redirect and cap redirects; pin the resolved address for the connection (DNS rebinding); allow only `https` and ports 443; cap response size and total time; no cookies or credentials; fetch from an isolated worker, not the web process; log every fetch.
**AI assessment:** key only in server environment; provider behind an interface; learner text and fetched content passed as data, never as instructions; strict JSON schema validation with safe fallback; retries and timeouts; daily spend and per-learner limits; idempotency key per submission and rubric version; store model, prompt version and raw result for audit; low confidence or schema failure escalates to a human; AI output never awards credit alone until trust is established.
**Code execution:** never on the web server; isolated sandbox service with no network, CPU, memory and time limits, separate credentials.

## 8. Remediation roadmap
**Immediate (before any further work that could expose data):** SEC-01 rotation and role split; SEC-02 password change.
**P0 (before supervised beta):** SEC-03 minimum (owner-run recovery procedure documented, reset flow scheduled); SEC-04 labelling and reviewer confirmation for beta credit; SEC-05 close the XP loophole; SEC-08 verify and set proxy trust; SEC-10 backups; SEC-11 profile backfill; SEC-19 minimum monitoring; SEC-20 cron.
**P1 (before public launch):** SEC-03 full reset and verification; SEC-06 enforced CSP and HSTS; SEC-07; SEC-12 CI gate; SEC-13; SEC-17 role workflow; SEC-04 independent verification design.
**P2 (ongoing hardening):** SEC-14 dependency hygiene schedule; SEC-15 upload scanning; SEC-16 session controls; SEC-09 limiter alerting; periodic restore drills; quarterly access review.
**P3 (future):** Section 7 controls with each new capability; penetration test before general launch; bug-report channel.
Effort for the P0 and P1 security items is itemised in `docs/REMAINING_DEVELOPMENT_PHASES.md`.

## 9. Information not verified
Neon console settings (roles, IP allow-list, backup window); cPanel account security (SSH, 2FA, file permissions); LiteSpeed header rewriting; real headers on authenticated pages; whether evidence from the earlier Netlify storage still exists; email deliverability (no email exists); Node 24 runtime behaviour of the full test suite (tests ran on the audit machine's Node 26).
