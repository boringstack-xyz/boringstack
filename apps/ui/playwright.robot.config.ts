import { defineConfig, devices } from "@playwright/test";

import { robotConfig } from "./e2e/robot/robot.config";

/*
 * The verification robot: one new user walking the whole product, against a
 * deployed stack (production by default). No web server is started and
 * nothing is mocked. The journeys share one account, so they run in order on
 * one worker; a failed run is retried once from the top with a new account.
 */
export default defineConfig({
  testDir: "./e2e/robot",
  /* The run records what each journey called, then proves e2e/robot/api-coverage.ts against it. */
  globalSetup: "./e2e/robot/global-setup.ts",
  globalTeardown: "./e2e/robot/check-api-coverage.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [
        ["github"],
        ["list"],
        ["json", { outputFile: "robot-report/results.json" }],
        ["html", { open: "never", outputFolder: "robot-report/html" }]
      ]
    : [["list"]],
  /* A journey may first wait up to a minute for room under the request limits. */
  timeout: 180_000,
  expect: { timeout: 20_000 },
  outputDir: "robot-results",
  use: {
    baseURL: robotConfig.appURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 900 }
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 }
      }
    }
  ]
});
