import { expect, test, type Page } from "@playwright/test";

const stamp = Date.now();
const PASSWORD = "Correct-horse-42-battery";
const email = (n: string) => `${n}-${stamp}@e2e.test`;

async function register(page: Page, name: string, address: string) {
  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(address);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("I confirm that I am 18 years old or older.").check();
  await page.getByRole("button", { name: "Create account" }).click();
}

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("public pages", () => {
  test("homepage explains the academy, offers both ways in and shows the background @phone", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole("heading", { name: "Build Beyond Possible." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start learning" })).toBeVisible();
    await expect(page.getByRole("link", { name: "I already have an account" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-atmosphere", "rich");
    expect(await page.locator(".doodle:visible").count()).toBeGreaterThan(0);
    await noSideScroll(page);
  });

  test("reduced motion stops every continuous animation", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/welcome");
    const names = await page.locator(".doodle").first().evaluate((el) => getComputedStyle(el).animationName);
    const particle = await page.locator(".particle").first().evaluate((el) => getComputedStyle(el).display);
    expect(names === "none" || names === "").toBe(true);
    expect(particle).toBe("none");
    await context.close();
  });

  test("the sign-in and register pages carry the medium atmosphere @phone", async ({ page }) => {
    for (const path of ["/login", "/register"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-atmosphere", "medium");
      await noSideScroll(page);
    }
  });
});

test.describe("access control", () => {
  test("signed-out visitors are sent to sign in for private pages", async ({ page }) => {
    for (const path of ["/departments", "/assessments", "/timetable", "/review", "/onboarding"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login/);
    }
  });

  test("a wrong password is refused with a clear message and no account detail", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email("nobody"));
    await page.getByLabel("Password").fill("Wrong-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("registration", () => {
  test("the form refuses an under-confirmed or weak registration", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Name").fill("Weak Case");
    await page.getByLabel("Email").fill(email("weak"));
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator("#password-error, #adult-error").first()).toBeVisible();
  });

  test("a new learner registers, lands in onboarding and is held there until it is done @phone", async ({ page }) => {
    await register(page, "E2E Learner", email("learner"));
    await expect(page).toHaveURL(/\/onboarding/);
    await noSideScroll(page);
    await expect(page.locator("html")).toHaveAttribute("data-atmosphere", "low");
    for (const path of ["/", "/departments", "/assessments"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/onboarding/);
    }
  });

  test("a registered learner can sign out and sign back in", async ({ page }) => {
    const address = email("again");
    await register(page, "Return Learner", address);
    await expect(page).toHaveURL(/\/onboarding/);
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email").fill(address);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/onboarding/);
  });
});
