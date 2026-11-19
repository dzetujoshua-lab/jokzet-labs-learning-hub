# Curriculum and resource decisions, 19 November 2026

Recorded from the Academy owner's written decisions. Implemented on branch `feature/curriculum-decisions`.

## 1. Who does what
| Role (stored as) | Responsibility |
|---|---|
| Curriculum Manager (`AUTHOR`) | Reviews learning resources, video links, curriculum frameworks and syllabus drafts. Can open the **Curriculum** page. |
| Academy Admin / Super Admin (`ADMIN`) | Final approval before anything is published. Manages staff in the **Admin Centre**. |
| Assessment Reviewer (`REVIEWER`) | Evaluates learner submissions, only in the departments assigned. Unchanged. |

No named person is built into the code. Whoever an Academy Admin assigns holds the role.

**New: Admin Centre, Staff and roles** (`/admin/staff`, Academy Admins only). Assign or remove a role by email; add or remove reviewer departments. Safeguards: the acting admin is re-checked against the database on every change; you cannot change your own role; the last Academy Admin cannot be removed; making an Academy Admin needs the address typed twice; changing someone away from reviewer clears their department scopes; every change is written to the role audit trail with the acting admin's id (`admin:<id>`).
This replaces the earlier rule that roles could only be changed by the command-line script (`scripts/roles.ts`), which still works.

**New: Curriculum page** (`/curriculum`, Academy Admins and Curriculum Managers, read-only): the lessons that still have no approved primary resource, and every resource with its review state, approver and date.

**Not built yet (decision needed):** approving a resource inside the app. Today an approval is a reviewed change to `prisma/curriculum/resources.ts` recording the reviewer, the approving date and the approval. Moving it into the Admin Centre needs a database change and a rule for how the in-app records and that file coexist, because the seed currently archives any resource not listed in the file.

## 2. Standard learning tools
- **Video editing:** DaVinci Resolve (free version). VID-L0-01 and VID-L0-02 now name it in their tools and steps.
- **Cloud:** concepts first, then AWS. CLOUD-L0-01 and CLOUD-L0-02 start with a short "why this matters on any provider" step, then practise on AWS (root MFA, a limited IAM user, an AWS Budgets alert, a small EC2 instance, a security group limited to your IP, then terminate it).
- These are course text changes. They reach learners only when the curriculum is next synced to the live database, which needs your approval.
- **Cost warning to resolve:** AWS asks for a payment card at sign-up, and the free allowance depends on the account's age. The decision says learners should not incur cloud costs. Controlled practical labs (a sandbox account provided by the Academy) would remove the risk; nothing like that exists yet.

## 3. External documentation host
`nmap.org` is approved, restricted to HTTPS pages under `/book` (the official Nmap reference guide, `/book/man.html`, and the Nmap Network Scanning book). Anything else on the host, a different port, credentials, look-alike hosts, `..` tricks and plain http are refused (tests cover each). The approval is recorded in `src/lib/resources/embed.ts`: approved 2026-11-19 by the Academy owner's written decision, recorded in this pull request. The app never fetches a resource link on the server (links are shown to learners as external links), so there is no server-side request to the host; the existing host allow-list, approval workflow and no-fetch rule are unchanged.
