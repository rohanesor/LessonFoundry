import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
const required = [
  "STAGING_USER_A_EMAIL",
  "STAGING_USER_A_PASSWORD",
  "STAGING_USER_B_EMAIL",
  "STAGING_USER_B_PASSWORD",
  "SUPABASE_STAGING_PROJECT_REF",
  "SUPABASE_URL",
];
test.skip(
  required.some((k) => !process.env[k]),
  "BLOCKED: staging credentials not configured",
);
async function login(page: Page, user: "A" | "B") {
  await page.goto("/");
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env[`STAGING_USER_${user}_EMAIL`]!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env[`STAGING_USER_${user}_PASSWORD`]!);
  await page.getByRole("button", { name: "Open teacher studio" }).click();
  await expect(
    page.getByRole("heading", { name: "Your teaching, connected." }),
  ).toBeVisible();
}
test("Supabase sessions, reload persistence, isolated teacher data and approval", async ({
  page,
  browser,
}) => {
  expect(new URL(process.env.SUPABASE_URL!).hostname).toBe(
    process.env.SUPABASE_STAGING_PROJECT_REF + ".supabase.co",
  );
  let errors = 0;
  let secretLeaks = 0;
  page.on("pageerror", () => errors++);
  const forbidden = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "ANTHROPIC_API_KEY",
    "HEYGEN_API_KEY",
  ]
    .map((k) => process.env[k])
    .filter((x): x is string => !!x);
  page.on("request", (r) => {
    const data = r.url() + JSON.stringify(r.headers()) + (r.postData() || "");
    if (forbidden.some((s) => data.includes(s))) secretLeaks++;
  });
  await login(page, "A");
  const title = "Staging browser persistence " + Date.now();
  await page
    .getByRole("button", { name: "Create Learning Pack", exact: true })
    .click();
  await page.getByLabel("Topic", { exact: true }).fill(title);
  await page
    .getByLabel(/Learning objectives/)
    .fill("Explain Newton's force laws\nSolve force and acceleration problems");
  await page.getByRole("button", { name: "Create pack →" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles(
      path.resolve("../backend/integration/fixtures/newton-staging.pdf"),
    );
  await expect(
    page.getByText("newton-staging.pdf", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "2. Check objective support" })
    .click();
  await expect(
    page.getByRole("button", { name: "3. Generate learning pack" }),
  ).toBeEnabled({ timeout: 90000 });
  await page.getByRole("button", { name: "3. Generate learning pack" }).click();
  await expect(page.getByRole("button", { name: "Open studio" })).toBeVisible({
    timeout: 90000,
  });
  await page.getByRole("button", { name: "Explanation", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Persisted staging explanation");
  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(
    page.getByRole("heading", { name: "Persisted staging explanation" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your teaching, connected." }),
  ).toBeVisible();
  await page.getByRole("button", { name: title, exact: true }).click();
  await page.getByRole("button", { name: "Explanation", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Persisted staging explanation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Quiz/ }).click();
  await page.getByRole("tab", { name: "Q3 v1" }).click();
  await page.getByRole("button", { name: "Regenerate question" }).click();
  await expect(page.getByRole("tab", { name: "Q3 v2" })).toBeVisible({
    timeout: 90000,
  });
  for (const n of [1, 2, 4, 5])
    await expect(page.getByRole("tab", { name: `Q${n} v1` })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: title, exact: true }).click();
  await page.getByRole("button", { name: /^Versions/ }).click();
  await expect(
    page.getByRole("heading", { name: "Controlled regeneration" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve pack", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page
    .getByPlaceholder("Record what you verified")
    .fill(
      "Reviewed the test source, answers and semantic warnings for staging verification.",
    );
  await page.getByRole("button", { name: "Approve & publish" }).click();
  await expect(
    page.getByRole("button", { name: "Approved", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Approved", exact: true }),
  ).toBeVisible();
  const student = await page
    .getByRole("link", { name: "Student view" })
    .getAttribute("href");
  const packId = await page.evaluate(() => localStorage.getItem("lf-pack"));
  const learner = await browser.newPage();
  await learner.goto(new URL(student!, page.url()).toString());
  await expect(
    learner.getByRole("heading", { name: "Persisted staging explanation" }),
  ).toBeVisible();
  await expect(learner.getByRole("button", { name: "Regenerate" })).toHaveCount(
    0,
  );
  await learner.close();
  const contextB = await browser.newContext();
  const other = await contextB.newPage();
  await login(other, "B");
  await expect(
    other.getByRole("button", { name: title, exact: true }),
  ).toHaveCount(0);
  const status = await other.evaluate(async (pid) => {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
    if (!key) return 0;
    const session = JSON.parse(localStorage.getItem(key)!);
    return (
      await fetch(`/api/packs/${pid}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    ).status;
  }, packId);
  expect(status).toBe(404);
  await contextB.close();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open teacher studio" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open teacher studio" }),
  ).toBeVisible();
  expect(errors).toBe(0);
  expect(secretLeaks).toBe(0);
});
