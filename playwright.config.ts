import { defineConfig } from "@playwright/test";
import { createRequire } from "node:module";
import path from "node:path";

const serverRequire = createRequire(path.resolve("server/package.json"));
const dotenv = serverRequire("dotenv") as { config: (options: { path: string }) => void };
dotenv.config({ path: path.resolve("server/.env") });

const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;
if (!e2eDatabaseUrl) {
  throw new Error("Set E2E_DATABASE_URL to a disposable PostgreSQL database before running Playwright.");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  globalSetup: "./e2e/lab-03/global-setup.ts",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "tablet",
      use: {
        viewport: { width: 820, height: 1180 },
      },
    },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: [
    {
      command: "npm --prefix server run dev",
      url: "http://127.0.0.1:3000/api/auth/me",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { DATABASE_URL: e2eDatabaseUrl },
    },
    {
      command: "npm --prefix client run dev -- --host 127.0.0.1 --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
