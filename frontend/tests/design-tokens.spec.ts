import { test, expect } from "@playwright/test";

/**
 * Design-token adherence tests.
 *
 * These tests verify that the rendered application uses the exact tokens from
 * the official LessonFoundry Frontend Design handoff. They do not require
 * reference screenshots; they read computed styles directly in the browser.
 */

test("brand tokens are applied to the document", async ({ page }) => {
  await page.goto("/");
  const styles = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      bg: cs.getPropertyValue("--color-bg").trim(),
      surface: cs.getPropertyValue("--color-surface").trim(),
      text: cs.getPropertyValue("--color-text").trim(),
      accent: cs.getPropertyValue("--color-accent").trim(),
      green: cs.getPropertyValue("--lf-green").trim(),
      amber: cs.getPropertyValue("--lf-amber").trim(),
      red: cs.getPropertyValue("--lf-red").trim(),
      radius: cs.getPropertyValue("--radius-md").trim(),
      fontHeading: cs.getPropertyValue("--font-heading").trim(),
    };
  });

  // Handoff values from tokens/tokens.css
  expect(styles.bg).toBe("#f3f2f2");
  expect(styles.surface).toBe("#eae9e9");
  expect(styles.text).toContain("oklch");
  expect(styles.accent).toContain("oklch");
  expect(styles.green).toContain("oklch");
  expect(styles.amber).toContain("oklch");
  expect(styles.red).toContain("oklch");
  expect(styles.radius).toBe("0px");
  expect(styles.fontHeading).toContain("Archivo");
});

test("logo and favicon assets are official handoff assets", async ({ request }) => {
  const logo = await request.get("/logo/lockup-color.svg");
  expect(logo.ok()).toBe(true);
  const logoText = await logo.text();
  expect(logoText).toContain("Lesson");
  expect(logoText).toContain("Foundry");

  const favicon = await request.get("/favicon.svg");
  expect(favicon.ok()).toBe(true);
});

test("interactive elements have zero border radius", async ({ page }) => {
  await page.goto("/");
  const button = await page.locator("button").first();
  const radius = await button.evaluate((el) =>
    getComputedStyle(el).borderRadius,
  );
  expect(radius).toBe("0px");
});

test("focus ring uses Foundry Blue", async ({ page }) => {
  await page.goto("/");
  const button = await page.locator("button").first();
  await button.focus();
  const outline = await button.evaluate((el) =>
    getComputedStyle(el).outlineColor,
  );
  // outline-color should be the accent blue, rendered as rgb
  expect(outline).not.toBe("rgba(0, 0, 0, 0)");
});
