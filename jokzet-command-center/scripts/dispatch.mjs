// Triggers one reminder-scheduler pass on a running server. Schedule this every minute with Windows Task Scheduler
// or cron:   node scripts/dispatch.mjs
// Needs APP_URL (default http://localhost:3000) and CRON_SECRET (the same value the server uses).
import "dotenv/config";

const url = `${process.env.APP_URL ?? "http://localhost:3000"}/api/cron/dispatch`;
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET is not set.");
  process.exit(1);
}

const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
console.log(response.status, await response.text());
process.exit(response.ok ? 0 : 1);
