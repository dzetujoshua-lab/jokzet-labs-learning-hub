import { expect, test, type Page } from "@playwright/test";
import { localClient } from "./db";

const PASSWORD = "Correct-horse-42-battery";
const stamp = Date.now();
const email = (n: string) => `${n}-${stamp}@e2e.test`;

async function register(page: Page, name: string, address: string) {
  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(address);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("I confirm that I am 18 years old or older.").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
}
async function makeAdmin(address: string) {
  const client = await localClient();
  try { await client.query(`UPDATE "User" SET role = 'ADMIN' WHERE email = $1`, [address]); } finally { await client.end(); }
}
async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("administration centre access", () => {
  test("signed-out visitors are sent to sign in, and a learner is turned away without being told the pages exist", async ({ page }) => {
    for (const path of ["/admin", "/admin/staff", "/admin/curriculum"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login/);
    }
    await register(page, "Plain Learner", email("plain"));
    for (const path of ["/admin", "/admin/staff", "/admin/curriculum"]) {
      await page.goto(path);
      await expect(page, path).not.toHaveURL(/\/admin/);
      await expect(page.getByText("Administration Centre")).toHaveCount(0);
    }
  });
});

test.describe("administration centre for an Academy Admin", () => {
  test("shows the dashboard with real figures, its own theme, working navigation and the Staff and roles page @phone", async ({ page, isMobile }) => {
    test.setTimeout(240_000);
    const address = email("boss");
    await register(page, "Efua Boss", address);
    await makeAdmin(address); // the role is read from the database on every request, so it applies at once

    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "JOKZET Labs Academy" })).toBeVisible();
    await expect(page.getByText("Administration Centre").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Manage learning, empower learners, and maintain the quality of the Academy.")).toBeVisible();
    for (const label of ["Total learners", "Active learners", "Pending assessments", "Enrolled programmes", "Pending content reviews"]) await expect(page.getByText(label, { exact: true }), label).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Learner overview" })).toBeVisible();
    await noSideScroll(page);

    // The admin theme is scoped: the admin pages carry it, the learner pages do not.
    await expect(page.locator(".admin-theme")).toHaveCount(1);
    const adminBg = await page.locator(".admin-theme").evaluate((el) => getComputedStyle(el).getPropertyValue("--primary").trim());
    expect(adminBg).toBe("214 95% 60%");

    if (isMobile || (page.viewportSize()?.width ?? 1200) < 1024) await page.getByRole("button", { name: "Open the navigation menu" }).click();
    const nav = page.getByRole("navigation", { name: "Administration" });
    for (const label of ["Dashboard", "Staff and Roles", "Curriculum", "Review Queue", "Learner view"]) await expect(nav.getByRole("link", { name: label }), label).toBeVisible();
    await nav.getByRole("link", { name: "Staff and Roles" }).click();
    await expect(page).toHaveURL(/\/admin\/staff$/);
    await expect(page.getByRole("heading", { level: 1, name: "Staff and roles" })).toBeVisible();
    await expect(page.getByText(address)).toBeVisible(); // the admin is listed in the staff directory
    await noSideScroll(page);

    // Search in the header filters the staff list on the server.
    await page.goto("/admin/staff?q=zzzz-nobody");
    await expect(page.getByText("No staff match that search.")).toBeVisible();
    // A quick action opens its real workflow, pre-selecting the role.
    await page.goto("/admin/staff?role=AUTHOR");
    await expect(page.locator("#staff-role")).toHaveValue("AUTHOR");
    await page.goto("/admin/curriculum");
    await expect(page.getByRole("heading", { level: 1, name: "Curriculum" })).toBeVisible();

    // The learner interface keeps its own colours.
    await page.goto("/");
    await expect(page.locator(".admin-theme")).toHaveCount(0);
    const learnerPrimary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim());
    expect(learnerPrimary).toBe("74 88% 62%");
  });
});
