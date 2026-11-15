#!/usr/bin/env bash
# Sets up the reminder scheduler on cPanel: a cron job that calls the app every minute (this replaces the Netlify scheduled function).
#
#   CRON_SECRET='<the same value you set in the Node.js App environment>' APP_URL=https://jokzet-labs.iipghstudent.com bash install-cron.sh
#
# The secret is written to a private file (mode 600) read by curl, so it never appears in the crontab, in process lists or in logs.
# This script only prints the line to add. Add it yourself in cPanel > Cron Jobs, so you control what is scheduled.
set -euo pipefail

: "${CRON_SECRET:?Set CRON_SECRET (24 characters or more) in this command, not in a file you commit}"
APP_URL="${APP_URL:?Set APP_URL}"
[ "${#CRON_SECRET}" -ge 24 ] || { echo "CRON_SECRET must be at least 24 characters."; exit 1; }
case "$APP_URL" in https://*) ;; *) echo "APP_URL must start with https://"; exit 1;; esac

CFG="$HOME/.jokzet-cron.curl"
umask 077
printf 'header = "Authorization: Bearer %s"\n' "$CRON_SECRET" > "$CFG"
chmod 600 "$CFG"
echo "Wrote $CFG (mode 600)."
echo
echo "Add this line in cPanel > Cron Jobs (every minute):"
echo "* * * * * curl -fsS -m 25 -X POST --config $CFG ${APP_URL%/}/api/cron/dispatch >/dev/null 2>&1"
echo
echo "Test once now (expect JSON, not 401):"
echo "curl -sS -m 25 -X POST --config $CFG ${APP_URL%/}/api/cron/dispatch"
