# Security Audit Report

Audit date: 2026-11-18. Code: `738ae0f`. Defensive code review plus safe checks only. No exploitation, no production mutation.
(An earlier report exists at `docs/audit/SECURITY_AUDIT_REPORT.md`; it is preserved and this report supersedes it for the current code.)

## Summary
No Critical findings. Three launch blockers (S-01 password recovery, S-02 exposed database credential, S-03 evidence-free and self-assessed credit). The basics are done well: Argon2id, `__Host-` HttpOnly Secure cookie, database-backed rate limits, owner-scoped queries, same-origin checks, a server-side onboarding gate, a privacy export/delete path with an audit trail. The weaknesses are in recovery, credit integrity, header enforcement and operations.

## Findings
| ID | Sev | Finding | Blocks launch |
|---|---|---|---|
| S-01 | High | **No password reset and no email verification.** No email service exists. A learner who forgets their password cannot recover the account; the only route is the owner running `scripts/set-password.ts`, which is uncommitted and local-only. Accounts are not tied to a verified address. | Yes |
| S-02 | High | **Database credential exposed.** The Neon `neondb_owner` password appeared in clear text in earlier working sessions and has not been rotated (`docs/NEON_CONNECTION_REPORT.md`). A password for a throwaway-test account was also typed into chat. | Yes (rotate before real learners) |
| S-03 | High | **Credit is self-assigned.** `assessSubmission` (`src/lib/assessments/service.ts`) lets the learner score their own work against the rubric and receive XP, skills and a PASS. Evidence must exist but nothing inspects it. Human review exists (`ReviewRequest`) but is optional. There is no AI or automated evidence check anywhere in the code. | Yes for any public claim of verified skills; acceptable for a closed beta if disclosed |
| S-04 | Medium | **Evidence-free XP for non-plan work.** `setMissionDone` (`src/lib/missions/service.ts:106`) awards the mission's full `xpReward` with a checkbox for any mission not linked to a plan, including published curriculum missions, for LEGACY learners (4 production profiles) and anyone without a plan. Plan-linked missions are protected. Custom missions are capped at 50 XP each, with no count cap found in the code reviewed. | No (beta), Yes for leaderboards or credentials |
| S-05 | Medium | **CSP is report-only and there is no HSTS header.** `next.config.ts` sends `Content-Security-Policy-Report-Only`; `Strict-Transport-Security` is not set anywhere in the app. X-Frame-Options DENY is set. | No |
| S-06 | Medium | **Client IP trust not configured.** `TRUSTED_PROXY_HOPS` is unset in production, so IP-based rate limits depend on unverified header handling behind LiteSpeed. Per-account limits still apply. | No (verify before launch) |
| S-07 | Medium | **Users without a profile.** 6 of 14 production users (created 2026-11-12 and 13) have no `Profile` row. They have missions and department progress but no display name, timezone or learner mode. The onboarding gate treats them like legacy learners; features that read the profile fall back to defaults. Cause not established. | No, repair needed |
| S-08 | Medium | **Account self-service blocked during onboarding.** The Privacy page is inside the gated app area, so a learner who has not confirmed a plan cannot reach Settings or Privacy to delete or export data. The API export route is separate. | No |
| S-09 | Medium | **Uploaded evidence has no backup, and old evidence may be stranded.** Files now live on the cPanel disk (`~/jokzet-data/evidence`). The earlier storage was Netlify Blobs, which is unreachable (site down). Production has 2 submissions; whether their files exist was not checked. | No (data loss risk) |
| S-10 | Medium | **No CI gate.** The only workflow (`cpanel-release.yml`) builds the release. Nothing runs lint, typecheck, tests or `npm audit` on pull requests. | No |
| S-11 | Low | Neon Auth experiment present in the working tree (routes `/neon-auth`, `/api/auth/[...path]`). Not committed, not deployed. It must not ship unreviewed. | No |
| S-12 | Low | `npm audit --omit=dev`: 5 high (vitest/vite chain: picomatch ReDoS, tinyglobby, fdir). Dev tooling; confirm `vitest` sits in `devDependencies` and is not installed on the server. | No |
| S-13 | Info | `.env.example` and one test fixture match secret patterns; both are placeholders. No real secret in tracked files. | No |
| S-14 | Info | No server-side outbound `fetch` exists, so there is no SSRF surface today. This will change when repository/site inspection is built. | n/a |

## Verified controls (code and tests)
- Passwords hashed with Argon2id; generic failure messages for sign-in and sign-up (no enumeration); login limits per IP, per email+IP and per email.
- Session: random token, only the hash stored, 14-day sliding expiry, cookie `__Host-jz_session` HttpOnly, Secure, SameSite=Lax; sessions revoked on password change (set-password tool).
- Authorization: queries filter by `userId`; evidence files are owner-only; reviewer access is scoped, claimed, audited (`EvidenceAccessLog`) and returns 404 to others (`tests/review-routes.test.ts`).
- Same-origin enforcement on state-changing routes; `APP_URL` allow-listed.
- Upload validation by content, secret detection on text fields, per-user and per-IP upload limits.
- Onboarding gate enforced in the page shell, in all server actions of the app area and in the evidence, notification, push and review APIs (since PR 32).
- Privacy: export, deletion with password and phrase, audit trail without personal data, adult self-declaration at sign-up.
- Untrusted learner code is never executed: nothing in the app runs learner code (no execution feature exists).

## Not assessed (no access or out of scope)
Live penetration testing, TLS configuration beyond a working HTTPS site, LiteSpeed/Passenger hardening, cPanel account security, Neon project access control and IP allow-lists, secrets stored in cPanel environment variables, dependency licence review.

## Prioritised remediation
1. Rotate the Neon owner password and update the cPanel `DATABASE_URL` (S-02). 0.5 day.
2. Build password reset with a real email provider, plus email verification (S-01). 5 days.
3. Decide the credit model: require human review or automated verification before XP/PASS on curriculum missions; remove evidence-free XP for published missions (S-03, S-04). 3 to 6 days, more with AI.
4. Set `TRUSTED_PROXY_HOPS` after confirming the real forwarded-header behaviour (S-06). 0.5 day.
5. Repair the six profile-less users and add a constraint or creation guard (S-07). 0.5 day.
6. Enforce CSP and add HSTS (S-05). 1.5 days.
7. Backup and recover evidence storage; locate or retire Netlify Blobs data (S-09). 1.5 days.
8. Add a CI job for lint, typecheck, tests and `npm audit` (S-10, S-12). 1 day.
9. Let unfinished learners reach Privacy/Settings (S-08). 0.5 day.
