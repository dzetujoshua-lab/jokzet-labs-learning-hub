import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Correct-horse-42-battery";
const stamp = Date.now();
let counter = 0;
/** A unique address for this run. Every address ends in @e2e.test, which the teardown deletes. */
export const uniqueEmail = (name: string) => `${name}-${stamp}-${(counter += 1)}@e2e.test`;

export async function registerLearner(page: Page, name: string, email: string) {
  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("I confirm that I am 18 years old or older.").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
}

/**
 * Drives the onboarding wizard like a learner: experience, one course, study days, duration, skip the optional baseline,
 * build the plan, confirm it. Ends on the learner home.
 */
export async function completeOnboarding(page: Page, opts: { course: string | RegExp; everyDay?: boolean; sessionMinutes?: number }) {
  const next = page.getByRole("button", { name: "Next", exact: true });
  // 1. Experience (the default, "Complete beginner", is already chosen)
  await page.getByRole("radio", { name: /Complete beginner/ }).click();
  await next.click();
  // 2. Programmes: one first course
  await page.getByRole("radio", { name: opts.course }).first().click();
  await next.click();
  // 3. Availability
  if (opts.everyDay) {
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      const chip = page.getByRole("button", { name: day, exact: true });
      if ((await chip.getAttribute("aria-pressed")) !== "true") await chip.click();
    }
  }
  if (opts.sessionMinutes) await page.getByLabel("Minutes per session").fill(String(opts.sessionMinutes));
  await next.click();
  // 4. Duration (the default is kept)
  await page.getByRole("button", { name: "Save and continue" }).click();
  // 5. The baseline is optional. A course that offers one shows a Skip button; otherwise there is nothing to skip.
  const build = page.getByRole("button", { name: "Build my plan" });
  await expect(build).toBeVisible();
  const skip = page.getByRole("button", { name: "Skip" }).first();
  if (await skip.count()) await skip.click();
  await build.click();
  // 6. Review, then confirm
  await page.getByRole("button", { name: "Confirm and start" }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/, { timeout: 30_000 });
}

export async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
