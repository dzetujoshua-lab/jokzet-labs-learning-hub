# Deploying JOKZET Labs Academy to cPanel (CloudLinux "Setup Node.js App")

Target: `https://jokzet-labs.iipghstudent.com`, existing Neon database, Netlify kept as the rollback until cPanel is verified.

Status (verified 2026-11-16): the app runs on this server from a release built on GitHub, health check `{"status":"ok","database":"up"}`, pages and static files served over valid HTTPS, private pages redirect to sign-in.

## How a release reaches the server

The server's C library (glibc 2.28) is too old for Next.js 16's native build tools (`GLIBC_2.29 not found`), so **the app is built on GitHub and only run here**:

1. GitHub: *Actions, Build cPanel release, Run workflow* (or `gh workflow run cpanel-release.yml`). It builds on Ubuntu, refuses to publish if any native file needs a newer glibc than the server's, and publishes a release with no secrets in it.
2. Server: `bash ~/fetch-release.sh` downloads the newest release, checks its checksum and proves the native password library loads on this server.
3. Server: `APP_ROOT=$HOME/jokzet-command-center bash ~/switch-release.sh "<release folder>"` makes it live and restarts it.

`build-release.sh` (building on the server) only works on a server with glibc 2.29 or newer; it is kept for that case.

Also learned the hard way: the activated CloudLinux environment's `npm` wrapper adds `--prefix <nodevenv lib>` to every command, which makes `npm ci` fail with a misleading "no package-lock.json" error. `build-release.sh` bypasses the wrapper. GitHub's API returns 403 to shared-hosting addresses, so `fetch-release.sh` uses plain download links.

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
4. **Fetch the release.** In the Terminal (Node environment active, prompt shows `(jokzet-command-center (24))`):
   ```bash
   mkdir -p ~/jokzet-data/evidence ~/releases ~/build
   cd ~/build && git clone --depth 1 https://github.com/dzetujoshua-lab/jokzet-labs-learning-hub.git jokzet-src   # first time only
   cd ~/build/jokzet-src && git fetch --depth 1 origin master && git reset --hard origin/master && cp jokzet-command-center/deploy/cpanel/*.sh ~/
   bash ~/fetch-release.sh
   ```
5. **Go live.** `APP_ROOT=$HOME/jokzet-command-center bash ~/switch-release.sh "$(ls -d ~/releases/cpanel-* | tail -1)"`.
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
