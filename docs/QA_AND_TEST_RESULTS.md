# QA and Test Results

Audit date: 2026-11-18. Audited commit: `738ae0f` (master, merge of PR 32). Working directory: `jokzet-command-center/`.
The working tree also holds uncommitted, unrelated files (Neon Auth experiment, owner set-password tool). They were not deployed and are listed under "Caveats".

## Environment
| Item | Actual |
|---|---|
| Node.js (audit machine) | v26.1.0 (production runs Node 24.22.3 on cPanel, see the CPANEL_NEON report) |
| Next.js | 16.4.6 |
| React / React DOM | 19.3.0 |
| TypeScript | ^5 (resolved by lockfile) |
| Prisma / client / pg adapter | ^7.10.1 / ^7.10.1 / ^7.10.1 |
| Password hashing | `@node-rs/argon2` ^2.2.2 (not `argon2`) |
| Tailwind CSS | 4.3.3 |
| Vitest | ^4.1.12 |
| Zod | ^4.6.7 |
| Other | web-push ^4, recharts ^3.10.1, date-fns-tz ^3.2 |

## Commands run and results
| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `npx eslint` | 0 | No errors or warnings. |
| 2 | `npx tsc --noEmit` | 0 | Clean. A first run exited 2 with `TS6053` because a temporary read-only helper script that I created and deleted during the audit was in the TypeScript include set at that moment. It was re-run after the helper was removed and exited 0. Not an application defect. |
| 3 | `npx vitest run --reporter=json` | 0 | **37 test files, 523 tests: 523 passed, 0 failed, 0 skipped.** Runs against the local test database (`TEST_DATABASE_URL`, host `localhost`), never production. Several test files run the curriculum seed against that local test database in their setup. |
| 4 | `npm run build` | 0 | Compiled successfully; 41 static pages generated. |
| 5 | `npm audit --omit=dev` | 1 (findings) | 5 high, 0 critical. All in the chain `vitest → vite → picomatch / tinyglobby / fdir` (see SECURITY report, finding S-12). |
| 6 | Secret-pattern scan of tracked files (`git grep`) | n/a | Only `.env.example` placeholders and one fake key used as a fixture in `tests/mission-drafts.test.ts`. No real secrets found. |

Not run: `npm run typecheck` (it runs `next typegen` first; plain `tsc --noEmit` was used instead), browser end-to-end tests (no browser test suite exists), load tests, accessibility tooling, Lighthouse. No performance numbers are reported because none were measured.

## Test files by area (tests per file)
Auth 12, security-hardening 19, security-routes 6, review-routes 6, reviews 17, evidence 35, assessments 9, assessment-foundations 13, missions 9, schedule 32, notifications 29, availability 14, plan-availability 10, plan-generate 33, plan-service 24, reschedule 16, reschedule-service 14, timetable 8, timetable-service 12, onboarding 18, **onboarding-flow 18 (new)**, resources 18, curriculum-framework 22, mission-drafts 26, privacy (account-deletion 8, data-export 11, privacy-audit 7, privacy-centre 3, privacy-policy 13, age-confirmation 4), database 7, storage-blobs 4, cpanel-readiness 9, businessos 10, activities 16, portfolio-analytics 8, set-password 3.

## What the tests do not cover
- No test drives a real browser through registration → onboarding → confirmation. Server functions are tested directly; the wizard component has no component or end-to-end test.
- Server actions and route handlers are tested through their service functions; the new onboarding gate for server actions (`requireOnboardedUser`) is covered indirectly (the route tests mock it).
- No test exercises the live cPanel environment, Passenger, cron or the Neon production database.
- No concurrency or load test. No accessibility test. No CSP-enforcement test (CSP is report-only).

## Live checks performed against production (this session, before the audit)
Throwaway accounts were created and deleted via the privacy script: sign-up redirects to `/onboarding`; private pages redirect to `/onboarding` through the streamed redirect; upload and reminder-poll APIs return 401 for an unfinished learner; `/api/health` reports database up. The full wizard-to-confirmation path was **not** exercised on production.

## Caveats
- The audit machine runs Node 26, production Node 24; the build and tests have not been run under Node 24.
- Uncommitted working-tree files (not deployed): `src/app/neon-auth`, `src/app/api/auth`, `src/lib/neon-auth`, `neon.ts`, modified `package.json` / `proxy.ts`, `scripts/set-password.ts`, `src/lib/auth/reset.ts`. Lint, typecheck, tests and build above ran with those files present; production was built from the committed code only.
