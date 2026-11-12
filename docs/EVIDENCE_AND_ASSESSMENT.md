# PHASE 7: EVIDENCE VAULT, FILE STORAGE AND ASSESSMENTS

## What was built
| Area | Implementation |
|---|---|
| Storage abstraction | `StorageProvider` interface (`put/get/delete`, range reads). `LocalDiskStorage` writes to `storage/` (configurable `STORAGE_DIR`), **outside `public/`**, sharded by key prefix. Keys are server-generated 32-hex strings; anything else is rejected (no path traversal); objects are never overwritten. Swapping in S3/R2/Azure only means a new class. |
| Upload validation | Real type from file **bytes** (PNG, JPEG, GIF, WebP, PDF, MP4/MOV, WebM) must match the extension. Text/code files must be clean UTF-8 (no NUL). Size limits: image 10 MB, PDF 20 MB, video 50 MB, code/text 1 MB; 500 MB per-user quota. Rejected: SVG, HTML-as-image, executables, archives, `.env`, key files (`.pem`, `.key`, `id_rsa`…), no extension. File names are sanitised (path parts, control characters, length). |
| Secret guard | Rule from the schedule file: never store passwords, keys, tokens. Text/code uploads, notes, titles, explanations, feedback and links are scanned for private keys, AWS/GitHub/Slack/Google/API keys, `password=`-style assignments, credentials in connection strings, and `?token=`-style URL parameters. Best-effort: it cannot catch everything. |
| File route | `GET /api/evidence/:id/file`: session required, **owner only** (someone else's id returns the same 404 as a missing one). Images and video render inline; PDF and code are downloads. Headers: server-determined `Content-Type`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cross-Origin-Resource-Policy: same-origin`, `Cache-Control: private, no-store`. HTTP range requests for video. |
| Upload route | `POST /api/evidence`: same-origin check, session, early size rejection. Stored file and database row are created together; the stored file is removed if the database write fails. |
| Evidence Vault | Base44 page structure: header + "Log evidence" modal, 16:10 card grid, empty state. Supports files, links and written explanations (a file, a link, or ≥30 characters of explanation is required). Evidence type must match the file (screenshot/photo→image, video→video, code→code file, document→PDF or text). Verified / "in a mission" badges. Evidence in a sent submission cannot be deleted. |
| Missions | Evidence attaches to the mission's **draft attempt** (from the vault or uploaded in place). Submitting requires the explanation and at least one piece of evidence or a repository/live link. After a revision the next draft is attempt n+1. |
| Assessment Centre | Base44 layout (four tiles, score-bar rows with outcome chips). Rubric scoring screen with live total and result preview; outcomes: PASS ≥ the mission's passing score (70), REVISE 40–69, FAIL < 40. Only a SUBMITTED attempt with real evidence can be assessed, exactly once, every criterion scored within its points. |
| Effects of an assessment | One transaction: scores, feedback, status changes, history. **PASS**: mission becomes PASSED, department XP awarded **once** (never doubled if the mission was already ticked done), evidence marked VERIFIED, mission skills recorded, activity logged. **Not pass**: a correction per weak criterion (< 70% of its points), the mission's remediation text, status NEEDS_REVISION. |
| Corrections / weaknesses | Corrections are a checklist the learner ticks off. Weak areas (criteria repeatedly below target, per department) are aggregated on the Assessments page. |
| Resubmission | Allowed after a revision; needs new evidence or a link; attempt number increases; every attempt and assessment is kept. |

## Database
Migration `evidence_vault`: new `EvidenceItem` (department, optional mission and submission, kind, status LOGGED/VERIFIED, optional file); `SubmissionFile` is now a plain stored-file record (`submissionId` removed; attachment goes through `EvidenceItem`). Existing `Assessment`, `AssessmentScore`, `Feedback`, `Submission`, `UserSkill` tables are used as designed.

## Testing (executed)
Lint clean · typecheck clean · **134 tests pass** (7 files, real PostgreSQL test DB; 47 new in this phase): upload accept/reject matrix (spoofed types, SVG, executables, binary-as-text, `.env`, keys, size limits, name sanitising), secret detection, storage traversal/overwrite protection, evidence create/list/delete with orphan-file handling, owner isolation, draft/attach/detach/submit rules, assessment validation (incomplete, duplicate, out-of-range, foreign criteria, secrets, wrong owner, wrong state), pass/revise/fail thresholds, XP awarded once, un-do blocked after a pass, corrections, weakness aggregation, resubmission.
Browser-verified on the production build with a throwaway account: uploaded a real PNG through the modal ("Evidence saved"); image streams inline with the security headers above and a `?download=1` attachment variant; file sits in `storage/` (not `public/`); the file URL without a session redirects to sign-in; an HTML file renamed `.png` was refused with "The file contents are not a valid .png file" and nothing saved; started a mission, attached the vault item, submitted (attempt 1), scored 45% (live preview "Needs revision" → result REVISE with four corrections and remediation), ticked a correction, an empty resubmission was refused, resubmitted with a repository link (attempt 2), scored 94% → PASS, sidebar XP 40/900 (awarded once), Assessments page shows both attempts and weak areas. Test account and file were deleted afterwards.

## Limits and decisions to review
- **Self-assessment.** This is a single-learner tool, so the learner scores their own work against the rubric. That is an honour system: nothing prevents scoring generously. (An admin-assessor role exists in the schema, but there is no UI for it.)
- Video is buffered in memory during upload (50 MB cap). Larger files or cloud storage would need streaming uploads.
- Secret scanning is heuristic and text-only; it cannot inspect images, PDFs or video contents.
- Uploaded files are stored unencrypted on local disk; back up `storage/` together with the database.
- The mission-board checkbox still awards XP without evidence (Base44 behaviour kept). A pass through assessment is the evidence-backed path.
- The Evidence page's department filter and search from the brief's wider vision were not added (the Base44 page has none).

## Visual fidelity (Evidence and Assessments)
Measured against the running original at 1280×800 with the same script as earlier pages. Evidence: heading, button, card media (305×191), body, title, chip all identical. Assessments: heading, tiles, panel and rows identical, including the reserved space for the original's hover delete button (kept as a blank spacer; there is no delete button because assessments are permanent records).
Additions not in Base44 (for approval): "Awaiting assessment" panel, "Weak areas" panel, "Assess a submission" header button (in the place of "Log assessment"), assessment detail/scoring screen, evidence section and result panel on the mission page.

## External configuration
None required. Optionally set `STORAGE_DIR` to a backed-up location.
