import { defineConfig, devices } from "@playwright/test";

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["html", { open: "never" }], ["list"]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] }
    }
  ],
  // Playwright expects a running stack: the UI on :3001 AND apps/api
  // reachable through the Vite proxy. Locally: `cd ../../infra/compose/compose && ./dev.sh up -d`.
  // In CI: the full-stack-smoke workflow boots the stack before running these.
  webServer: {
    command: "bun run dev",
    url: BASE_URL,
    reuseExistingServer:
      process.env.PLAYWRIGHT_REUSE_SERVER === "true" || !process.env.CI,
    timeout: 60_000
  }
});
