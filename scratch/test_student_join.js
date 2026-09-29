const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('response', res => {
    if (res.url().includes('/api/')) console.log('API:', res.status(), res.url());
  });

  await page.goto('http://127.0.0.1:3000/login');
  await page.locator('input[name="email"]').fill('staging-student@lessonfoundry.internal');
  await page.locator('input[name="password"]').fill('StagingStudentPass123!');
  await page.locator('button[type="submit"]:has-text("Sign in with email")').click();
  await page.waitForURL(/student/, { timeout: 15000 });
  await page.waitForTimeout(1000);

  console.log('On student page. Clicking Join Classroom...');
  await page.locator('button:has-text("Join Classroom")').click();
  await page.locator('input[placeholder="LF-XXXXX"]').fill('LF-6HEP2');
  await page.locator('button[type="submit"]:has-text("Join")').click();
  await page.waitForTimeout(3000);

  const alert = page.locator('.alert');
  if (await alert.isVisible()) {
    console.log('Join alert text:', await alert.textContent());
  } else {
    console.log('No alert. Classroom cards count:', await page.locator('.classroom-card').count());
  }

  await browser.close();
})();
