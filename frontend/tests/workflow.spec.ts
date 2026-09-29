import { test, expect } from "@playwright/test";
test("source → evidence → quiz Q3 regeneration → approval → student", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const API = "http://127.0.0.1:8000";
  const head = { Authorization: "Bearer local-development-only" };
  const demo = await request.post(`${API}/api/demo`, {
    headers: head,
  });
  expect(demo.status()).toBe(201);
  const { id } = await demo.json();
  await expect
    .poll(
      async () => {
        const p = await (
          await request.get(`${API}/api/packs/${id}`, {
            headers: head,
          })
        ).json();
        return p.jobs[0].state;
      },
      { timeout: 30000 },
    )
    .toBe("Succeeded");
  await request.post(`${API}/api/packs/${id}/generate`, {
    headers: head,
  });
  await expect
    .poll(
      async () => {
        const p = await (
          await request.get(`${API}/api/packs/${id}`, {
            headers: head,
          })
        ).json();
        return p.assets.length;
      },
      { timeout: 30000 },
    )
    .toBe(11);
  await page.goto("/");
  await page.getByRole("button", { name: "Open teacher studio" }).click();
  await expect(
    page.getByRole("heading", { name: "Your teaching, connected." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Newton's Laws of Motion", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect source passage" })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Evidence ·/ })).toBeVisible();
  await page.screenshot({ path: "../docs/evidence/evidence-drawer.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Quiz/ }).click();
  await page.getByRole("tab", { name: "Q3 v1" }).click();
  await page.getByRole("button", { name: "Regenerate question" }).click();
  await expect(page.getByRole("tab", { name: "Q3 v2" })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole("tab", { name: "Q1 v1" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Q2 v1" })).toBeVisible();
  await page.locator("main.content").evaluate((el) => el.scrollTo(0, 0));
  await page.screenshot({ path: "../docs/evidence/quiz-q3-v2.png" });
  await page.getByRole("button", { name: /^Versions/ }).click();
  await expect(
    page.getByRole("heading", { name: "Controlled regeneration" }),
  ).toBeVisible();
  await expect(page.getByText(/Changed: quiz3. Unchanged:/)).toBeVisible();
  await page.screenshot({ path: "../docs/evidence/version-history.png" });
  await page.getByRole("button", { name: /^Quiz/ }).click();
  await page.getByRole("tab", { name: "Q3 v2" }).click();
  await page
    .getByRole("button", { name: "Review & approve", exact: true })
    .click();
  await page.getByRole("checkbox").check();
  await page
    .getByPlaceholder("Record what you verified")
    .fill("Reviewed evidence, options, answer and source support.");
  await page.getByRole("button", { name: "Approve & publish" }).click();
  await expect(
    page.getByRole("button", { name: "Create new draft" }),
  ).toBeVisible();
  const studentLink = await page
    .getByRole("link", { name: "Student view" })
    .getAttribute("href");
  await page.goto(studentLink!);
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Question 3" })).toBeVisible();
  await expect(page.getByText("Regenerate")).toHaveCount(0);
  await expect(page.getByText("Evidence")).toHaveCount(0);
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByRole("status")).toContainText(/Correct|Not quite/);
  await page.screenshot({ path: "../docs/evidence/student-view.png" });
  expect(errors).toEqual([]);
});

test("fresh source UI, navigation, video gate and tablet layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open teacher studio" }).click();
  await page
    .getByRole("button", { name: "Create Learning Pack", exact: true })
    .click();
  await page
    .getByLabel("Topic", { exact: true })
    .fill("Force relationships — fresh UI test");
  await page
    .getByLabel(/Learning objectives/)
    .fill("Explain force and acceleration\nDescribe mass and inertia");
  await page.getByRole("button", { name: "Create pack →" }).click();
  await expect(
    page.getByRole("heading", { name: "Source library" }),
  ).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "fresh-teacher-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "For constant mass, resultant force is mass multiplied by acceleration: F = ma. Acceleration is change in velocity per unit time. Mass measures inertia, the resistance to changes in motion. A 2 kg object accelerating at 3 m/s² has resultant force 6 N.",
    ),
  });
  await expect(
    page.getByText("fresh-teacher-notes.txt", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "2. Check objective support" })
    .click();
  await expect(
    page.getByRole("button", { name: "3. Generate learning pack" }),
  ).toBeEnabled({ timeout: 30000 });
  await page.getByRole("button", { name: "3. Generate learning pack" }).click();
  await expect(page.getByRole("button", { name: "Open studio" })).toBeVisible({
    timeout: 30000,
  });
  for (const name of [
    "Explanation",
    "Assessment",
    "Answer Key",
    "Exam Focus",
    "Validation",
    "Versions",
    "Resources",
  ] as const) {
    await page
      .getByRole("button", {
        name: name === "Versions" ? /^Versions/ : name,
        exact: name !== "Versions",
      })
      .first()
      .click();
    await expect(page.locator("main")).not.toBeEmpty();
  }
  await page.getByRole("button", { name: "AI Teacher", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Simulate rendering" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Review & approve script" }).click();
  await page.getByRole("checkbox").check();
  await page
    .getByPlaceholder("Record what you verified")
    .fill("Reviewed script source support and presentation sequence.");
  await page.getByRole("button", { name: "Approve & publish" }).click();
  await page.getByRole("button", { name: "Simulate rendering" }).click();
  await expect(page.getByText(/Mock render complete/)).toBeVisible({
    timeout: 30000,
  });
  await page.screenshot({ path: "../docs/evidence/mock-video-workflow.png" });
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.getByRole("button", { name: /^Quiz/ }).click();
  await page.getByRole("button", { name: "Validation details" }).click();
  await page.screenshot({ path: "../docs/evidence/tablet-studio.png" });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});
