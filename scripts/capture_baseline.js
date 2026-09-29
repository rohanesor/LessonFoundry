const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:3000';
const OUT_DIR = path.resolve(__dirname, '../scratch/screenshots/baseline');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

const TEACHER_EMAIL = 'staging-teacher@lessonfoundry.internal';
const TEACHER_PASS = 'StagingTeacherPass123!';
const STUDENT_EMAIL = 'staging-student@lessonfoundry.internal';
const STUDENT_PASS = 'StagingStudentPass123!';

const CLASSROOM_ID = '720cdc74-2ebb-4db1-8108-051dbf608873';
const PACK_ID = '6d2a4e81-3cb1-4714-a98f-0ba0652f0f45';

const diagnostics = {
  consoleErrors: [],
  consoleWarnings: [],
  pageErrors: [],
  failedRequests: [],
};

function setupMonitoring(page, name) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      diagnostics.consoleErrors.push({ page: name, text: msg.text() });
    } else if (msg.type() === 'warning') {
      diagnostics.consoleWarnings.push({ page: name, text: msg.text() });
    }
  });

  page.on('pageerror', (err) => {
    diagnostics.pageErrors.push({ page: name, error: err.message, stack: err.stack });
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      diagnostics.failedRequests.push({ page: name, url: res.url(), status: res.status() });
    }
  });
}

async function loginAs(page, email, pass, targetRole) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(pass);
  await page.locator('button[type="submit"]:has-text("Sign in with email")').click();
  await page.waitForURL(new RegExp(targetRole), { timeout: 20000 });
  await page.locator('h1').waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);
}

