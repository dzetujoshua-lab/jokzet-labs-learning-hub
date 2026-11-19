import { localClient } from "./db";

/** Removes the learners the tests created (their emails all end in @e2e.test); related rows cascade. */
export default async function teardown() {
  const client = await localClient();
  try {
    await client.query(`DELETE FROM "User" WHERE email LIKE '%@e2e.test'`);
  } finally {
    await client.end();
  }
}
