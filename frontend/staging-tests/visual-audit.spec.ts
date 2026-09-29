import { test, expect } from "@playwright/test";

test.skip(!process.env.STAGING_TEACHER_EMAIL, "BLOCKED: credentials absent");

test("visual audit screenshots", async ({ page }) => {
  // Login
  await page.goto("/login");
  await page.screenshot({ path: "test-results/audit-login.png", fullPage: true });
  
  // Auth
  await page.getByLabel("Email", { exact: true }).fill(process.env.STAGING_TEACHER_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.STAGING_TEACHER_PASSWORD!);
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page).toHaveURL(/\/teacher$/, { timeout: 30000 });
  await page.screenshot({ path: "test-results/audit-teacher-dashboard.png", fullPage: true });
  
  // Classroom
  const card = page.locator("a.classroom-card").first();
  if (await card.count()) {
    const href = await card.getAttribute("href");
    await Promise.all([page.waitForURL(new RegExp(`${href}$`)), card.click()]);
    await page.screenshot({ path: "test-results/audit-teacher-classroom.png", fullPage: true });
    
    // Pack
    const packLink = page.locator("a.card").first();
    if (await packLink.count()) {
      const ph = await packLink.getAttribute("href");
      if (ph?.includes("/teacher/packs/")) {
        await Promise.all([page.waitForURL(new RegExp(`${ph}$`)), packLink.click()]);
        await page.waitForTimeout(3000);
        await page.screenshot({ path: "test-results/audit-teacher-pack-studio.png", fullPage: true });
      }
    }
  }
});
