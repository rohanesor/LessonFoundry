import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
if (existsSync("../.env.staging")) process.loadEnvFile("../.env.staging");
export default defineConfig({
  testDir: "./staging-tests",
  workers: 1,
  timeout: 180000,
  use: {
    baseURL: process.env.STAGING_WEB_URL || "http://localhost:3000",
    viewport: { width: 1440, height: 1000 },
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  reporter: "./staging-tests/redacted-reporter.ts",
});
