# Administration Centre, Phase 2

Branch `feature/admin-phase2`, on top of Phase 1 (`docs/ADMIN_CENTRE_PHASE1.md`). **Not deployed. No schema change, no migration.**

## New pages (Academy Admins only)
| Route | What it shows |
|---|---|
| `/admin/ai` | **AI Assessment Centre.** Job states as stored (processing, waiting to retry, completed, scored for review, stopped), provider and settings (switched on or off, provider, model, whether a key is present, never the key), 30-day job and token counts, jobs stopped on a provider problem with a re-run button, the 20 most recent jobs. A "Check the provider now" button makes one real, tiny call and reports exactly what came back. |
| `/admin/learners` | **Learner directory.** Name, email, joined, onboarding state, courses, last recorded activity, lessons passed, assessments submitted. Search by name or email; filter by active, inactive or not finished onboarding; filter by course; 25 per page. Holds no evidence, scores or feedback. |
| `/admin/curriculum` | **Content quality.** Per-programme table (published lessons, with a main resource, with a rubric), lessons missing a main resource, assessments without a rubric, resources awaiting review, links not checked in 30 days, a filterable resource table (programme, review status, type), and a "Verify links now" button. |

## What is true, and what is deliberately not claimed
- "Operational" appears only after a real call to the provider succeeded just now; a refusal names the reason in plain words (no credit, bad key, and so on). If AI is switched off no call is made. The check is limited to one a minute per administrator and the result is shown once, never stored.
- **Cost is not estimated.** The Academy stores no price for the provider, so a figure would be invented. Tokens are shown; cost is read from the provider's own billing page.
- Failed AI work never produces a score (unchanged); this page only reports it.
- The learner directory shows administrators and staff nowhere (learners only).
- Resources have no "assigned reviewer" in the data model (each approval records a named approver), so there is no such filter. Curriculum drafts live in code, not the database, so they are not listed here.

## Link verification (safety)
Only approved resources whose link still passes the host allow-list are requested, to the same host, with redirects never followed, an 8-second limit, no body read, four at a time, at most 80 links, and at most once every ten minutes per administrator. YouTube videos are checked with YouTube's own lookup (a 200 means the video exists and is public). A link that answers gets today's date; one that does not is reported, never approved or removed silently. A link whose host has left the allow-list is not requested at all.

## Permissions and tests
Every page, action and service call checks the Academy Admin role on the server (services re-read the account from the database). `tests/admin-phase2.test.ts` (8): refusal of non-admins, job counts, no key or learner in the AI data, the provider check (success, refusal, switched off, rate limit), directory search and filters including the search-plus-filter case, wildcard handling, quality checks against stored data, link verification with a fake network (allow-list, redirects, failures, rate limit). Browser: `e2e/admin-centre.spec.ts` extended to the new pages at desktop and phone width.

## Still to do
Learner detail pages and support actions (suspend, enrolment changes), the audit log, extra roles (Super Admin, Support Admin, System Operator), the draft-to-published resource workflow, analytics, reports, notifications, settings and system-monitoring pages. The role, audit and workflow items need a schema change and your approval to migrate.
