#!/usr/bin/env bash
# Puts a built release live in the CloudLinux application root and restarts the app. Also used to ROLL BACK: pass an older release folder.
#
#   APP_ROOT=$HOME/jokzet-command-center bash switch-release.sh "$HOME/releases/jokzet-20261115-120000"
#
# The application root must be the folder registered in cPanel "Setup Node.js App". It must be OUTSIDE the Git clone and outside
# CloudLinux's virtual environment (nodevenv). Environment variables are set in the cPanel Setup Node.js App page, never in files here.
# Prints no secrets.
set -euo pipefail

RELEASE="${1:?Usage: switch-release.sh <release folder>}"
APP_ROOT="${APP_ROOT:?Set APP_ROOT to the application root registered in cPanel (for example \$HOME/jokzet-command-center)}"

[ -f "$RELEASE/server.js" ] && [ -d "$RELEASE/.next/static" ] || { echo "Not a valid release folder: $RELEASE"; exit 1; }
case "$APP_ROOT" in *nodevenv*|*/jokzet-labs-learning-hub/*) echo "APP_ROOT must not be inside nodevenv or the Git clone."; exit 1;; esac
[ "$APP_ROOT" != "$HOME" ] && [ "$APP_ROOT" != "/" ] || { echo "Refusing: unsafe APP_ROOT"; exit 1; }
mkdir -p "$APP_ROOT"

echo "Switching $APP_ROOT to $(basename "$RELEASE") (commit $(cut -c1-7 "$RELEASE/RELEASE_COMMIT" 2>/dev/null || echo unknown))"
# Keep what cPanel and Passenger own (tmp, logs, .htaccess); replace everything else with the release.
rsync -a --delete \
  --exclude 'tmp' --exclude 'tmp/**' --exclude '.htaccess' --exclude 'stderr.log' --exclude 'public_html' \
  "$RELEASE"/ "$APP_ROOT"/

mkdir -p "$APP_ROOT/tmp"
touch "$APP_ROOT/tmp/restart.txt" # Passenger restarts the app when this file changes
echo "Restart requested. Check: curl -s https://YOUR-DOMAIN/api/health"
