import { test, expect } from "@playwright/test";

const API = "http://127.0.0.1:8000";
const auth = { Authorization: "Bearer local-development-only" };

test("dashboard switches to readable pack cards on phones", async ({
  page,
  request,
}) => {
  const demo = await request.post(`${API}/api/demo`, { headers: auth });
  expect(demo.status()).toBe(201);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open teacher studio" }).click();

  await expect(page.getByRole("region", { name: "Learning packs" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open pack" }).first()).toBeVisible();
  await expect(page.locator(".dashboard-table")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth === window.innerWidth,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Open pack" }).first().click();
  await expect(page.getByRole("heading", { name: "Newton's Laws of Motion" })).toBeVisible();
});

test("desktop dashboard retains its information-dense table", async ({
  page,
  request,
}) => {
  const demo = await request.post(`${API}/api/demo`, { headers: auth });
  expect(demo.status()).toBe(201);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open teacher studio" }).click();

  await expect(page.locator(".dashboard-table")).toBeVisible();
  await expect(page.locator(".dashboard-pack-list")).toBeHidden();
  await expect(page.getByRole("table")).toBeVisible();
});
