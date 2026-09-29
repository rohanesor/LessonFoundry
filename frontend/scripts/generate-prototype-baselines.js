#!/usr/bin/env node
/**
 * Capture reference screenshots from the official LessonFoundry prototype.
 *
 * Run after starting the prototype static server on port 3456:
 *   cd "LessonFoundry Frontend Design/design_handoff_lessonfoundry/prototype"
 *   python3 -m http.server 3456
 *
 * Then:
 *   node scripts/generate-prototype-baselines.js
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const PROTOTYPE = "http://localhost:3456/LessonFoundry%20Prototype%20v4.html";
const OUT = path.join(__dirname, "..", "tests", "visual.spec.ts-snapshots");
const PLATFORM = "linux";
function out(name) {
  return path.join(OUT, `${name}-${PLATFORM}.png`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto(PROTOTYPE);
  await page.waitForTimeout(3000);

  // The prototype loads into the Explanation studio state.
  await page.screenshot({ path: out("prototype-explanation"), fullPage: false });
  console.log("wrote prototype-explanation.png");

  // Quiz
  await page.getByRole("button", { name: "Quiz", exact: true }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: out("prototype-quiz"), fullPage: false });
  console.log("wrote prototype-quiz.png");

  // Evidence drawer from Explanation
  await page.getByRole("button", { name: "Explanation", exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /View Evidence/i }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: out("prototype-evidence-drawer"), fullPage: false });
  console.log("wrote prototype-evidence-drawer.png");

  await browser.close();
})();
