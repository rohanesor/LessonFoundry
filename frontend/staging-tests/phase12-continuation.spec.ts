import { test, expect } from "@playwright/test";

test.skip(!process.env.STAGING_TEACHER_EMAIL || !process.env.STAGING_TEACHER_PASSWORD || !process.env.STAGING_STUDENT_EMAIL || !process.env.STAGING_STUDENT_PASSWORD, "BLOCKED: staging E2E users absent");

async function login(page: import("@playwright/test").Page, email: string, password: string, route: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page).toHaveURL(new RegExp(`${route}$`), { timeout: 30000 });
}

test("Phase 12 retained-pack approval through student PDF", async ({ page, browser }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await login(page, process.env.STAGING_TEACHER_EMAIL!, process.env.STAGING_TEACHER_PASSWORD!, "/teacher");
  const classroom = page.locator("a.classroom-card").filter({ hasText: "E2E Acceptance Classroom" });
  await expect(classroom).toHaveCount(1);
  const classroomHref = await classroom.getAttribute("href");
  await Promise.all([page.waitForURL(new RegExp(`${classroomHref}$`)), classroom.click()]);
  const joinCode = (await page.locator(".join-code-display").textContent())?.trim();
  const packLink = page.getByRole("link", { name: /Newton Mechanics E2E/ });
  await expect(packLink).toHaveCount(1);
  const packHref = await packLink.getAttribute("href");
  await Promise.all([page.waitForURL(new RegExp(`${packHref}$`)), packLink.click()]);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const approve = page.getByRole("button", { name: "Approve pack", exact: true });
  if (await approve.count()) {
    await approve.click();
    await page.getByRole("checkbox").check();
    await page.getByPlaceholder("Record what you verified and any accepted limitations.").fill("Reviewed validation and source grounding for Phase 12 acceptance.");
    await page.getByRole("button", { name: "Approve & publish" }).click();
  }
  await expect(page.getByRole("button", { name: "Approved", exact: true })).toBeVisible({ timeout: 30000 });
  const publish = page.getByRole("button", { name: "Publish to classroom" });
  await expect(publish).toBeVisible();
  await publish.click();
  await expect(page.getByText(/Published to classroom/i)).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible({ timeout: 90000 });

  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  student.on("pageerror", e => errors.push(e.message));
  await login(student, process.env.STAGING_STUDENT_EMAIL!, process.env.STAGING_STUDENT_PASSWORD!, "/student");
  const classLink = student.getByRole("link", { name: /E2E Acceptance Classroom/ });
  if (!(await classLink.count())) {
    await student.getByRole("button", { name: "Join Classroom" }).click();
    await student.getByPlaceholder("LF-XXXXX").fill(joinCode!);
    await student.getByRole("button", { name: "Join", exact: true }).click();
  }
  await expect(classLink).toBeVisible({ timeout: 30000 });
  await classLink.click();
  const studentPack = student.getByRole("link", { name: /Newton Mechanics E2E/ });
  await expect(studentPack).toBeVisible({ timeout: 30000 });
  await studentPack.click();
  for (const name of ["Learn", "Practice", "Revise", "Watch", "Resources"]) await expect(student.getByRole("button", { name })).toBeVisible();
  await expect(student.getByRole("button", { name: "Approve pack" })).toHaveCount(0);
  await expect(student.getByRole("button", { name: "Validation" })).toHaveCount(0);
  await expect(student.getByRole("button", { name: "Download PDF" })).toBeVisible({ timeout: 90000 });
  const responsePromise = student.waitForResponse(r => r.url().includes("/api/student/packs/") && r.url().endsWith("/download") && r.status() === 200);
  await student.getByRole("button", { name: "Download PDF" }).click();
  const download = await (await responsePromise).json();
  const pdf = await student.request.get(download.download_url);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString("ascii")).toBe("%PDF-");
  await student.goto("/teacher");
  await expect(student).not.toHaveURL(/\/teacher$/);
  expect(errors).toEqual([]);
  await studentContext.close();
});
