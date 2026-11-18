# Product Decisions and Open Questions

Date: 2026-11-18. Nothing here is an approval unless it says "Confirmed". A recommendation is not a decision.

## 1. Confirmed by the owner (written instructions)
| # | Decision | Source |
|---|---|---|
| C1 | Hosting stays on cPanel and the existing Neon database stays the production database. | Execution-plan brief, section 0 |
| C2 | Onboarding enrols the learner in **one initial course**; the learner reviews and confirms the generated plan before onboarding completes. | Brief, section 2.1 |
| C3 | Learners can **add another course later** by an explicit action; the dashboard shows only enrolled courses; adding a course never rewrites another. | Brief, sections 2.2 to 2.4 |
| C4 | Course lifecycle: available, enrolled/active, paused, completed, withdrawn, history retained. | Brief, section 2.5 |
| C5 | Syllabus and WATCH resources come only from approved, versioned, reviewed curriculum; nothing invented; unapproved courses are not offered. | Brief, section 3 |
| C6 | Supervised-beta credit policy: self-assessment is formative and labelled; **official XP, skills and mastery need a reviewer's confirmation**; custom missions and personal activities earn no official XP; baselines award nothing. | Brief, section 4 |
| C7 | Pilot programmes: Full-Stack Web Development (`fswd`) and Business and Entrepreneurship (`biz`), Levels 0 and 1, unless the owner changes it. | Brief, section 5 workstream C |
| C8 | AI assessment, repository and site inspection and code execution are future scope, not beta blockers. | Brief, workstream G |
| C9 | The owner (not Claude) performs credential rotation, password changes and console actions; secrets are never pasted into chat. | Brief, sections 0 and 5 |
| C10 | "Start implementing the P0 phases" (message of 2026-11-18): implementation of the P0 items that need no owner access has begun, on a branch, without deployment. | Owner message |

## 2. Inferred from the owner's instructions (please confirm)
| # | Inference | Where it is used |
|---|---|---|
| I1 | "Course" in the interface means what the code calls a `Department` today (nine of them), until the owner says otherwise. | Architecture doc, section 2 |
| I2 | The first course's duration, availability and start date come from onboarding; a later course reuses availability but may have its own duration and start date. | Architecture doc, section 3 |
| I3 | Credit is held until a reviewer confirms, but the learner's plan can still progress on a self-assessed pass (the mission shows as passed, with no XP). | Implemented in this branch; see open question Q5 |
| I4 | The earlier "choose up to five programmes" onboarding is replaced, not kept as an option. | Implemented in this branch |
| I5 | Existing learners are not moved or re-onboarded; their past XP is left as it is (no recalculation). | See Q6 |

## 3. Unresolved owner decisions
| # | Question | Needed by | Recommendation (not a decision) |
|---|---|---|---|
| Q1 | **Multi-course data model:** Option A (one schedule plus a `CourseEnrolment` table), B (independent plan per course) or C (beta without add-course). | Before any enrolment build | A |
| Q2 | Approve the new learner screens (Explore Courses, Add a Course, course pages, home by course) and their design. | Before building them | Review designs first; keep the existing visual identity |
| Q3 | Is "add a course later" inside the supervised beta? It adds about 23 to 35 engineering days. | Beta planning | Decide explicitly; if not, say so to testers |
| Q4 | Graphic Design department, and whether Cloud and Systems Administration are one course or two. | Catalogue and pilot scope | Only if they enter the pilot |
| Q5 | Official-credit timing: should a self-assessed pass already let the learner progress through the plan (current behaviour), or should the next missions wait for the reviewer? | Reviewer capacity planning | Keep progress moving, label it clearly, and size reviewer capacity |
| Q6 | Existing XP: leave as is, or recompute from reviewer-confirmed work? (Production has 4 legacy profiles; custom-mission XP may exist.) | Before beta | Report first, decide later; no automatic recalculation |
| Q7 | **SEC-03 beta recovery fallback:** who runs it, how identity is verified, how it is logged, when it expires. Suggested: the owner only, via the set-password tool, after confirming the person through a channel already known to the owner, each use written in an operations log without the password, expiring when self-service reset ships. | Before beta | Approve in writing, or build reset first |
| Q8 | Email provider and its cost; DNS access for SPF and DKIM. | Account recovery build | Owner to obtain quotes |
| Q9 | External encrypted backup destination for evidence files, and the cost. | Before beta | Owner chooses |
| Q10 | Whether the owner set-password script (uncommitted) is merged. | Before beta recovery | Merge as its own reviewed change |
| Q11 | What happens to the uncommitted Neon Auth experiment: remove, or review as a separate change. It must never ride along in another commit. | Any time | Decide; until then it stays untouched |
| Q12 | Pilot curriculum: who are the subject reviewers, what are the 71 drafts' approval rules, and what are the approved video resources. | Start now (longest lead time) | Begin reviewer assignment |
| Q13 | Production actions needing approval: rotate the Neon credential, create the application role, run any production migration, publish curriculum, deploy this branch, change DNS. | Each when needed | Approve per action, in writing |
| Q14 | Paid third-party services (email, monitoring, backup storage, malware scanning, penetration test). | When chosen | Owner approves each |
| Q15 | Success criteria and rollback conditions for the supervised beta (suggested values are in `REMAINING_DEVELOPMENT_PHASES.md`, S8-01). | Before beta | Confirm or change |

## 4. What this change set implements (and does not)
Implemented on branch `feature/p0-integrity-and-access` (not merged, not deployed, no migration, no production change):
- Official XP and skills only after a reviewer confirms (SEC-04 partly, brief section 4); self-assessment no longer awards XP, skills or verified evidence.
- Custom board tasks earn no XP; board checkbox awards no XP; creation of custom tasks is rate limited and capped at 200 (SEC-05).
- Onboarding enrols exactly one course, enforced on the server and in the wizard.
- Settings and Privacy reachable during onboarding (SEC-13).
- `X-Powered-By` header removed.
Not implemented: add-a-course, course enrolments, catalogue, the personalised home, pilot curriculum and resources, password reset, backups, cron, monitoring, CSP enforcement, browser tests, and every owner-only action.
