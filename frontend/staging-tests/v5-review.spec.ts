import { test, expect } from "@playwright/test";

test("v5 review drawer is read-only, filterable and responsive", async ({ page }) => {
  test.skip(!process.env.STAGING_TEACHER_EMAIL || !process.env.STAGING_TEACHER_PASSWORD, "Dedicated staging credentials required");
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/api/**", async route => {
    if (route.request().method() !== "GET") throw new Error("This verification must not mutate application data");
    await route.continue();
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env.STAGING_TEACHER_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.STAGING_TEACHER_PASSWORD!);
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page).toHaveURL(/\/teacher$/, { timeout: 30000 });
  const classroom = page.locator("a.classroom-card").filter({ hasText: "E2E Acceptance Classroom" });
  await expect(classroom).toHaveCount(1);
  await classroom.click();
  const pack = page.getByRole("link", { name: /Newton Mechanics E2E/ });
  await expect(pack).toHaveCount(1);
  await pack.click();
  await page.getByRole("button", { name: "Validation", exact: true }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Review", exact: true })).toBeVisible();
  await expect(drawer.getByText(/blocking checks/)).toBeVisible();
  await drawer.getByRole("button", { name: "Warnings", exact: true }).click();
  await expect(drawer.locator("details").first()).toBeVisible();
  await drawer.locator("details summary").first().click();
  await drawer.getByRole("button", { name: "Mark reviewed", exact: true }).first().click();
  await expect(drawer.getByRole("button", { name: "Reviewed this session" })).toBeVisible();
  await page.screenshot({ path: "test-results/v5-review-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(drawer).toBeVisible();
  expect(await drawer.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/v5-review-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  expect(errors).toEqual([]);
});
