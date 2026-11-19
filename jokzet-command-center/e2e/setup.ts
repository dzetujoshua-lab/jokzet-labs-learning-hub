import { localClient } from "./db";

/** Registration is limited to 20 an hour per address, so repeated local runs would be refused: clear the sign-up counters first. */
export default async function setup() {
  const client = await localClient();
  try {
    await client.query(`DELETE FROM "RateLimitBucket" WHERE key LIKE 'register:%' OR key LIKE 'login:%'`);
    await client.query(`DELETE FROM "User" WHERE email LIKE '%@e2e.test'`); // anything a crashed earlier run left behind
  } finally {
    await client.end();
  }
}
