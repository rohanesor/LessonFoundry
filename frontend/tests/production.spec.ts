import { test, expect } from "@playwright/test";

const API = "http://127.0.0.1:8000";
const head = { Authorization: "Bearer local-development-only" };

test("approved asset is locked and cannot be edited or regenerated", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  const demo = await request.post(`${API}/api/demo`, { headers: head });
  expect(demo.status()).toBe(201);
  const { id } = await demo.json();

  await expect
    .poll(
      async () => {
        const p = await (
          await request.get(`${API}/api/packs/${id}`, { headers: head })
        ).json();
        return p.jobs[0]?.state;
      },
      { timeout: 30000 },
    )
    .toBe("Succeeded");

  await request.post(`${API}/api/packs/${id}/generate`, { headers: head });
  await expect
    .poll(
      async () => {
        const p = await (
          await request.get(`${API}/api/packs/${id}`, { headers: head })
        ).json();
        return p.assets.length;
      },
      { timeout: 30000 },
    )
    .toBe(11);

  await page.goto("/");
  await page.getByRole("button", { name: "Open teacher studio" }).click();
  await page
    .getByRole("button", { name: "Newton's Laws of Motion", exact: true })
    .first()
    .click();

  await page.getByRole("button", { name: /^Quiz/ }).click();
  await page.getByRole("tab", { name: "Q3 v1" }).click();
  await page.getByRole("button", { name: "Review & approve", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page
    .getByPlaceholder("Record what you verified")
    .fill("Reviewed evidence, options, answer and source support.");
  await page.getByRole("button", { name: "Approve & publish" }).click();

  await expect(
    page.getByRole("button", { name: "Create new draft" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Approved v1 · locked/),
  ).toBeVisible();

  // Edit should be unavailable on approved version.
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Regenerate question" }),
  ).toHaveCount(0);

  // Create a draft, then regenerate should work again.
  await page.getByRole("button", { name: "Create new draft" }).click();
  await expect(
    page.getByRole("button", { name: "Regenerate question" }),
  ).toBeVisible();

  expect(errors).toEqual([]);
});

test("logout redirects to login and protected route requires authentication", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Open teacher studio" }).click();
  await expect(
    page.getByRole("heading", { name: "Your teaching, connected." }),
  ).toBeVisible();

  await page.evaluate(() => {
    sessionStorage.removeItem("lf-token");
    window.dispatchEvent(new Event("lf-signed-out"));
  });
  await expect(page.getByRole("button", { name: "Open teacher studio" })).toBeVisible();

  // Directly visiting the app without a token lands back at login.
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open teacher studio" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("exam focus renders structured concept flowchart", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  const demo = await request.post(`${API}/api/demo`, { headers: head });
  expect(demo.status()).toBe(201);
  const { id } = await demo.json();

  // Wait for the demo's gap-check job to finish before generating.
  await expect
    .poll(
      async () => {
        const p = await (
          await request.get(`${API}/api/packs/${id}`, { headers: head })
        ).json();
        return p.jobs[0]?.state;
      },
      { timeout: 30000 },
    )
    .toBe("Succeeded");

  const gen = await request.post(`${API}/api/packs/${id}/generate`, { headers: head });
  expect(gen.status()).toBe(202);
  await expect
    .poll(
      async () => {
        const p = await (
          await request.get(`${API}/api/packs/${id}`, { headers: head })
        ).json();
        return p.assets.length;
      },
      { timeout: 30000 },
    )
    .toBe(11);

  await page.goto("/");
  await page.getByRole("button", { name: "Open teacher studio" }).click();
  await page
    .getByRole("button", { name: "Newton's Laws of Motion", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Exam Focus", exact: true }).click();
  await expect(page.getByText(/Trusted source/)).toBeVisible();
  await expect(page.getByText(/Evidence passage/)).toBeVisible();

  expect(errors).toEqual([]);
});
