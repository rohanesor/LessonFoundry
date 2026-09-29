import { defineConfig } from "@playwright/test";

/**
 * Visual regression config.
 *
 * Starts a static server for the official design prototypes so tests can
 * capture reference screenshots from them and compare against the app.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 120000,
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  workers: 1,
  webServer: [
    {
      command: "cd ../LessonFoundry\\ Frontend\\ Design/design_handoff_lessonfoundry/prototype && python3 -m http.server 3456",
      url: "http://localhost:3456/LessonFoundry%20Prototype%20v4.html",
      timeout: 120000,
      reuseExistingServer: true,
    },
  ],
});
