const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const screenshotDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const results = {
    modal_redesign: false,
    document_picker: false,
    image_picker: false,
    drag_drop: false,
    image_preview: false,
    caption: false,
    teacher_description: false,
    file_validation: false,
    five_mb_image_limit: false,
    keyboard_accessibility: false,
    hydration: false,
    existing_note_save: false,
    browser_console_errors: 0,
    console_errors_list: [],
    screenshots: [],
  };

  console.log('--- STARTING PHASE A BROWSER VERIFICATION ---');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore favicon or non-critical 404s if any
      if (!text.includes('favicon.ico')) {
        results.browser_console_errors++;
        results.console_errors_list.push(text);
        console.error('BROWSER ERROR:', text);
      }
    }
  });

  page.on('pageerror', (err) => {
    results.browser_console_errors++;
    results.console_errors_list.push(err.message);
    console.error('PAGE ERROR:', err.message);
  });

  try {
    // 1. Visit /login & verify hydration
    console.log('Navigating to /login...');
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');

    const brandLogo = page.locator('.brand');
    await brandLogo.waitFor({ state: 'visible', timeout: 10000 });
    results.hydration = true;
    console.log('Hydration check passed on /login.');

    // 2. Sign in as staging teacher
    console.log('Signing in as staging teacher...');
    await page.locator('input[name="email"]').fill('staging-teacher@lessonfoundry.internal');
    await page.locator('input[name="password"]').fill('StagingTeacherPass123!');
    await page.locator('button[type="submit"]:has-text("Sign in with email")').click();

    // Wait for redirect to /teacher
    await page.waitForURL(/.*\/teacher/, { timeout: 15000 });
    console.log('Logged in successfully. URL:', page.url());

    // 3. Navigate to Teacher Studio for pack 6d2a4e81-3cb1-4714-a98f-0ba0652f0f45
    const packId = '6d2a4e81-3cb1-4714-a98f-0ba0652f0f45';
    console.log(`Navigating to Teacher Studio for pack ${packId}...`);
    await page.goto(`http://localhost:3000/teacher/packs/${packId}`);
    await page.waitForLoadState('networkidle');

    // Click "Sources" tab if available
    const sourcesTab = page.locator('button:has-text("Sources"), a:has-text("Sources")').first();
    if (await sourcesTab.isVisible()) {
      await sourcesTab.click();
      await page.waitForTimeout(1000);
    }

    // 4. Test Modal Redesign: Open "+ Add teacher notes"
    console.log('Testing "+ Add teacher notes" modal...');
    const addNotesBtn = page.locator('button:has-text("+ Add teacher notes")').first();
    await addNotesBtn.waitFor({ state: 'visible', timeout: 10000 });
    await addNotesBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    const dialogTitle = await page.locator('[role="dialog"] h2, [role="dialog"] [class*="Title"]').textContent();
    console.log('Modal title:', dialogTitle);
    if (dialogTitle && dialogTitle.includes('Add trusted teacher notes')) {
      results.modal_redesign = true;
    }

    // Check presence of Attach Document, Attach Image, and Dropzone
    const attachDocBtn = page.locator('button:has-text("+ Attach Document")');
    const attachImgBtn = page.locator('button:has-text("+ Attach Image")');
    const dropzone = page.locator('[role="button"]:has-text("Drag & drop a document or image here")');

    if (await attachDocBtn.isVisible()) results.document_picker = true;
    if (await attachImgBtn.isVisible()) results.image_picker = true;
    if (await dropzone.isVisible()) results.drag_drop = true;

    // 5. Test Keyboard Accessibility on Dropzone
    console.log('Testing Keyboard Accessibility on Dropzone...');
    await dropzone.focus();
    const isFocused = await dropzone.evaluate((el) => document.activeElement === el);
    if (isFocused) {
      results.keyboard_accessibility = true;
      console.log('Dropzone is keyboard focusable.');
    }

    // 6. Test File Validation: 5 MB Image Limit
    console.log('Testing 5 MB Image Limit rejection...');
    // Create a 5.5 MB mock file buffer
    const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024, 'a');
    const dropzoneInput = page.locator('[role="dialog"] input[type="file"][accept*=".png"]').last();

    await dropzoneInput.setInputFiles({
      name: 'oversized_diagram.png',
      mimeType: 'image/png',
      buffer: largeBuffer,
    });

    await page.waitForTimeout(500);
    const alertLocator = page.locator('div.alert[role="alert"]');
    if (await alertLocator.isVisible()) {
      const alertText = await alertLocator.textContent();
      console.log('Validation alert text:', alertText);
      if (alertText && alertText.includes('5 MB image limit')) {
        results.file_validation = true;
        results.five_mb_image_limit = true;
      }
    }

    const validationScreenshotPath = path.join(screenshotDir, 'phase_a_file_validation_5mb.png');
    await page.screenshot({ path: validationScreenshotPath, fullPage: false });
    results.screenshots.push(validationScreenshotPath);
    console.log('Captured validation screenshot:', validationScreenshotPath);

    // 7. Test Valid Image Picker & Preview
    console.log('Testing valid image attachment and preview...');
    // 1x1 transparent PNG buffer
    const validPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const imgInput = page.locator('[role="dialog"] input[type="file"][accept*="image/png"]').first();
    await imgInput.setInputFiles({
      name: 'free_body_diagram.png',
      mimeType: 'image/png',
      buffer: validPngBuffer,
    });

    await page.waitForTimeout(1000);

    // Check preview <img>
    const previewImg = page.locator('[role="dialog"] img[alt*="free_body_diagram.png"]');
    if (await previewImg.isVisible()) {
      results.image_preview = true;
      console.log('Image preview rendered successfully.');
    }

    // Check Figure caption and Authoritative teacher description
    const captionInput = page.locator('[role="dialog"] input[placeholder*="Free-body diagram"]');
    const descriptionTextarea = page.locator('[role="dialog"] textarea[placeholder*="visual elements"]');

    if (await captionInput.isVisible() && await descriptionTextarea.isVisible()) {
      await captionInput.fill('Figure 1: Free-body diagram on inclined plane');
      await descriptionTextarea.fill('Authoritative diagram showing gravity vector decomposed into parallel and perpendicular components.');
      results.caption = true;
      results.teacher_description = true;
      console.log('Caption and teacher description filled.');
    }

    // 8. Test Document Attachment
    console.log('Testing valid document attachment...');
    const docInput = page.locator('[role="dialog"] input[type="file"][accept*=".pdf"]').first();
    const mockPdfBuffer = Buffer.from('%PDF-1.4 mock pdf content for testing phase A note attachments');
    await docInput.setInputFiles({
      name: 'supplementary_mechanics.pdf',
      mimeType: 'application/pdf',
      buffer: mockPdfBuffer,
    });

    await page.waitForTimeout(1000);
    const docCard = page.locator('article:has-text("supplementary_mechanics.pdf")');
    if (await docCard.isVisible()) {
      console.log('Document attachment card rendered with Phase B mode controls.');
    }

    // Capture full modal screenshot with attachments
    const modalScreenshotPath = path.join(screenshotDir, 'phase_a_modal_redesigned.png');
    await page.screenshot({ path: modalScreenshotPath, fullPage: false });
    results.screenshots.push(modalScreenshotPath);
    console.log('Captured modal screenshot:', modalScreenshotPath);

    // 9. Test Existing Note Save
    console.log('Testing note save (API contract preservation)...');
    const contentTextarea = page.locator('textarea[name="text"]');
    await contentTextarea.fill(
      "Newton's First Law: An object remains at rest or in uniform motion unless acted upon by a net external force. Newton's Second Law: F = dp/dt = ma. Newton's Third Law: When body A exerts a force on body B, body B exerts an equal and opposite force on body A."
    );

    const saveBtn = page.locator('button:has-text("Save source version")');
    
    // Listen for response from /sources/text
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/sources/text') && res.status() === 200, { timeout: 15000 }),
      saveBtn.click(),
    ]);

    const resJson = await response.json();
    console.log('Save response received:', resJson);
    if (resJson && resJson.id) {
      results.existing_note_save = true;
      console.log('Existing note save passed! New source ID:', resJson.id);
    }

    await page.waitForTimeout(2000);

    // Final screenshot after save
    const afterSaveScreenshotPath = path.join(screenshotDir, 'phase_a_after_save.png');
    await page.screenshot({ path: afterSaveScreenshotPath, fullPage: false });
    results.screenshots.push(afterSaveScreenshotPath);

    console.log('--- VERIFICATION COMPLETE ---');
    console.log(JSON.stringify(results, null, 2));

    fs.writeFileSync(path.join(__dirname, 'phase_a_results.json'), JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    results.error = err.message;
    fs.writeFileSync(path.join(__dirname, 'phase_a_results.json'), JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})();
