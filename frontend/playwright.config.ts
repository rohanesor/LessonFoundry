import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 90000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  workers: 1,
});
