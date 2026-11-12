# DAILY MISSION REMINDER AND SCHEDULE IMPORT: IMPLEMENTATION REPORT

## What was built
| Area | Implementation |
|---|---|
| Importer | Settings → "Import schedule": upload JSON → server validation (Zod) → preview of all seven weekly missions → explicit confirm. The server re-validates on confirm; the preview is never trusted. |
| Validation | schemaVersion `1.0`; required fields; exactly seven missions on seven distinct days; unique ids; HH:mm times; real IANA timezone; real calendar date; supported recurrence/trigger; 200 KB limit; JSON syntax. Errors are listed per field path. |
| Duplicate prevention | One `ScheduleConfig` per (user, package id) with a SHA-256 content hash. Identical re-import = "unchanged" (nothing written, confirm disabled). Changed content updates templates in place; history and the user's own reminder settings are preserved. Simultaneous imports still yield one schedule. |
| Daily missions | `WeeklyMissionTemplate` → `DailyMissionInstance` per local date (unique per user/template/date), 28-day rolling window, backfill up to 30 days. Programme start 16 Nov 2026, default timezone Africa/Accra. |
| Tracking | Start, Awaiting assessment, Complete (server-enforced: owner only, not for future days). Append-only `MissionCompletionRecord`. Unfinished past missions become MISSED (reviewable; late completion allowed and recorded). |
| Notifications | In-app (toast + history), browser (Notification API via service worker), Web Push. Due reminder at the template time (12:00), optional advance reminder (5–60 min), configurable reminder time and timezone. |
| Idempotency | `Notification.dedupeKey` is unique (`due:<id>`, `adv:<id>:<min>`); `NotificationDelivery` is unique per (notification, channel); the browser notification `tag` equals the key; delivery acknowledgements only change PENDING rows; push dispatch claims each delivery with a compare-and-increment. |
| Scheduler | While open: the app polls every 30 s and on tab focus. Server-side (browser closed): `runSchedulerOnce` via authenticated `POST /api/cron/dispatch`, `npm run reminders:dispatch`, or an optional in-process interval. |
| UI | Settings (import, active schedule, reminder settings, permission status, enable/test/push), Reminders (upcoming, missed, notification history with delivery status, mission history), dashboard (today's mission rows, upcoming panel). |

## Database (migration `schedule_import_and_reminders`)
`ScheduleConfig`, `WeeklyMissionTemplate`, `DailyMissionInstance`, `MissionCompletionRecord`, `ReminderSettings`, `NotificationDelivery`, `PushSubscription`; `Notification` extended (`kind`, `dedupeKey`, `scheduledFor`, `instanceId`). Indexes on user/date, user/status, startAt, channel/status; unique constraints listed above.

## Security
- Push credentials: `VAPID_PRIVATE_KEY` is read only in `src/lib/notifications/push.ts`; only the public key is returned by `/api/push/config`. No `NEXT_PUBLIC_` variables. A test enforces this statically.
- Push subscription endpoints must be https and on an allow-list of real push services (FCM, Mozilla, Windows, Apple) so the server cannot be made to POST to internal addresses (SSRF). Owner-scoped removal; per-user cap of 10; strict key-shape validation.
- State-changing cookie-authenticated routes require a matching `Origin` header (plus SameSite=Lax); every route re-checks the session.
- The cron endpoint requires `Authorization: Bearer <CRON_SECRET>` (≥24 chars, constant-time compare) and is closed if no secret is set.
- Uploaded schedule text is validated and size-capped; rendered via React (escaped); no secrets are requested or stored.

## Testing (all executed)
`npm run lint` clean · `npm run typecheck` clean · `npm test` **90 passed** (5 files, real PostgreSQL test database) · `npm run build` succeeded (21 routes).
Covered: import validation (14 invalid cases), preview, duplicate/concurrent import, update in place, weekday generation from 16 Nov 2026, rolling window, Africa/Accra and other timezones including DST, local-day boundaries, completion records, missed handling, notification creation/deduplication (including 8 racing ticks), advance reminders, disabled/stale/completed cases, permission mapping and in-app fallback, acknowledgement idempotency and ownership, push endpoint validation/SSRF cases, credential non-exposure, cron secret, CSRF origin check, push dispatch with an injected sender (success, concurrent dispatch, 410 cleanup, retry limit, unconfigured), and the server scheduler.
Browser-verified (production build): upload of your actual file → preview of 7 missions → confirm ("24 daily missions created") → re-upload shows "Already imported, no changes" with confirm disabled → test notification appears in-app and is logged "in-app · delivered" → service worker registers.

## What is NOT verified, and must not be assumed
- **Web Push with the browser closed has not been tested with a real push service or device.** The code path is tested with a stand-in sender only. It is disabled until VAPID keys exist, and it should be treated as unproven until a real device receives a push.
- **Browser (OS-level) notifications were not shown on screen**: this embedded browser has notification permission denied. The permission logic and in-app fallback are tested; the Notification API call itself is unexercised here.
- The real 12:00 firing on 16 Nov 2026 has not occurred; it is covered with a controlled clock.
- iOS/Safari push requires the app installed to the home screen (PWA) and HTTPS; not addressed.

## External configuration still required
1. `npm run push:keys` → put `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` you control) in `.env`.
2. `CRON_SECRET` (24+ random characters) in `.env`.
3. Run the scheduler every minute: Windows Task Scheduler → `npm run reminders:dispatch` (set `APP_URL` if not localhost:3000), or `ENABLE_IN_PROCESS_SCHEDULER=true` for a single server instance.
4. Serve over HTTPS (or localhost) for service workers and push.
5. On each device: Settings → Enable browser notifications → Enable background push.
6. Browser site settings must allow notifications for the site.

## Known limitations
- Reminder times are per-user, not per-mission, when the override is set (blank = each mission's own time).
- Removing a template via a re-import deletes its daily instances (history for that template is lost). Swapping two missions' weekdays in one re-import is not supported.
- Notification history shows times in UTC.
- Missed rule: a mission is MISSED at the start of the next local day.
