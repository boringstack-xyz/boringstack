/*
 * Playwright config for `factory walk`. It is run from apps/ui with apps/ui's
 * own @playwright/test, so it imports nothing: tools/ has no packages of its
 * own. Walkthroughs are `*.walk.ts` files, which the normal e2e suite skips.
 */
export default {
  testDir: "../../../apps/ui/e2e/walkthroughs",
  testMatch: "*.walk.ts",
  outputDir: "../../../apps/ui/test-results/walk",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 5 * 60_000,
  reporter: [["list"]],
  use: {
    viewport: { width: 1280, height: 800 },
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
};
