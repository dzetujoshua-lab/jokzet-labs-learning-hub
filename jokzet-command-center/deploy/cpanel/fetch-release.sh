#!/usr/bin/env bash
# Downloads a release built by the "Build cPanel release" GitHub workflow into ~/releases/<tag>/ and checks it. It does not change the
# live application: use switch-release.sh for that. Prints no secrets.
#
#   bash fetch-release.sh                 (newest cpanel-* release)
#   bash fetch-release.sh cpanel-20261116-abc1234-run3
#
# The release is built on GitHub (Ubuntu) because this server's C library is too old for Next.js's build tools. It only RUNS here.
set -euo pipefail

REPO="${REPO:-dzetujoshua-lab/jokzet-labs-learning-hub}"
RELEASES_DIR="${RELEASES_DIR:-$HOME/releases}"
TAG="${1:-}"

echo "== Server"
node -v
echo "platform: $(node -p 'process.platform + "-" + process.arch')"
ldd --version 2>&1 | head -1 || true

if [ -z "$TAG" ]; then
  echo "== Find newest release"
  TAG="$(curl -fsS "https://api.github.com/repos/$REPO/releases?per_page=30" | grep -o '"tag_name": *"cpanel-[^"]*"' | head -1 | sed 's/.*"\(cpanel-[^"]*\)"/\1/')"
  [ -n "$TAG" ] || { echo "No cpanel-* release found yet. Run the GitHub workflow 'Build cPanel release' first."; exit 1; }
fi
echo "release: $TAG"

DEST="$RELEASES_DIR/$TAG"
BASE="https://github.com/$REPO/releases/download/$TAG"
TMP="$(mktemp -d "$HOME/.fetch-release.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

echo "== Download"
curl -fL --retry 3 -o "$TMP/jokzet-release.tar.gz" "$BASE/jokzet-release.tar.gz"
curl -fL --retry 3 -o "$TMP/jokzet-release.tar.gz.sha256" "$BASE/jokzet-release.tar.gz.sha256"
(cd "$TMP" && sha256sum -c jokzet-release.tar.gz.sha256)

echo "== Unpack to $DEST"
[ ! -e "$DEST" ] || { echo "$DEST already exists; remove it or choose another tag."; exit 1; }
mkdir -p "$DEST"
tar -xzf "$TMP/jokzet-release.tar.gz" -C "$DEST"

echo "== Verify"
test -f "$DEST/server.js" || { echo "server.js is missing"; exit 1; }
test -d "$DEST/.next/static" || { echo "static assets are missing"; exit 1; }
if ls "$DEST"/.env* >/dev/null 2>&1; then echo "an .env file is in the release"; exit 1; fi
ls "$DEST/node_modules/@node-rs" | grep -q linux || { echo "Linux native files are missing"; exit 1; }
echo "commit: $(cut -c1-7 "$DEST/RELEASE_COMMIT")"
# Load the password-hashing library under THIS server's Node and C library: proves the native file actually works here.
( cd "$DEST" && node -e 'const a=require("@node-rs/argon2"); a.hash("probe").then(h=>{if(!h.startsWith("$argon2"))process.exit(2);console.log("argon2 native library loads and works here")}).catch(e=>{console.error("argon2 failed:",e.message);process.exit(1)})' )
du -sh "$DEST" | cut -f1 | sed 's/^/release size: /'
echo
echo "Release ready: $DEST"
echo "Next: APP_ROOT=\$HOME/jokzet-command-center bash ~/switch-release.sh \"$DEST\""
