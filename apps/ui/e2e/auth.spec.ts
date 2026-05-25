import { expect, test } from "./fixtures/auth";
import { DashboardPage } from "./pages/DashboardPage";

test.describe("Auth flow", () => {
  test("redirects unauthenticated users from /dashboard to /login", async ({
    page
  }) => {
    const dashboard = new DashboardPage(page);

    await dashboard.goto();
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows validation errors for empty submit", async ({ login }) => {
    await login.goto();
    await login.submit();
    await expect(login.errorAlerts()).toHaveCount(2);
  });

  test("shows error toast for bad credentials", async ({ page, login }) => {
    await login.goto();
    await login.loginAs("wrong@example.com", "wrongpassword");
    await expect(page.getByText(/incorrect/i)).toBeVisible({ timeout: 5_000 });
  });

  test("logs in successfully and lands on dashboard", async ({
    page,
    login,
    testUser
  }) => {
    await login.goto();
    await login.loginAs(testUser.email, testUser.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("Authenticated session", () => {
  test("logs out and returns to /login", async ({ page, authedPage }) => {
    await authedPage.dashboard.logout();
    await expect(page).toHaveURL(/\/login/);
  });

  test("dashboard heading is visible to authed users", async ({
    authedPage
  }) => {
    await expect(authedPage.dashboard.heading()).toBeVisible();
  });
});
