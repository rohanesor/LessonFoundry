import { test, expect } from "@playwright/test";

const required = ["STAGING_TEACHER_EMAIL", "STAGING_TEACHER_PASSWORD"];
test.skip(required.some((key) => !process.env[key]), "BLOCKED: staging teacher credentials absent");

test("staging login bootstrap reaches teacher dashboard", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with email" })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(process.env.STAGING_TEACHER_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.STAGING_TEACHER_PASSWORD!);
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page).toHaveURL(/\/teacher$/, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: "My Classrooms" })).toBeVisible();
});
