# UI / UX AUDIT (Base44 export)

Static review of source and tokens; not visually inspected in a running browser.

## Strengths to keep
- Clear dark, panel-based layout; consistent radius, spacing and card pattern.
- Display/body/mono type system (Sora / Inter / JetBrains Mono) gives a technical feel; mono uppercase eyebrows work well.
- Sensible IA: one task per sidebar item; "Today" focus on the dashboard.
- Per-department colour + icon identity (9 chart colours).
- Reusable small components (EmptyState, PageHeader, FormField, Modal).
- Dashboard composition (level band, today's missions, reminders rail, capstone strip) is a good starting layout.

## Problems
| Area | Issue | Fix in rebuild |
|---|---|---|
| Brand | Primary is lime (`74 88% 62%`) on warm-tinted black; brief requires near-black, charcoal, graphite, silver, white, **electric blue** | New neutral cool-graphite tokens, blue primary (~`#2F6BFF`/`#3B82F6` range), verify AA contrast |
| Fonts | Loaded from Google via CSS `@import` (render-blocking, privacy) | `next/font` self-hosting |
| Accessibility | Tiny text (`text-[9px]`, `text-[10px]`) widely used; colour-only status; no visible skip link or focus audit; modal focus handling unverified | Min 12px, status = icon + text, keyboard/ARIA pass |
| Navigation | Mobile nav handling is minimal; no breadcrumbs, search, or account menu | Responsive sidebar sheet, user menu, command palette (only if functional) |
| Missions | Flat checklist; no detail page, no instructions, no media. Cannot express WATCH→DO→EXPERIMENT→SHOW | Mission detail with four stages, progress save, submit |
| Evidence | Modal-only creation, plain list, no preview for code/PDF, no filters beyond basics | Evidence Vault with grid, filters, previews, upload constraints |
| Assessments | Manual score entry; "revise" outcome with no path back | Rubric scoring, feedback, corrections, resubmission flow |
| Analytics | Numeric tiles only; no charts | Recharts: hours, completion, department radar, score trend |
| Feedback states | Spinner only; skeletons exist but unused; errors shown inline in forms only; no route-level error boundaries | `loading.tsx`, `error.tsx`, skeletons, empty states with real CTAs |
| Data integrity | Optimistic-less mutations then `invalidateQueries`; no pending states on delete/toggle; deletes have no confirmation | Confirmation dialogs, pending states, toasts |
| Misleading UI | Capstone strip implies an integrated BusinessOS tracker; it is only a progress number. Dashboard "level" derived from client XP | Only show what is real |
| Dead code | ~50 shadcn components, Stripe, three.js, leaflet etc. | Add components on demand |
| Time | Browser-local date via moment; no timezone | Africa/Accra server-side date handling |

## Recommended design direction
Cool near-black `#0A0B0D` base, charcoal `#111317` / graphite `#1A1D23` surfaces, silver text `#A8B0BC`, white headings, electric-blue accent with a restrained glow for focus and active states. Keep department identity colours but desaturate so blue remains the brand signal. Dark theme first; light theme optional later.
