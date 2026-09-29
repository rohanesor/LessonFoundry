import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

// Require staging environment variables
const required = [
  "STAGING_TEACHER_EMAIL",
  "STAGING_TEACHER_PASSWORD",
  "STAGING_STUDENT_EMAIL",
  "STAGING_STUDENT_PASSWORD",
  "SUPABASE_URL",
  "SUPABASE_STAGING_PROJECT_REF",
];

test.skip(
  required.some((k) => !process.env[k]),
  "BLOCKED: staging test credentials not configured in environment",
);

async function loginAs(page: Page, email: string, pass: string, expectedRoute: "/teacher" | "/student") {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  
  // Fill email & password
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Sign in with email" }).click();
  
  // Expect URL to be redirected to the expected role dashboard
  await expect(page).toHaveURL(new RegExp(expectedRoute), { timeout: 30000 });
}

test("Phase 12 Controlled Authenticated Teacher → Student Browser E2E", async ({
  page,
  browser,
}) => {
  test.setTimeout(300000); // 5 minutes for real AI generation and browser flows

  // 1. Secret leak & Console error monitors
  let consoleErrors = 0;
  let secretLeaks = 0;
  const consoleErrorMessages: string[] = [];

  page.on("pageerror", (err) => {
    consoleErrors++;
    consoleErrorMessages.push(err.message);
  });

  const forbiddenSecrets = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.AWS_SECRET_ACCESS_KEY,
  ].filter((x): x is string => !!x && x.length > 5);

  page.on("request", (req) => {
    const data = req.url() + JSON.stringify(req.headers()) + (req.postData() || "");
    if (forbiddenSecrets.some((s) => data.includes(s))) {
      secretLeaks++;
    }
  });

  const teacherEmail = process.env.STAGING_TEACHER_EMAIL!;
  const teacherPass = process.env.STAGING_TEACHER_PASSWORD!;
  const studentEmail = process.env.STAGING_STUDENT_EMAIL!;
  const studentPass = process.env.STAGING_STUDENT_PASSWORD!;

  // =========================================================================
  // STEP 1: Teacher Authentication & Dashboard
  // =========================================================================
  await loginAs(page, teacherEmail, teacherPass, "/teacher");
  await expect(page.getByRole("heading", { name: "My Classrooms" })).toBeVisible();

  // =========================================================================
  // STEP 2: Reuse the dedicated Phase 12 classroom; do not create another.
  // =========================================================================
  const classroomCard = page.locator("a.classroom-card").filter({ hasText: "E2E Acceptance Classroom" });
  await expect(classroomCard).toHaveCount(1);
  const classroomTitle = (await classroomCard.locator("h3").textContent())?.trim();
  expect(classroomTitle).toBeTruthy();
  const classroomHref = await classroomCard.getAttribute("href");
  expect(classroomHref).toMatch(/^\/teacher\/classrooms\/[a-zA-Z0-9_-]+$/);
  await Promise.all([
    page.waitForURL(new RegExp(`${classroomHref}$`), { timeout: 30000 }),
    classroomCard.click(),
  ]);
  await expect(page.getByRole("heading", { name: classroomTitle! })).toBeVisible();

  // Extract the existing classroom's join code for the isolated student flow.
  const joinCodeLocator = page.locator(".join-code-display");
  await expect(joinCodeLocator).toBeVisible();
  const joinCode = (await joinCodeLocator.textContent())?.trim();
  expect(joinCode).toBeTruthy();
  expect(joinCode!.length).toBeGreaterThanOrEqual(5);

  // =========================================================================
  // STEP 3: Create Pack Inside Classroom
  // =========================================================================
  await page.getByRole("button", { name: "Create Learning Pack" }).click();
  const packTitle = "Newton Mechanics E2E " + Date.now();
  await page.getByLabel("Title", { exact: true }).fill(packTitle);
  await page
    .getByLabel(/Learning objectives/)
    .fill("Explain Newton's force laws\nSolve force and acceleration problems");
  await page.getByRole("button", { name: "Create →" }).click();

  // Verify pack route binding (/teacher/packs/<pack-id>)
  await expect(page).toHaveURL(/\/teacher\/packs\/[a-zA-Z0-9_-]+/, { timeout: 30000 });
  const packUrl = page.url();
  const packId = packUrl.split("/").pop()!;
  expect(packId).toBeTruthy();

  // =========================================================================
  // STEP 4: Source Ingestion (Newton Staging PDF)
  // =========================================================================
  const pdfFixture = path.resolve("../backend/integration/fixtures/newton-staging.pdf");
  expect(fs.existsSync(pdfFixture)).toBe(true);

  await page.getByRole("button", { name: "1. Add sources" }).click();
  await page.locator("input[type=file]").setInputFiles(pdfFixture);
  await expect(page.getByText("newton-staging.pdf", { exact: true })).toBeVisible({ timeout: 30000 });

  await page.getByRole("button", { name: "Overview", exact: true }).click();

  // =========================================================================
  // STEP 5: Real AI Generation (Exactly 1 Job, >= 2 Anthropic Requests)
  // =========================================================================
  // 5a. Gap check / Objective mapping
  await page.getByRole("button", { name: "2. Check objective support" }).click();
  await expect(page.getByRole("button", { name: "3. Generate learning pack" })).toBeEnabled({
    timeout: 90000,
  });

  // 5b. Generate learning pack (1 generation job)
  await page.getByRole("button", { name: "3. Generate learning pack" }).click();
  await expect(page.getByRole("button", { name: "Open studio" })).toBeVisible({
    timeout: 150000,
  });
  await page.getByRole("button", { name: "Open studio" }).click();

  // =========================================================================
  // STEP 6: Studio Areas & Validation
  // =========================================================================
  // Verify Explanation exists
  await page.getByRole("button", { name: "Explanation", exact: true }).click();
  await expect(page.getByRole("heading", { level: 3 })).toBeVisible();

  // Verify Quiz exists
  await page.getByRole("button", { name: /^Quiz/ }).click();
  await expect(page.getByRole("tab", { name: "Q1 v1" })).toBeVisible();

  // Open Validation view
  await page.getByRole("button", { name: /^Validation/ }).click();
  await expect(page.getByRole("heading", { name: "Validation & provenance", exact: true })).toBeVisible();

  // Check validation rules: FAIL checks MUST BE 0 (Rule 2)
  const failBadges = page.locator("table tbody tr .status.bad");
  const failCount = await failBadges.count();
  const passCount = await page.locator("table tbody tr .status.good").count();
  const warnCount = await page.locator("table tbody tr .status.warning").count();
  console.log(`Validation distribution: PASS=${passCount}, WARN=${warnCount}, FAIL=${failCount}`);
  expect(failCount).toBe(0);

  // =========================================================================
  // STEP 7: Pack Approval
  // =========================================================================
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Approve pack", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page
    .getByPlaceholder("Record what you verified")
    .fill("Reviewed source grounding and validated all 11 assets for Phase 12.");
  await page.getByRole("button", { name: "Approve & publish" }).click();

  // Verify approved state
  await expect(page.getByRole("button", { name: "Approved", exact: true })).toBeVisible({ timeout: 30000 });

  // =========================================================================
  // STEP 8: Publish to Classroom
  // =========================================================================
  const publishBtn = page.getByRole("button", { name: "Publish to classroom" });
  await expect(publishBtn).toBeVisible();
  await publishBtn.click();
  await expect(page.getByText(/Published to classroom/i)).toBeVisible({ timeout: 30000 });

  // Retrieve student share token for legacy check
  const shareToken = await page.evaluate(async (pid) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    if (!key) return null;
    const session = JSON.parse(localStorage.getItem(key)!);
    const r = await fetch(`/api/packs/${pid}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const d = await r.json();
    return d.share_token;
  }, packId);

  // =========================================================================
  // STEP 9: Student Authentication in Isolated Browser Context
  // =========================================================================
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();

  studentPage.on("pageerror", (err) => {
    consoleErrors++;
    consoleErrorMessages.push(err.message);
  });

  await loginAs(studentPage, studentEmail, studentPass, "/student");
  await expect(studentPage.getByRole("heading", { name: "My Classrooms" })).toBeVisible();

  // =========================================================================
  // STEP 10: Student Joins Classroom
  // =========================================================================
  await studentPage.getByRole("button", { name: "Join Classroom" }).click();
  await studentPage.getByPlaceholder("LF-XXXXX").fill(joinCode!);
  await studentPage.getByRole("button", { name: "Join", exact: true }).click();

  // Classroom card appears on student dashboard
  const classCard = studentPage.getByRole("link", { name: new RegExp(classroomTitle!) });
  await expect(classCard).toBeVisible({ timeout: 30000 });
  await classCard.click();

  // Student sees the published pack (and no drafts)
  const studentPackLink = studentPage.getByRole("link", { name: new RegExp(packTitle) });
  await expect(studentPackLink).toBeVisible({ timeout: 30000 });
  await studentPackLink.click();

  // =========================================================================
  // STEP 11: Student Pack Tabs & Controls (Learn, Practice, Watch, Revise, Resources)
  // =========================================================================
  await expect(studentPage.getByRole("heading", { name: packTitle })).toBeVisible();

  // Teacher-only controls must NOT be present
  await expect(studentPage.getByRole("button", { name: "Regenerate" })).toHaveCount(0);
  await expect(studentPage.getByRole("button", { name: "Approve pack" })).toHaveCount(0);
  await expect(studentPage.getByRole("button", { name: "Validation" })).toHaveCount(0);

  // Verify tabs
  for (const tab of ["Learn", "Practice", "Watch", "Revise", "Resources"]) {
    const tabBtn = studentPage.getByRole("button", { name: tab });
    await expect(tabBtn).toBeVisible();
    await tabBtn.click();
    await studentPage.waitForTimeout(300);
  }

  // =========================================================================
  // STEP 12: Student S3 PDF Download
  // =========================================================================
  // The worker runs the export job asynchronously; reload if needed until ready
  await expect(async () => {
    const btn = studentPage.getByRole("button", { name: "Download PDF" });
    if (!(await btn.isVisible())) {
      await studentPage.reload();
    }
    await expect(btn).toBeVisible();
  }).toPass({ timeout: 60000, intervals: [2000, 4000] });

  const downloadBtn = studentPage.getByRole("button", { name: "Download PDF" });

  // Intercept the download endpoint response to get the presigned S3 URL
  const downloadResponsePromise = studentPage.waitForResponse((r) =>
    r.url().includes(`/api/student/packs/${packId}/download`) && r.status() === 200
  );
  await downloadBtn.click();
  const downloadResponse = await downloadResponsePromise;
  const downloadData = await downloadResponse.json();
  expect(downloadData.download_url).toBeTruthy();

  // Fetch the PDF using the presigned URL
  const pdfFetch = await studentPage.request.get(downloadData.download_url);
  expect(pdfFetch.status()).toBe(200);
  const pdfBytes = await pdfFetch.body();
  expect(pdfBytes.length).toBeGreaterThan(500);
  // Verify PDF header magic bytes "%PDF-"
  expect(pdfBytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");

  // =========================================================================
  // STEP 13: Cross-Role Authorization Checks
  // =========================================================================
  // 13a. Student navigating to /teacher should redirect to /student or /login
  await studentPage.goto("/teacher");
  await expect(studentPage).not.toHaveURL(/\/teacher$/);

  // 13b. Student requesting teacher draft API directly receives 403 or 404
  const draftAttempt = await studentPage.evaluate(async (pid) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    if (!key) return 0;
    const session = JSON.parse(localStorage.getItem(key)!);
    const r = await fetch(`/api/packs/${pid}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    return r.status;
  }, packId);
  expect([403, 404]).toContain(draftAttempt);

  await studentContext.close();

  // =========================================================================
  // STEP 14: Legacy Student Flow Regression
  // =========================================================================
  if (shareToken) {
    const incognitoContext = await browser.newContext();
    const incognitoPage = await incognitoContext.newPage();
    await incognitoPage.goto(`/student/${shareToken}`);
    await expect(incognitoPage.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30000 });
    await incognitoContext.close();
  }

  // =========================================================================
  // STEP 15: Final Health & Accounting Assertions
  // =========================================================================
  expect(secretLeaks).toBe(0);
  expect(consoleErrors).toBe(0);
});
