import { test, expect } from "@playwright/test";

test.skip(!process.env.STAGING_TEACHER_EMAIL || !process.env.STAGING_TEACHER_PASSWORD, "BLOCKED: staging teacher credentials absent");

test("teacher classroom card navigates to its own classroom", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env.STAGING_TEACHER_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.STAGING_TEACHER_PASSWORD!);
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page).toHaveURL(/\/teacher$/, { timeout: 30000 });

  const cards = page.locator("a.classroom-card").filter({ hasText: "E2E Acceptance Classroom" });
  await expect(cards).toHaveCount(1);
  const card = cards.first();
  const href = await card.getAttribute("href");
  expect(href).toMatch(/^\/teacher\/classrooms\/[a-zA-Z0-9_-]+$/);
  const title = (await card.locator("h3").textContent())?.trim();
  expect(title).toBeTruthy();

  await Promise.all([
    page.waitForURL(new RegExp(`${href}$`), { timeout: 30000 }),
    card.click(),
  ]);
  await expect(page.getByRole("heading", { name: title! })).toBeVisible();
});
