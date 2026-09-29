const { chromium } = require("playwright");

const PROTOTYPE = "http://localhost:3456/LessonFoundry%20Prototype%20v4.html";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(PROTOTYPE);
  await page.waitForTimeout(4000);

  // Click Demo Controls (bottom-left prototype helper)
  await page.locator('button', { hasText: /Demo Controls/i }).click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: /States/i }).click();
  await page.waitForTimeout(800);

  const buttons = await page.locator('button').allInnerTexts();
  console.log("Buttons:", buttons.slice(0, 40));
  const all = await page.locator('*').allInnerTexts();
  console.log("Contains Quiz:", all.filter(t => /\bQuiz\b/.test(t)).slice(0, 5));
  // Find tag name for Quiz
  const quiz = await page.locator('text=Quiz').first();
  console.log("Quiz tag:", await quiz.evaluate(el => el.tagName));

  await browser.close();
})();
