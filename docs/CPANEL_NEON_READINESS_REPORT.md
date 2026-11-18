# cPanel and Neon Readiness Report

Audit date: 2026-11-18. Production: https://jokzet-labs.iipghstudent.com (cPanel, CloudLinux Setup Node.js App, Passenger/LiteSpeed). Database: existing Neon project, kept as production.
Server-side facts below come from this project's own deployment records and the commands the owner ran in the cPanel Terminal. I had no direct shell on the server during this audit, so anything marked BLOCKED was not re-checked.

## Hosting status
| Check | Status | Evidence |
|---|---|---|
| App live and serving | VERIFIED | `/api/health` returned `{"status":"ok","database":"up"}` after release `cpanel-20261116-173147-738ae0f`. |
| Runtime | VERIFIED (earlier) | Node 24 environment active in the Terminal; `argon2` native library loads (fetch script prints it). |
| Build location | VERIFIED | Built on GitHub Actions (ubuntu), because the server's glibc 2.28 cannot load the Next.js SWC binary. The workflow fails the build if any native file needs glibc above 2.28. |
| Deploy procedure | VERIFIED, manual | `fetch-release.sh` then `switch-release.sh` run by the owner in the Terminal. Typed by hand (paste is blocked); works but is error-prone (two typos occurred). |
| Rollback | DOCUMENTED, not drilled | `switch-release.sh <previous release>`; previous releases are kept in `~/releases`. Netlify is no longer a fallback (site returns `usage_exceeded`). |
| The old nested-root CloudLinux error | Not repeated | App root is `~/jokzet-command-center`; the Node environment sits at `~/nodevenv/jokzet-command-center/24`. |
| SSL | VERIFIED working (HTTPS serves). Certificate renewal and HSTS: not checked. |
| Environment variables | PARTLY VERIFIED | App runs, so `DATABASE_URL`, `APP_URL`, storage variables are set. `TRUSTED_PROXY_HOPS` is **not set**. `CRON_SECRET`, push (VAPID) keys: not verified. |
| Cron / reminders | **NOT INSTALLED** | The endpoint `POST /api/cron/dispatch` exists and is secret-protected; `deploy/cpanel/install-cron.sh` exists; the cPanel cron line has not been added. Until it is, server-side reminders do not fire (the in-app poll only covers open browsers). 0 push subscriptions exist. |
| File storage | WORKING, UNPROTECTED | Local disk `~/jokzet-data/evidence`, outside the web root. No backup exists. |
| Logs | Passenger/stderr logs only | No application logging library, no error monitoring, no alerting. |
| Resource limits | UNKNOWN | Memory, process and entry limits of the plan were not measured. |
| Concurrent users | UNTESTED | No load test. |

Conclusion: the application can run on this plan and is running. It is operable but fragile: manual typed deployments, no monitoring, no cron, no backups of uploads.

## Neon status
| Check | Status | Evidence |
|---|---|---|
| Migrations | VERIFIED | `prisma migrate status` against production: 19 migrations, schema up to date after `20261126090000_onboarding_states` (additive enum values). Done on 2026-11-16 with the owner's approval. |
| Schema drift | Not checked beyond migrate status. |
| Production data shape (aggregate counts only) | VERIFIED | 14 users (all learners), 8 profiles, 2 ACTIVE plans, 1 DRAFT, 2 submissions, 1 assessment, 1 review request, 3 reminder settings, 19 sessions, 9 departments, 9 levels, 18 published curriculum missions, 19 rubrics, 0 learning resources. |
| Data anomaly | FOUND | 6 users have no profile (see Security S-07). |
| Connection | Works. The pooled host is used. `pg` prints an `sslmode` deprecation warning (use `verify-full`). A Prisma transaction timeout (P2028) was seen once on a cold, scaled-to-zero branch; transaction wait/connection timeouts should be raised. |
| Backup and recovery | **WEAK** | A manual restore point (`backup-pre-phase1-5…` branch) exists from an earlier phase. No scheduled backup is configured by the project. Neon's own point-in-time window depends on the plan and was not verified. |
| Credentials | **EXPOSED** | The owner password appeared in clear text earlier and is not rotated. |
| Indexes / performance | Not profiled; no slow-query data was collected. |

## Blocking items before real learners
1. Rotate the Neon owner password and update `DATABASE_URL` in cPanel.
2. Install the reminders cron.
3. Decide and configure backups: Neon restore/PITR plan, plus a scheduled copy of `~/jokzet-data/evidence`.
4. Set `TRUSTED_PROXY_HOPS` after confirming headers.
5. Add basic monitoring (uptime check on `/api/health`, log review routine).

## Recommended improvements
Automate the deploy so it needs no typing (a single script the owner runs with one short command); raise Prisma timeouts; move the database URL to `sslmode=verify-full`; document the Node 24 versus audit-machine Node mismatch; test one rollback.
