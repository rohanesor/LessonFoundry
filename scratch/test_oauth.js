const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();

  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('supabase') || u.includes('google') || u.includes('auth')) {
      console.log('REQUEST:', req.method(), u.substring(0, 120));
    }
  });
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('supabase') || u.includes('google') || u.includes('auth')) {
      console.log('RESPONSE:', res.status(), u.substring(0, 120));
    }
  });

  console.log('Navigating to /login...');
  await page.goto('http://127.0.0.1:3000/login');
  await page.waitForLoadState('networkidle');

  console.log('Clicking Continue with Google...');
  await page.locator('button:has-text("Continue with Google")').click();

  await page.waitForTimeout(5000);
  console.log('FINAL URL:', page.url());

  await browser.close();
})().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
