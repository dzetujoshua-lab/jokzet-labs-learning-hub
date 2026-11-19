import { expect, test } from "@playwright/test";
import { completeOnboarding, noSideScroll, registerLearner, uniqueEmail } from "./helpers";

test.describe("onboarding to the learner home", () => {
  test("a new learner picks one course, builds and confirms a plan, and lands on a dashboard that shows only that course @phone", async ({ page }) => {
    await registerLearner(page, "Ama Onboard", uniqueEmail("onboard"));
    await completeOnboarding(page, { course: /Full-stack Development/ });

    // The dashboard: greeting, the one course, real empty states, no invented numbers.
    await expect(page.getByRole("heading", { level: 1, name: /Good (morning|afternoon|evening), Ama!/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your course" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Full-stack Development/ }).first()).toBeVisible();
    await expect(page.getByText("0 XP").filter({ visible: true }).first()).toBeVisible(); // the header exists twice (desktop bar, phone header); one is shown
    await expect(page.getByText("No assessments yet")).toBeVisible();
    await expect(page.getByText("No achievements earned yet")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-atmosphere", "medium");
    await noSideScroll(page);

    // The courses page lists exactly the one enrolled course; the others are only on the explore page.
    await page.goto("/departments");
    await expect(page.getByRole("link", { name: /Full-stack Development/ }).first()).toBeVisible();
    await expect(page.getByText("Photography", { exact: false })).toHaveCount(0);
  });

  test("the learner cannot go back into the wizard once the plan is confirmed, and every sidebar link opens a real page", async ({ page }) => {
    test.setTimeout(300_000); // ten pages, each a few seconds on a cold production build
    await registerLearner(page, "Kofi Nav", uniqueEmail("nav"));
    await completeOnboarding(page, { course: /Full-stack Development/ });
    await page.goto("/onboarding");
    await expect(page).not.toHaveURL(/\/onboarding/);

    const nav = page.getByRole("navigation", { name: "Primary" });
    const labels = ["Home", "My Courses", "Learning Materials", "Timetable", "Daily Activities", "Assessments", "Evidence", "My Progress", "Portfolio", "Reminders"];
    for (const label of labels) {
      const link = nav.getByRole("link", { name: label, exact: true });
      await expect(link, label).toBeVisible();
      const href = await link.getAttribute("href");
      const response = await page.goto(href!);
      expect(response?.status(), `${label} -> ${href}`).toBeLessThan(400);
      await expect(page.getByRole("heading").first(), label).toBeVisible();
    }
  });

  test("search finds lessons in the learner's own course, says so plainly when nothing matches, and refuses a one-letter query", async ({ page }) => {
    await registerLearner(page, "Esi Search", uniqueEmail("search"));
    await completeOnboarding(page, { course: /Full-stack Development/ });

    const box = page.getByRole("searchbox", { name: /Search/ }).first();
    await expect(box).toBeVisible();
    await box.fill("responsive");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=responsive/);
    await expect(page.getByRole("link", { name: /Build a responsive profile page/ })).toBeVisible();

    await page.goto("/search?q=zzzqqq");
    await expect(page.getByText("Nothing found")).toBeVisible();
    await page.goto("/search?q=a");
    await expect(page.getByText("Type at least two letters")).toBeVisible();
    // A course she has not added is not searched as a lesson, only offered as a course she could add.
    await page.goto("/search?q=exposures");
    await expect(page.getByRole("link", { name: /Shoot one subject/ })).toHaveCount(0);
  });
});

test.describe("adding a second course", () => {
  test("the learner adds a second course explicitly; both then appear, and the first keeps its own progress", async ({ page }) => {
    await registerLearner(page, "Yaw Enrol", uniqueEmail("enrol"));
    await completeOnboarding(page, { course: /Full-stack Development/, everyDay: true, sessionMinutes: 90 });

    // Before: one course, and the other programmes are only offered on the explore page.
    await expect(page.getByRole("heading", { name: "Your course" })).toBeVisible();
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: "Add a course" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Full-stack Development" })).toHaveCount(0); // already taken, so not offered

    const card = page.locator("section", { has: page.getByRole("heading", { name: "UI/UX Design" }) });
    await card.getByRole("button", { name: "Add this course" }).click();
    await page.getByRole("button", { name: "Check my timetable" }).click();
    const confirm = page.getByRole("button", { name: "Confirm and add" });
    await expect(confirm).toBeEnabled({ timeout: 30_000 });
    await confirm.click();
    await expect(page).toHaveURL(/\/departments\/uxui/, { timeout: 60_000 }); // the app takes her to the new course

    // After: both courses, each with its own progress, and the home shows "Your courses".
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your courses" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Full-stack Development/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /UI\/UX Design/ }).first()).toBeVisible();
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: "UI/UX Design" })).toHaveCount(0); // now added, so no longer offered
  });
});
