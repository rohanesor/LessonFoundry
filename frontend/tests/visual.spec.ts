import { test, expect } from "@playwright/test";

const API = "http://127.0.0.1:8000";
const HEAD = { Authorization: "Bearer local-development-only" };

async function loginAndOpenPack(page: any) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open teacher studio" }).click();
  await page
    .getByRole("button", { name: "Newton's Laws of Motion", exact: true })
    .first()
    .click();
}

test.describe("visual regression against design prototype", () => {
  test("studio explanation layout matches prototype", async ({ page }) => {
    await loginAndOpenPack(page);
    await page.getByRole("button", { name: "Explanation", exact: true }).click();
    await expect(page).toHaveScreenshot("prototype-explanation.png", {
      maxDiffPixels: 1200,
    });
  });

  test("quiz screen matches prototype", async ({ page }) => {
    await loginAndOpenPack(page);
    await page.getByRole("button", { name: /^Quiz/ }).click();
    await page.getByRole("tab", { name: "Q3 v1" }).click();
    await expect(page).toHaveScreenshot("prototype-quiz.png", {
      maxDiffPixels: 1200,
    });
  });

  test("evidence drawer matches prototype", async ({ page }) => {
    await loginAndOpenPack(page);
    await page.getByRole("button", { name: "Sources", exact: true }).click();
    await page
      .getByRole("button", { name: "Inspect source passage" })
      .first()
      .click();
    await expect(page).toHaveScreenshot("prototype-evidence-drawer.png", {
      maxDiffPixels: 1500,
    });
  });
});
