import { test, expect, type Page } from "@playwright/test";

const sizes = [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }];
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".skeletons")).toHaveCount(0);
    await expect(page.getByText("Checking recent packs…", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflow at ${size.width}`).toBe(true);
    await page.screenshot({ path: `test-results/v5-${name}-${size.width}.png`, fullPage: true });
  }
  await page.setViewportSize(sizes[0]);
}

test("v5 pages read-only responsive audit", async ({ page, browser }) => {
  test.skip(!process.env.STAGING_TEACHER_EMAIL || !process.env.STAGING_STUDENT_EMAIL, "Staging credentials required");
  const errors: string[] = [];
  const failures: number[] = [];
  const monitor = async (p: Page) => {
    p.on("pageerror", () => errors.push("Uncaught exception"));
    p.on("console", m => { if(m.type() === "error") errors.push("Console error"); });
    p.on("response", r => { if (r.status() >= 400) failures.push(r.status()); });
    await p.route("**/api/**", async route => {
      if (route.request().method() !== "GET") throw new Error("Application mutation forbidden in visual audit");
      await route.continue();
    });
  };
  const login = async (p: Page, role: "TEACHER" | "STUDENT") => {
    await p.goto("/login");
    await p.getByLabel("Email", { exact: true }).fill(process.env[`STAGING_${role}_EMAIL`]!);
    await p.getByLabel("Password", { exact: true }).fill(process.env[`STAGING_${role}_PASSWORD`]!);
    await p.getByRole("button", { name: "Sign in with email" }).click();
    await expect(p).toHaveURL(new RegExp(`/${role.toLowerCase()}$`), { timeout: 30000 });
    await expect(p.getByRole("heading", { name: "My Classrooms" })).toBeVisible();
  };
  await monitor(page);
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in with email" })).toBeVisible();
  await capture(page, "login");
  await login(page, "TEACHER");
  const classroom = page.locator("a.classroom-card").filter({ hasText: "E2E Acceptance Classroom" });
  await expect(classroom).toHaveCount(1);
  await capture(page, "teacher-home");
  await classroom.click();
  const pack = page.getByRole("link", { name: /Newton Mechanics E2E/ });
  await expect(pack).toHaveCount(1);
  await capture(page, "teacher-classroom");
  await pack.click();
  await expect(page.getByRole("navigation", { name: "Pack sections" })).toBeVisible();
  await capture(page, "studio");
  await page.getByRole("navigation", { name: "Pack sections" }).getByRole("button", { name: "Sources", exact: true }).click();
  await page.getByRole("button", { name: "+ Add teacher notes" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await capture(page, "teacher-notes");
  await page.keyboard.press("Escape");
  const context = await browser.newContext();
  const student = await context.newPage();
  await monitor(student);
  try {
    await login(student, "STUDENT");
    await capture(student, "student-home");
    const studentClass = student.getByRole("link", { name: /E2E Acceptance Classroom/ });
    await expect(studentClass).toHaveCount(1);
    await studentClass.click();
    const studentPack = student.getByRole("link", { name: /Newton Mechanics E2E/ });
    await expect(studentPack).toHaveCount(1);
    await capture(student, "student-classroom");
    await studentPack.click();
    await expect(student.getByRole("heading", { name: /Newton Mechanics E2E/ })).toBeVisible();
    await capture(student, "student-pack");
    for (const name of ["Practice", "Revise", "Watch", "Resources"]) {
      await student.getByRole("button", { name, exact: true }).click();
      await capture(student, `student-${name.toLowerCase()}`);
    }
  } finally { await context.close(); }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});
