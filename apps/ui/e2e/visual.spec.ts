import { expect, test } from "./fixtures/auth";

/**
 * Visual regression baseline for the canonical user-facing pages.
 *
 *   bun run e2e e2e/visual.spec.ts                     # compare
 *   bun run e2e e2e/visual.spec.ts --update-snapshots  # accept changes
 *
 * Screenshots live under `e2e/__screenshots__/<spec>/<test>-<browser>-<platform>.png`.
 *
 * **Cross-platform note:** baselines committed from macOS rarely match Linux
 * CI byte-for-byte (font hinting + anti-aliasing differ). The CI job runs
 * with `--update-snapshots` on `main` and compares on PR. See validate.yml.
 *
 * Volatile UI (timestamps, focus rings, animations) is masked or disabled.
 */

const VISUAL_OPTS = {
  fullPage: true,
  animations: "disabled" as const,
  // 1% pixel tolerance protects against sub-pixel rendering differences.
  maxDiffPixelRatio: 0.01
};

/*
 * Visual regression baselines are captured on Chromium only. Other engines
 * (WebKit, Firefox) render text/anti-aliasing differently and would force
 * per-engine baselines for no real test value.
 */
test.describe("Visual regression — canonical pages", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "visual regression runs on Chromium only"
  );

  test.beforeEach(async ({ page }) => {
    // Stop CSS animations + transitions so screenshots are deterministic.
    await page.addStyleTag({
      content: `*, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }`
    });
  });

  test("login page baseline", async ({ page, login }) => {
    await login.goto();
    // Wait for the form to be fully painted (button visible + no spinner).
    await expect(login.submitButton()).toBeVisible();
    await expect(page).toHaveScreenshot("login.png", VISUAL_OPTS);
  });

  test("login page with validation errors baseline", async ({
    page,
    login
  }) => {
    await login.goto();
    await login.submit();
    // Wait until both alerts appear (form rejects empty submission).
    await expect(page.getByRole("alert")).toHaveCount(2);
    await expect(page).toHaveScreenshot(
      "login-validation-errors.png",
      VISUAL_OPTS
    );
  });

  test("dashboard page baseline (authed)", async ({ page, authedPage }) => {
    await expect(authedPage.dashboard.heading()).toBeVisible();
    // Wait for summary cards to render (or 'empty' state if API is slow).
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("dashboard.png", VISUAL_OPTS);
  });

  test("not-found page baseline", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(
      page.getByRole("heading", { name: /page not found/i })
    ).toBeVisible();
    await expect(page).toHaveScreenshot("not-found.png", VISUAL_OPTS);
  });
});
