# Deploying JOKZET Labs Academy to cPanel (CloudLinux "Setup Node.js App")

Target: `https://jokzet-labs.iipghstudent.com`, existing Neon database, Netlify kept as the rollback until cPanel is verified.

What is **verified** (on a Windows build machine, 2026-11-15): the app builds in standalone mode and the generated `server.js` starts, answers `/api/health` against the database, serves pages and static files and sends the security headers.
What is **not yet verified**: anything on the real server (Node 24 there, Passenger startup, memory limits, outbound access to Neon, LiteSpeed headers). Those are checked in the steps below.

## Why the layout matters (the error you hit)

CloudLinux tried to move `nodevenv/jokzet-labs-learning-hub/` into the new application root `.../jokzet-command-center/` nested inside it, which is impossible. The fix is a **new, separate application name and root**, never a root inside the Git clone:

```text
$HOME/
├── jokzet-labs-learning-hub/        Git clone (leave alone)
├── jokzet-command-center/           APPLICATION ROOT registered in Setup Node.js App (release files go here)
├── releases/jokzet-YYYYMMDD-HHMMSS/ built releases (kept for rollback)
├── build/jokzet-src/                temporary build checkout
├── jokzet-data/evidence/            uploaded files (STORAGE_DIR, backed up, never inside the app folder)
└── nodevenv/jokzet-command-center/  created and managed by CloudLinux. Never edit or delete it by hand.
```

## Steps

1. **Clear the failed registration (cPanel UI only).** In *Setup Node.js App*, find the failed `jokzet-labs-learning-hub` entry. Use its **Destroy** action. Do not delete `nodevenv` folders yourself. If Destroy is refused, send the exact message to your host.
2. **Create the new application.** *Create Application*: Node.js version 24.22.3 if listed (otherwise the newest 22 or 24 offered; Next.js 16 needs 20.9 or newer); Mode Production; **Application root `jokzet-command-center`** (a new folder); **Application URL** `jokzet-labs.iipghstudent.com`; **Startup file `server.js`** (a file name, not a folder). Name it `jokzet-command-center`. Do not press "Run NPM Install" (the release contains its own `node_modules`).
3. **Environment variables.** In the same page add the variables from `env.production.example`. Paste `DATABASE_URL` only into that page.
4. **Build on the server.** In cPanel Terminal, activate the app's environment (cPanel shows the exact `source .../activate` line at the top of the page), then:
   ```bash
   mkdir -p ~/jokzet-data/evidence
   cd ~ && git clone --depth 1 https://github.com/dzetujoshua-lab/jokzet-labs-learning-hub.git tmp-fetch && cp tmp-fetch/jokzet-command-center/deploy/cpanel/*.sh ~/ && rm -rf tmp-fetch
   APP_URL=https://jokzet-labs.iipghstudent.com bash ~/build-release.sh
   ```
   If the build is killed, the account is out of memory: retry with `MEM_MB=3072`, or ask the host to raise the limit.
5. **Go live.** `APP_ROOT=$HOME/jokzet-command-center bash ~/switch-release.sh "$HOME/releases/<the folder it printed>"`.
6. **Check.** `curl -s https://jokzet-labs.iipghstudent.com/api/health` should return 200. Then open the site, register a **test** account, sign in and out. Check the *Setup Node.js App* log if anything fails.
7. **Rate limiting.** Behind LiteSpeed the app needs to know how many proxies you control. On the server run a request with a made-up header and see what the app receives, for example send `X-Forwarded-For: 9.9.9.9` to a test route and compare. Then set `TRUSTED_PROXY_HOPS` (normally `1`). Until it is set, a client can pretend to be many addresses and avoid sign-in throttling. Treat this as required before opening sign-up.
8. **Reminders.** `CRON_SECRET='…' APP_URL=… bash ~/install-cron.sh`, then add the printed line in cPanel *Cron Jobs*.
9. **Database.** No migration is pending (production reports its schema up to date). Never run `prisma db push` or `migrate reset`. If a future release adds a migration, review its SQL and take a Neon restore point first.

## Rollback

`APP_ROOT=$HOME/jokzet-command-center bash ~/switch-release.sh "$HOME/releases/<previous folder>"` restores the previous release in seconds. The Netlify site is untouched and remains the fallback.

## Known limits on cPanel

- **Background work.** Reminders depend on the cron job above. Passenger may stop an idle app, so do not rely on the in-process scheduler.
- **Uploads.** Files live on disk in `STORAGE_DIR`. The limit on request size set by LiteSpeed or Passenger may be lower than the app's 50 MB upload cap; test a large upload.
- **Untrusted code.** The application never runs learner code, and the future Assessment Engine must not run it on this server either.
