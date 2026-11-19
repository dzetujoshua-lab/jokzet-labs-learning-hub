import "dotenv/config";
import pg from "pg";

/**
 * A database client for test set-up and clean-up. It refuses to connect to anything that is not on this computer, so a browser
 * test run can never delete users or counters from a real database by mistake.
 */
export async function localClient(): Promise<pg.Client> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const host = new URL(url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]") throw new Error(`Refusing to run browser tests against ${host}: only a local database is allowed.`);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}
