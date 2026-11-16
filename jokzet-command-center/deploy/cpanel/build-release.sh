#!/usr/bin/env bash
# Builds JOKZET Labs Academy ON the cPanel server and assembles a self-contained release folder.
# Run it in the cPanel Terminal (or over SSH). It does NOT touch the live application folder: see switch-release.sh for that.
#
#   APP_URL=https://jokzet-labs.iipghstudent.com bash build-release.sh
#
# Why on the server: the password-hashing and image libraries ship native Linux binaries. A build made on a Windows or macOS
# computer contains the wrong binaries and will not start on the server.
#
# Prints no secrets. It never reads DATABASE_URL and never runs a migration.
set -euo pipefail

APP_URL="${APP_URL:?Set APP_URL to the public https address, for example https://jokzet-labs.iipghstudent.com}"
REPO_URL="${REPO_URL:-https://github.com/dzetujoshua-lab/jokzet-labs-learning-hub.git}"
BRANCH="${BRANCH:-master}"
BUILD_DIR="${BUILD_DIR:-$HOME/build/jokzet-src}"
RELEASES_DIR="${RELEASES_DIR:-$HOME/releases}"
RELEASE="${RELEASE:-$RELEASES_DIR/jokzet-$(date +%Y%m%d-%H%M%S)}"
MEM_MB="${MEM_MB:-2048}" # raise if the build is killed for memory; lower if the account limit is smaller

case "$APP_URL" in https://*) ;; *) echo "APP_URL must start with https://"; exit 1;; esac

echo "== Runtime"
node -v
npm -v
node -e 'const [maj,min]=process.versions.node.split(".").map(Number); if (maj<20 || (maj===20 && min<9)) { console.error("Node 20.9 or newer is required (Next.js 16)."); process.exit(1); }'
echo "platform: $(node -p 'process.platform + "-" + process.arch')"
[ "$(node -p process.platform)" = "linux" ] || { echo "This script must run on the Linux server."; exit 1; }

echo "== Fetch source ($BRANCH)"
rm -rf "$BUILD_DIR"
mkdir -p "$(dirname "$BUILD_DIR")" "$RELEASES_DIR"
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$BUILD_DIR"
echo "commit: $(git -C "$BUILD_DIR" rev-parse --short HEAD)"
cd "$BUILD_DIR/jokzet-command-center"
[ -f package.json ] && [ -d prisma ] || { echo "Wrong folder: the Next.js app is jokzet-command-center/"; exit 1; }
# A clean clone has no .env. Refuse to continue if one appears, so no local secret is ever bundled.
# (.env.example is a committed template with no values, so it is allowed; any other .env* file is refused.)
if find . -maxdepth 1 -name '.env*' ! -name '.env.example' | grep -q .; then echo "Refusing to build: an .env file exists in the source folder."; exit 1; fi

echo "== Install dependencies (npm ci, exact lockfile)"
# The server's own npm settings can break a clean install (for example package-lock=false in ~/.npmrc, or NODE_ENV=production, which
# makes npm skip the build tools). Show them, then override both explicitly for this one command.
echo "package-lock.json in source: $([ -f package-lock.json ] && echo present || echo MISSING)"
echo "npm 'package-lock' setting: $(npm config get package-lock)"
echo "NODE_ENV in this shell: ${NODE_ENV:-unset}"
[ -f package-lock.json ] || { echo "package-lock.json is missing from the downloaded source."; exit 1; }
env -u NODE_ENV npm ci --include=dev --package-lock=true --no-audit --no-fund

echo "== Build (standalone output)"
NODE_OPTIONS="--max-old-space-size=$MEM_MB" NEXT_OUTPUT=standalone APP_URL="$APP_URL" npx next build

echo "== Assemble release: $RELEASE"
mkdir -p "$RELEASE"
cp -a .next/standalone/. "$RELEASE/"
cp -a public "$RELEASE/public"
mkdir -p "$RELEASE/.next"
cp -a .next/static "$RELEASE/.next/static"
# Never ship local configuration or the default upload folder. Uploads live in STORAGE_DIR, outside the application folder.
rm -rf "$RELEASE"/.env "$RELEASE"/.env.* "$RELEASE/storage"
git -C "$BUILD_DIR" rev-parse HEAD > "$RELEASE/RELEASE_COMMIT"

echo "== Verify release"
test -f "$RELEASE/server.js" || { echo "server.js is missing"; exit 1; }
test -d "$RELEASE/.next/static" || { echo "static assets are missing"; exit 1; }
if ls "$RELEASE"/.env* >/dev/null 2>&1; then echo "an .env file is present in the release"; exit 1; fi
ls "$RELEASE/node_modules/@node-rs" 2>/dev/null | grep -q "linux" || { echo "The Linux build of the password library is missing: the build did not run on Linux."; exit 1; }
du -sh "$RELEASE" | cut -f1 | sed 's/^/release size: /'
echo
echo "Release ready: $RELEASE"
echo "Next: bash switch-release.sh \"$RELEASE\""
