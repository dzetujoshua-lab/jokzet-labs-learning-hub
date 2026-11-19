import "dotenv/config";
import pg from "pg";

/** Removes the learners the tests created (their emails all end in @e2e.test); related rows cascade. */
export default async function teardown() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "User" WHERE email LIKE '%@e2e.test'`);
  } finally {
    await client.end();
  }
}
