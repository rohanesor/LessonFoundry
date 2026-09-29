import { test, expect } from "@playwright/test";

test.skip(!process.env.STAGING_TEACHER_EMAIL || !process.env.STAGING_TEACHER_PASSWORD, "BLOCKED: staging teacher credentials absent");

test("retained generated pack renders validation results", async ({ page }) => {
  const consoleErrors: string[] = [];
  const criticalRequests: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) criticalRequests.push(`${response.request().method()} ${response.url()}`);
  });

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env.STAGING_TEACHER_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.STAGING_TEACHER_PASSWORD!);
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page).toHaveURL(/\/teacher$/, { timeout: 30000 });

  const classroom = page.locator("a.classroom-card").filter({ hasText: "E2E Acceptance Classroom" });
  await expect(classroom).toHaveCount(1);
  const classroomHref = await classroom.getAttribute("href");
  await Promise.all([page.waitForURL(new RegExp(`${classroomHref}$`)), classroom.click()]);

  const pack = page.getByRole("link", { name: /Newton Mechanics E2E/ });
  await expect(pack).toHaveCount(1);
  const packHref = await pack.getAttribute("href");
  await Promise.all([page.waitForURL(new RegExp(`${packHref}$`)), pack.click()]);
  await page.getByRole("button", { name: "Validation", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Validation & provenance", exact: true })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();

  const results = await page.locator("table tbody tr .status").allTextContents();
  const count = (state: string) => results.filter((value) => value.trim() === state).length;
  expect(count("FAIL")).toBe(0);
  expect(consoleErrors).toEqual([]);
  expect(criticalRequests).toEqual([]);
  console.log(`Validation distribution PASS=${count("PASS")} WARN=${count("WARNING") + count("NEEDS REVIEW")} INFO=${count("INFO")} FAIL=${count("FAIL")}`);
});
