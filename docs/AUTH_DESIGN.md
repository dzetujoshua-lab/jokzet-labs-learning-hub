# AUTH DESIGN (Phase 5)

Independent of Base44, Supabase and Auth.js. Code: `jokzet-command-center/src/lib/auth/`.

## Mechanism
- **Passwords:** Argon2id (`@node-rs/argon2`, m=19456 KiB, t=2, p=1). Only the hash is stored.
- **Sessions:** 256-bit random token in an `HttpOnly`, `SameSite=Lax` cookie (`__Host-` prefix and `Secure` in production). Only the SHA-256 of the token is stored in `Session`. 14-day lifetime, renewed when under 7 days remain. Sign-out deletes the row. Deactivating a user invalidates sessions immediately because every request re-checks the database (nothing is cached).
- **No tokens in localStorage / client JS.** Verified: `document.cookie` is empty after sign-in.
- **Validation:** Zod on every form (email normalised, password 12–128 chars, letter + number).
- **Enumeration resistance:** same message for unknown email and wrong password; unknown emails still pay a hash check; registration conflicts return a generic message.
- **Lockout:** 5 consecutive failures lock the account for 15 minutes (`User.failedLogins/lockedUntil`).
- **CSRF:** sign-in, register and sign-out are Server Actions (Next checks Origin/Host) plus `SameSite=Lax`.
- **Open redirect:** none; post-login redirect is fixed to `/`.
- **Registration:** `ALLOW_REGISTRATION=false` closes it (default open). Registration creates the profile and nine Level 0 `LearnerDepartment` rows in one transaction.

## Authorization rules for later phases
1. `proxy.ts` is only an optimistic cookie-presence redirect. It is not security.
2. Every page, server action and route handler that touches user data calls `requireUser()` (`lib/auth/dal.ts`) and filters queries by `user.id`.
3. Never put user data in static (prerendered) content. Under Cache Components, static children of the `(app)` layout are part of the prerendered shell even when the session is invalid (observed: a bogus cookie receives the static placeholder text; no database data). User data must be fetched inside functions that call `requireUser()` behind `<Suspense>`.
4. Never accept `userId` from the client.

## Known limitations / to decide
- No password reset, email verification, MFA or social login (needs an email provider decision; out of scope until you decide).
- Lockout is per account; there is no per-IP rate limiter yet (planned in Phase 10 hardening). Account lockout can be used to annoy a known email for 15 minutes.
- `x-forwarded-for` is stored for audit only and is spoofable unless a trusted proxy sets it.
- Security headers (CSP, frame-ancestors, etc.) are planned for Phase 10.

## Tests
`tests/auth.test.ts` (13 tests, real PostgreSQL test database): validation, Argon2id, registration (profile + 9 Level 0 rows, duplicate email), uniform failure, lockout and expiry, disabled users, hashed session tokens, expired/malformed/logged-out/deactivated sessions. Manually verified in the browser: weak-password validation, registration, HttpOnly cookie, sign-out, protected-route redirect, wrong password, successful sign-in.
