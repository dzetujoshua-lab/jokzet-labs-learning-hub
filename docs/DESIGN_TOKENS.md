# BASE44 DESIGN TOKENS (authoritative, extracted from the export)

Source files: `src/index.css`, `tailwind.config.js`, `index.html`, `src/components/Layout.jsx`, `src/components/ui/*`.
The earlier Phase 3 theme (graphite + electric blue, Geist) was **my own choice, not the Base44 design**. It is being replaced by the values below. The palette is **not** black/silver/blue: it is a warm-tinted near-black with an **acid-lime primary**.

## Colours (HSL, exactly as exported)
| Token | HSL | Approx hex |
|---|---|---|
| background | 48 12% 4% | #0b0b09 |
| foreground | 44 22% 95% | #f6f5f1 |
| card | 48 9% 7% | #131311 |
| card-foreground | 44 22% 95% | |
| popover | 48 10% 8% | |
| primary | 74 88% 62% | #c9f24f (lime) |
| primary-foreground | 60 25% 5% | |
| secondary | 48 7% 13% | |
| secondary-foreground | 44 18% 92% | |
| muted | 48 7% 12% | |
| muted-foreground | 44 8% 60% | |
| accent | 48 8% 16% | |
| accent-foreground | 44 18% 94% | |
| destructive | 6 78% 58% | |
| destructive-foreground | 0 0% 100% | |
| border | 46 7% 16% | |
| input | 46 7% 19% | |
| ring | 74 88% 62% | |
| sidebar-background | 48 9% 7% | |
| sidebar-foreground | 44 18% 92% | |
| sidebar-primary | 74 88% 62% | |
| sidebar-primary-foreground | 60 25% 5% | |
| sidebar-accent | 48 8% 14% | |
| sidebar-accent-foreground | 44 18% 94% | |
| sidebar-border | 46 7% 15% | |
| sidebar-ring | 74 88% 62% | |

Chart / department colours: chart-1 `74 88% 62%`, chart-2 `265 72% 68%`, chart-3 `6 80% 62%`, chart-4 `199 85% 63%`, chart-5 `172 58% 54%`, chart-6 `300 68% 68%`, chart-7 `38 92% 62%`, chart-8 `340 74% 66%`, chart-9 `215 78% 68%`.
The `.dark` class repeats the same values; the app is dark-only (`<html class="dark">`).

## Shape, type, effects
- `--radius: 1rem` (lg = 1rem, md = calc(1rem - 2px), sm = calc(1rem - 4px)). Panels `rounded-3xl`, cards `rounded-2xl`.
- Fonts: Sora (heading and display), Inter (body), JetBrains Mono (mono). Weights loaded: Sora 300–700, Inter 300–600, JetBrains Mono 300–500.
- Body background: two radial gradients, fixed: `radial-gradient(1100px 520px at 12% -8%, hsl(74 88% 62% / .07), transparent 70%)` and `radial-gradient(900px 480px at 102% -4%, hsl(265 72% 68% / .06), transparent 65%)`.
- `::selection` = `hsl(74 88% 62% / .24)`. `html`: antialiased, optimizeLegibility.
- Utilities: `.mono-label` (mono, 10px, uppercase, tracking .22em, muted-foreground), `.panel` (rounded-3xl, border, bg-card), `.animate-rise` (0.7s cubic-bezier(.22,1,.36,1), translateY 18px), `.animate-cap` (0.28s ease-out, scaleY .55). Both disabled under reduced motion.
- `theme-color` meta `#0B0B08`.

## Layout (from Layout.jsx)
- Desktop (≥1024): grid `248px | 1fr`; sidebar sticky, full height, `border-r`, `bg-sidebar/80 backdrop-blur`. Brand block (`px-5 pb-6 pt-7`): mono 10px `tracking-[0.28em]` primary "Jokzet Labs" + display 15px "Learning / Command Center". Nav `space-y-1 px-3`, links `rounded-xl px-3 py-2.5 text-[13px]`, icon `h-4 w-4` strokeWidth 1.7, active `bg-secondary text-foreground`, inactive muted with `hover:bg-secondary/60`. Footer: Level number + 1px-high XP bar + `x / 900 XP`.
- Nav order: Command, Missions, Departments, Evidence, Assessments, Portfolio, Reminders.
- Mobile (<1024): sticky top header with brand + `LV n` pill, and a horizontally scrolling pill nav (mono 10px uppercase).
- Main: `max-w-[1180px]`, `px-4 py-7 sm:px-6 lg:px-10 lg:py-10`.

## Known usability / accessibility issues (REPORTED, NOT changed; need your approval)
1. Heavy use of 9–10px mono text (labels, stats) is below comfortable reading size.
2. `text-muted-foreground` (44 8% 60%) on very small labels is borderline for WCAG AA at those sizes.
3. Mobile pill nav gives no visible scroll cue.
4. Colour is the only signal for department identity and reminder tone (overdue/today/later dots).
5. Delete buttons appear only on hover (`opacity-0 group-hover`), so touch and keyboard users do not see them until focus.
Proposed fixes are in `VISUAL_FIDELITY_REPORT.md` and will not be applied without your approval.
