import { defineConfig, devices } from "@playwright/test";

/**
 * Browser end-to-end tests. They run against a production build on a local port, using the local development database
 * (never production). Run `npm run test:e2e`.
 */
const PORT = 3100;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000, // a journey registers, onboards and then walks several pages
  expect: { timeout: 20_000 }, // the first request to a page after a build can take several seconds
  reporter: [["list"]],
  globalSetup: "./e2e/setup.ts",
  globalTeardown: "./e2e/teardown.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } }, grep: /@phone/ },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
  },
});
