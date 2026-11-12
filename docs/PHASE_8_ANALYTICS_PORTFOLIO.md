# Phase 8 — Analytics and Portfolio

Status: built and verified locally. **Not yet applied to Neon and not pushed**, so the client's live site does not have it.

## What was built

### Portfolio (`/portfolio`, replaces the "Not built yet" stub)
Ported from the Base44 Portfolio page (same header copy, capstone card with 8-segment stage bar, 3-column piece grid, status chips, empty state, "New portfolio piece" modal).

- Pieces: create, edit, delete. Status Concept / Building / Shipped (stored as PLANNED / IN_PROGRESS / COMPLETED; shipping stamps a completion date).
- Fields: title, lead department, summary, tools (split into a list), repository link, live link, cover image.
- Capstone: one per learner, with a stage bar; "advance" and "back" move one stage, edit changes name/summary/tools/stage count/links. Stages are `CapstoneMilestone` rows, so the dashboard capstone strip reads the same data. Finished stages are never deleted when the stage count is reduced.
- Also shown: assessment result on mission-linked pieces, a "Skills gained" panel grouped by department.

### Analytics (`/analytics`, new)
- Tiles: learning hours, missions completed, skills gained, average score.
- Charts (Recharts, Base44 chart colours): learning hours per week (8 weeks), mission completion by department, assessment scores over time. Each chart has a hidden data table for screen readers.
- Department progress list (level, XP, done of curriculum, hours, average score).
- Weekly report (8 weeks) and monthly report (6 months): hours, missions, skills, checkpoints, average score.
- Weeks start Monday and all dates are bucketed in Africa/Accra.

### How hours are counted
Each finished board mission counts once (logged minutes if any, otherwise the mission's planned duration), plus each daily mission marked COMPLETED (its template duration). Activity records are not used, to avoid double counting.

## Security
- Every query is scoped to the signed-in user; ids from the client are only ever matched together with `userId`.
- Repository/live links must be `http(s)://`; links and text are scanned for secrets.
- A cover image must be an image in the learner's **own** evidence vault; it is served through the existing authenticated, owner-only route. Deleting the evidence just removes the cover.
- "Add from passed mission" only works for missions the learner has passed and never adds one twice.

## Database
Migration `20261113090000_portfolio_cover_and_capstone_tools`: `PortfolioProject.coverEvidenceId` (FK to evidence, SET NULL) and `CapstoneProject.tools`. Both columns are additive and nullable/defaulted. Applied to local dev and test databases. **Neon still needs it** (see below).

## Verification (real results)
- `tsc --noEmit`, `eslint`, `next build`: clean.
- Vitest: 9 files, **146 tests pass** (8 new in `tests/portfolio-analytics.test.ts`: tool parsing, owner isolation, validation, cover ownership, passed-only showcase, capstone stage rules, week/month keys, per-period hours/missions/skills, empty user).
- Browser (local, seeded test account, since deleted): added a passed mission to the portfolio, set up the capstone, advanced to stage 1 of 8, viewed Analytics (2.6h = 60+50+45 min, 3 missions, charts rendered). One bug found and fixed: a client-file helper was called from the server page.
- Not verified: pixel-level comparison of the two new pages against Base44 (Analytics has no Base44 original), mobile layout of the new pages, the live site.

## Needs your approval (design rules)
1. **New "Analytics" nav item** (after Reminders, before Settings). The Base44 nav had no Analytics page.
2. **Capstone** is created from the Portfolio page and tracked in stages named "Stage n"; Base44 stored a single stage counter.
3. **Cover image** comes from your evidence vault instead of Base44's free-text cover-image URL (so no third-party image hosts and nothing is hot-linked).
4. **"Ready to showcase"** panel (passed missions you can add in one click) and **"Skills gained"** panel are additions.
5. Analytics page layout is new; it reuses the existing panel, tile and chart-colour styles.

## Deploying this phase (not done)
1. Apply the migration to Neon with the unpooled URL: `set -a; . ./.env.neon; set +a; DATABASE_URL=$DATABASE_URL_UNPOOLED npx prisma migrate deploy`.
2. Push to GitHub; Netlify builds automatically and updates the client's site.
