import "dotenv/config";

// Tests must never touch the development database.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is not set");
if (testUrl === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL");
process.env.DATABASE_URL = testUrl;

// Most existing tests exercise the original fixed programme. Personalised onboarding is the production default, so the
// legacy behaviour is selected explicitly here; the personalised tests set the flag themselves (onboarding-flow.test.ts
// removes it to prove the default).
process.env.PERSONALISED_LEARNING ??= "off";
