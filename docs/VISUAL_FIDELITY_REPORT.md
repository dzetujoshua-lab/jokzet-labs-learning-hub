# VISUAL FIDELITY REPORT

Goal: the rebuilt Next.js app must look like the Base44 original. Tokens are documented in `DESIGN_TOKENS.md`.

## Method
The original cannot run on its own (its backend is Base44-hosted), so a **copy** of its source was run in a scratch folder (outside the project) with only the data layer stubbed, loaded with the same data as the rebuild. Both were measured at **1280×800** with identical scripts (computed styles and bounding boxes of the same elements). The export itself was never modified. Rebuild measurements come from the **production build** (`next start`).

Limitation: this is measurement, not pixel-diff screenshots (the in-app browser could not reliably screenshot two tabs at once). Mobile layout was not compared.

## Results (position x,y and size w,h in px; all identical to the original)

| Page | Elements compared | Result |
|---|---|---|
| Command | sidebar, nav links, h1, eyebrow, level panel, "mission" button, department card + title; body gradient, colours, fonts, weights, letter-spacing, radii, border colours | **Identical** |
| Mission board | h1, New mission button, scope pills, department select, panel (288,243,937,1313), rows (73px), checkbox, counter | **Identical** (after fix 1) |
| Departments | h1, 4 stat tiles, card grid, first and ninth card, page height 979 | **Identical** |
| Department detail | back link, header (288,88,952,207), milestone input, Save button, two-column grid, mission panel and row | **Identical** (after fixes 2 and 3) |
| Evidence (Phase 7) | h1, "Log evidence" button, card grid, media (305×191), body, title, type chip | **Identical** (card height differs only when the neighbouring card in the row has a longer description, same as the original) |
| Assessments (Phase 7) | h1, four tiles, panel (288,285,952,147), both rows (73/72px), score bar and outcome chip | **Identical** after fix 4 |

4. **Assessment rows: bar and chip 30px too far right.** The original reserves space for a hover-only delete button. Assessments are permanent records here, so no button exists, but a blank spacer keeps the layout identical.

## Differences found and fixed
1. **Mission rows 78px instead of 73px.** Curriculum mission titles are links; an inline `<a>` inherits the 24px body line-height. Fixed with `block`.
2. **Department header 9px too tall.** The "Next milestone" label was an inline `<label>` instead of Base44's block `<p>`. Fixed with `block`.
3. **Department header 5px too high.** Tailwind 4's `space-y-*` treats an inline-flex child differently from Tailwind 3 (margin on the child versus the next sibling). Fixed by wrapping the back link in a block `div`.

Remaining sub-pixel-invisible differences: `rounded-full` is computed as a very large radius in Tailwind 4 instead of 9999px (renders identically); fonts are self-hosted by `next/font` (same families and weights, metric-matched fallbacks).

## Additions that are NOT in the Base44 design (need your approval)
| Addition | Why | Where |
|---|---|---|
| **Sign out** link | Our own authentication needs one | Sidebar footer, mono-label style |
| **JKM logo** | You supplied it | Brand block (sidebar, mobile header, login) and browser icon |
| **Settings** nav item (8th, last) | You asked for a Settings area for the schedule import | Sidebar and mobile pills |
| **Mission detail page** (`/missions/[code]`) | WATCH → DO → EXPERIMENT → SHOW workflow | Built from existing panel/mono-label styles |
| **Daily mission rows** in "Today's line-up" | Imported weekly schedule | Same row markup as the Base44 mission row, plus status pills |
| **Upcoming missions** panel | You asked for upcoming missions on the dashboard | Right column under Reminders; same markup as the Reminders rail |
| Reminders page (real content) | Notification history, missed missions | Base44 panel styles |
| Login/register screens | Base44's were platform-hosted | Base44 tokens, panel and Input styles |

If you want any of these changed or removed, say so; none alter the original arrangement of existing elements.

## Usability and accessibility concerns in the ORIGINAL (reported, not changed)
1. Heavy use of 9–10px mono text (labels, stats, pills).
2. `muted-foreground` (44 8% 60%) on very small labels is borderline for WCAG AA.
3. Colour is the only signal for department identity and reminder tone (overdue/today/later dots).
4. Delete buttons appear only on hover (`opacity-0 group-hover`); the rebuild also shows them on keyboard focus, which does not change the resting look.
5. The mobile pill navigation has no visible scroll cue (now 8 items).

Proposed fixes (not applied): raise label minimum size to 11–12px, lighten muted text slightly, add text/icon alongside colour-only cues, add a scroll fade on the pill nav.
