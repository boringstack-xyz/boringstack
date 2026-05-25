import { expect, test } from "./fixtures/auth";

test.describe("Deep-link preservation", () => {
  test("a user who hits /dashboard while logged out lands back on it after login", async ({
    page,
    login,
    testUser
  }) => {
    // Direct deep link to a protected route → redirect to /login keeps origin in state.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    await login.loginAs(testUser.email, testUser.password);

    // ProtectedRoute uses { state: { from } } so router pushes the user back.
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("protected redirects preserve query string and hash", async ({
    page,
    login,
    testUser
  }) => {
    await page.goto("/dashboard?tab=activity#recent");
    await expect(page).toHaveURL(/\/login/);

    await login.loginAs(testUser.email, testUser.password);

    await expect(page).toHaveURL(/\/dashboard\?tab=activity#recent/);
  });

  test("an unknown route renders the 404 page", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(
      page.getByRole("heading", { name: /page not found/i })
    ).toBeVisible();
  });

  test("the 'take me home' link on 404 returns to the login page", async ({
    page
  }) => {
    await page.goto("/this-route-does-not-exist");
    await page.getByRole("link", { name: /take me home/i }).click();
    await expect(page).toHaveURL("/");
  });
});
