const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('response', res => {
    if (res.url().includes('/api/') || res.url().includes('supabase.co')) {
      console.log('NET:', res.status(), res.url().split('?')[0]);
    }
  });

  await page.goto('http://127.0.0.1:3000/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[name="email"]').fill('staging-teacher@lessonfoundry.internal');
  await page.locator('input[name="password"]').fill('StagingTeacherPass123!');
  await page.locator('button[type="submit"]:has-text("Sign in with email")').click();
  
  await page.waitForTimeout(4000);
  console.log('Final URL:', page.url());
  const html = await page.content();
  console.log('Has heading My Classrooms?', html.includes('My Classrooms'));
  console.log('Has skeleton?', html.includes('skeleton'));
  
  await browser.close();
})();
