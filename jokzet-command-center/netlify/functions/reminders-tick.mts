/**
 * Scheduled function: runs every minute on the published (production) deploy and asks the app to run one reminder
 * scheduler pass (create due notifications, deliver Web Push). The app endpoint is protected by CRON_SECRET, so this
 * function is the only caller that can trigger it. It does nothing until CRON_SECRET is configured.
 */
export default async function handler(): Promise<Response> {
  const base = process.env.URL; // the site's primary URL, provided by Netlify
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response("not configured", { status: 200 });

  const response = await fetch(`${base}/api/cron/dispatch`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  return new Response(`dispatch ${response.status}`, { status: 200 });
}

export const config = { schedule: "* * * * *" };
