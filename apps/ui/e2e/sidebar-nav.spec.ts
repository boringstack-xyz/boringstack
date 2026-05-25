import { expect, test } from "./fixtures/auth";

test.describe("Sidebar navigation", () => {
  test("desktop sidebar is visible on /dashboard and shows the brand lockup", async ({
    page,
    authedPage
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await authedPage.dashboard.goto();

    const sidebar = page.getByTestId("app-sidebar").first();

    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText(/boringstack/i)).toBeVisible();
  });

  test("sidebar links navigate to each protected route", async ({
    page,
    authedPage
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await authedPage.dashboard.goto();

    const sidebar = page.getByTestId("app-sidebar").first();

    await sidebar.getByRole("link", { name: /notifications/i }).click();
    await expect(page).toHaveURL(/\/notifications$/);

    await sidebar.getByRole("link", { name: /team/i }).click();
    await expect(page).toHaveURL(/\/account\/invitations/);

    await sidebar.getByRole("link", { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/account\/settings/);

    await sidebar.getByRole("link", { name: /profile/i }).click();
    await expect(page).toHaveURL(/\/account\/profile/);

    await sidebar.getByRole("link", { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("active route gets aria-current=page", async ({ page, authedPage }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await authedPage.dashboard.goto();

    const sidebar = page.getByTestId("app-sidebar").first();

    await expect(
      sidebar.getByRole("link", { name: /dashboard/i })
    ).toHaveAttribute("aria-current", "page");
  });

  test("mobile: sidebar is hidden, menu button opens the Sheet drawer", async ({
    page,
    authedPage
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await authedPage.dashboard.goto();

    /*
     * Two AppSidebar nodes always exist in the DOM (desktop rail + Sheet
     * portal). The desktop rail is hidden via Tailwind's `md:flex`, so
     * Playwright's visibility check filters it out — `.first()` matches
     * whichever wrapper is currently visible.
     */
    await expect(page.getByLabel(/open menu/i)).toBeVisible();

    await page.getByLabel(/open menu/i).click();
    await expect(
      page.getByRole("link", { name: /dashboard/i }).first()
    ).toBeVisible();
  });
});