async function capture() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  console.log('=== Capturing Login Screen ===');
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({ viewport: vp });
    const page = await context.newPage();
    setupMonitoring(page, `login-${vpName}`);
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Continue with Google")').waitFor({ timeout: 15000 });
    await page.waitForTimeout(400);
    const file = path.join(OUT_DIR, `login-${vpName}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`Saved: ${file}`);
    await context.close();
  }

  console.log('=== Capturing Teacher Dashboard & Classrooms ===');
  const teacherContext = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const teacherPage = await teacherContext.newPage();
  setupMonitoring(teacherPage, 'teacher');
  await loginAs(teacherPage, TEACHER_EMAIL, TEACHER_PASS, 'teacher');

  // Teacher dashboard desktop
  await teacherPage.locator('h1:has-text("My Classrooms")').waitFor({ timeout: 15000 });
  await teacherPage.waitForTimeout(600);
  await teacherPage.screenshot({ path: path.join(OUT_DIR, 'teacher-dashboard-desktop.png'), fullPage: true });

  // Teacher classroom
  await teacherPage.goto(`${BASE_URL}/teacher/classrooms/${CLASSROOM_ID}`);
  await teacherPage.waitForLoadState('networkidle');
  await teacherPage.locator('h1').waitFor({ timeout: 15000 });
  await teacherPage.waitForTimeout(600);
  await teacherPage.screenshot({ path: path.join(OUT_DIR, 'teacher-classroom-desktop.png'), fullPage: true });

  // Teacher pack studio - Overview
  await teacherPage.goto(`${BASE_URL}/teacher/packs/${PACK_ID}`);
  await teacherPage.waitForLoadState('networkidle');
  await teacherPage.locator('.page, .studio, .shell').first().waitFor({ timeout: 15000 });
  await teacherPage.waitForTimeout(800);
  await teacherPage.screenshot({ path: path.join(OUT_DIR, 'teacher-pack-overview-desktop.png'), fullPage: true });

  // Teacher pack studio - Explanation
  const expBtn = teacherPage.locator('button:has-text("Explanation")').first();
  if (await expBtn.isVisible()) {
    await expBtn.click();
    await teacherPage.waitForTimeout(600);
    await teacherPage.screenshot({ path: path.join(OUT_DIR, 'teacher-pack-explanation-desktop.png'), fullPage: true });
  }

  // Teacher pack studio - Quiz
  const quizBtn = teacherPage.locator('button:has-text("Quiz")').first();
  if (await quizBtn.isVisible()) {
    await quizBtn.click();
    await teacherPage.waitForTimeout(600);
    await teacherPage.screenshot({ path: path.join(OUT_DIR, 'teacher-pack-quiz-desktop.png'), fullPage: true });
  }

  // Teacher pack studio - Validation
  const valBtn = teacherPage.locator('button:has-text("Validation"), button:has-text("Quality report")').first();
  if (await valBtn.isVisible()) {
    await valBtn.click();
    await teacherPage.waitForTimeout(600);
    await teacherPage.screenshot({ path: path.join(OUT_DIR, 'teacher-pack-validation-desktop.png'), fullPage: true });
  }

  await teacherContext.close();

  console.log('=== Capturing Student Experience ===');
  const studentContext = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const studentPage = await studentContext.newPage();
  setupMonitoring(studentPage, 'student');
  await loginAs(studentPage, STUDENT_EMAIL, STUDENT_PASS, 'student');

  // Student dashboard desktop
  await studentPage.locator('h1:has-text("My Classrooms")').waitFor({ timeout: 15000 });

  // Join classroom if not already visible
  const existingClassCard = studentPage.locator(`a[href*="${CLASSROOM_ID}"]`);
  if (!(await existingClassCard.isVisible())) {
    const joinBtn = studentPage.locator('button:has-text("Join Classroom")');
    if (await joinBtn.isVisible()) {
      await joinBtn.click();
      await studentPage.locator('input[placeholder="LF-XXXXX"]').fill('LF-6HEP2');
      await studentPage.locator('button[type="submit"]:has-text("Join")').click();
      await studentPage.waitForTimeout(1000);
    }
  }

  await studentPage.screenshot({ path: path.join(OUT_DIR, 'student-dashboard-desktop.png'), fullPage: true });

  // Student classroom
  await studentPage.goto(`${BASE_URL}/student/classrooms/${CLASSROOM_ID}`);
  await studentPage.waitForLoadState('networkidle');
  await studentPage.locator('h1').waitFor({ timeout: 15000 });
  await studentPage.waitForTimeout(600);
  await studentPage.screenshot({ path: path.join(OUT_DIR, 'student-classroom-desktop.png'), fullPage: true });

  // Student pack
  await studentPage.goto(`${BASE_URL}/student/packs/${PACK_ID}`);
  await studentPage.waitForLoadState('networkidle');
  await studentPage.waitForTimeout(800);
  await studentPage.screenshot({ path: path.join(OUT_DIR, 'student-pack-desktop.png'), fullPage: true });

  await studentContext.close();

  // Mobile checks for teacher & student
  const mobileContext = await browser.newContext({ viewport: VIEWPORTS.mobile });
  const mobilePage = await mobileContext.newPage();
  setupMonitoring(mobilePage, 'mobile-teacher');
  await loginAs(mobilePage, TEACHER_EMAIL, TEACHER_PASS, 'teacher');
  await mobilePage.screenshot({ path: path.join(OUT_DIR, 'teacher-dashboard-mobile.png'), fullPage: true });
  await mobilePage.goto(`${BASE_URL}/teacher/packs/${PACK_ID}`);
  await mobilePage.waitForLoadState('networkidle');
  await mobilePage.waitForTimeout(500);
  await mobilePage.screenshot({ path: path.join(OUT_DIR, 'teacher-pack-mobile.png'), fullPage: true });
  await mobileContext.close();

  await browser.close();

  fs.writeFileSync(
    path.join(OUT_DIR, 'diagnostics.json'),
    JSON.stringify(diagnostics, null, 2),
    'utf-8'
  );
  console.log('=== Baseline Capture Complete ===');
  console.log(`Console Errors: ${diagnostics.consoleErrors.length}`);
  console.log(`Page Errors: ${diagnostics.pageErrors.length}`);
  console.log(`Failed Requests: ${diagnostics.failedRequests.length}`);
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
