# BASE44 EXPORT AUDIT

Phase 1 – read-only inspection. No existing file was modified or deleted.

## 0. Discrepancies with the brief (read first)

| Brief says | Reality |
|---|---|
| A ZIP export is in a `reference` directory | **No `.zip` and no `reference/` directory exist.** The export is already unpacked at the project root (Base44 GitHub-sync layout). |
| Build from scratch | `jokzet-command-center/` already holds a bare `create-next-app` scaffold (Next 16.4.6, React 19.3, Tailwind 4.3.3, TS, ESLint). Home page is still the default template. It has `node_modules` installed. |
| Local PostgreSQL | `psql` and `docker` are **not installed / not on PATH**. Node v26.1.0 and npm 11.13 are present. |
| Not a git repo | `git` is not initialised, so there is no history or rollback safety. |

The Base44 app (root: `src/`, `base44/`, `package.json`, `vite.config.js`) is effectively the "reference". It must stay untouched.

## 1. Framework and structure

- **Vite 8 + React 18 SPA** (JavaScript/JSX, `jsconfig.json`, no TypeScript sources except `src/utils/index.ts`), `react-router-dom` v7, TanStack Query 5.
- Tailwind **3.4** with shadcn/ui (Radix) components in `src/components/ui/` (~50 files, mostly unused boilerplate).
- Backend is entirely Base44-hosted: entities defined in `base44/entities/*.jsonc`, **no `base44/functions/`**, no custom backend code.
- ~5,170 lines of app code in total (excluding config), of which roughly 1,500 are Base44 auth/MFA/OAuth screens.

## 2. package.json

Base44-specific: `@base44/sdk`, `@base44/vite-plugin` (injects HMR/analytics/visual-edit agents), `nitro` beta.

Unrelated to the product and unneeded: `@stripe/*`, `three`, `react-leaflet`, `react-quill-new`, `html2canvas`, `jspdf`, `canvas-confetti`, `moment`, `lodash`, `react-markdown`, `embla-carousel`, `input-otp` (used by MFA only).

Reusable concept-wise: Radix primitives, `lucide-react`, `recharts` (declared, see note on usage below), `zod`, `react-hook-form`, `sonner`, `date-fns`, `framer-motion`, `clsx`, `tailwind-merge`, `cva`.

## 3. Routes (React Router)

Public: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/mfa`, `*` (404). `OAuthConsent.jsx` exists but is **not routed**.
Protected (inside `Layout`): `/` Dashboard, `/missions`, `/departments`, `/departments/:id`, `/evidence`, `/assessments`, `/portfolio`, `/reminders`.

No route exists for: Analytics, Calendar, Learning paths/levels/skills, Mission detail, Assessment detail, Capstone/BusinessOS, Settings/Profile.

## 4. Base44 dependencies and purposes

| Dependency | Where | Purpose | Independent replacement |
|---|---|---|---|
| `base44.entities.*` (CRUD, 6 entities) | `useProgramme.js`, forms, pages | Data persistence | Prisma + PostgreSQL, Next server actions / route handlers, Zod |
| Row-level security `created_by_id == user.id` | each entity `rls` | Ownership | Explicit `userId` scoping in a server data-access layer |
| `base44.auth.me/register/verifyOtp/resendOtp/logout/resetPassword*/setToken/loginWithProvider/redirectToLogin` | `AuthContext`, Register, Login, Reset, MFA | Auth, email OTP, password reset, Google login | Own auth: Argon2id hashing, DB sessions, httpOnly cookies, CSRF, rate limiting |
| MFA flows (`authMfa*.js`, `Mfa*.jsx`) | auth screens | Base44-hosted MFA | Optional later TOTP; not in scope now |
| `base44.integrations.Core.UploadPrivateFile` / `CreateFileSignedUrl` | EvidenceForm, EvidenceMedia | Private file storage + signed URLs | `StorageProvider` interface, local-disk driver, authorised streaming route |
| `@base44/vite-plugin` | `vite.config.js` | Dev tooling and analytics | Removed (not applicable to Next) |
| `app-params.js` (`VITE_BASE44_*`, `base44_access_token` in localStorage) | client | Token in browser storage | httpOnly cookie sessions |
| Hosted `app settings` fetch before boot | `AuthContext` | Public settings | None needed |
| Google Fonts import + `base44.com/logo_v2.svg` favicon | `index.css`, `index.html` | Fonts, icon | `next/font`, own logo |

Security observation: the auth token is stored in `localStorage` (XSS-exposed). Not to be carried over.

## 5. Data entities (6 + User)

`Department(code,name,xp,level,next_milestone,sort_order)`, `Mission(title,department_code,date,minutes,kind,evidence_type,status,xp_reward,notes)`, `Evidence(title,department_code,mission_title,type,description,link_url,file_uri,file_name,captured_date,status)`, `Assessment(title,department_code,date,type,score,max_score,outcome,notes)`, `PortfolioPiece(title,department_code,summary,tools,status,is_capstone,stage,stages,media_url,link_url,completed_date)`, `Reminder(title,department_code,due_date,note,status)`, `User(role)`.

Weaknesses: relations by string (`department_code`, `mission_title`) with no foreign keys; no levels, skills, steps, rubrics, resources, submissions, feedback, achievements, notifications, activity log, capstone milestones, profile or timezone. XP and level are stored denormalised and mutated client-side (race-prone, forgeable by any client).

## 6. Critical finding: nothing seeds the nine departments

No code creates `Department` rows (grep for `Department.create`/seed returns nothing). `Departments.jsx` simply maps whatever exists. A fresh account would see zero departments unless data was entered in the Base44 Builder. The nine-department curriculum is therefore **not present in the export**; it has to be authored.

## 7. Design

Dark theme (`--background 48 12% 4%`), warm-tinted near-black, **lime/chartreuse primary (`74 88% 62%`)**, Sora / Inter / JetBrains Mono, 1rem radius, `panel`/`mono-label`/`animate-rise` utilities, 9 chart colours, department icon map (Code2, PenTool, ShieldAlert, Cloud, Server, BrainCircuit, Camera, Clapperboard, Briefcase). Lime does not match the required brand (electric blue / silver); tokens must be redefined.

## 8. Missing or broken in the export

- `index.html` references `/manifest.json`; there is no `public/` directory.
- `PortfolioPiece.media_url` is a bare string field with no upload path.
- `Departments` page text claims "300 XP per level"; the dashboard uses 900 XP per programme level: hard-coded, not configurable.
- No tests of any kind. `package.json` has lint/typecheck/build only.
- `recharts` is declared and a `chart.jsx` wrapper exists, but no page was verified to render an actual chart (progress is bars and tiles). Treat analytics as not implemented.
- The Base44 project has not been run; claims here are from static reading only. Runtime behaviour is unverified.
