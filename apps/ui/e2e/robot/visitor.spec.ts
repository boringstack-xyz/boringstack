import {
  expect,
  expectHealthy,
  test,
  visit,
  watchHealth
} from "./fixtures/robot";

/*
 * What anyone can do without an account. Each journey ends by checking that
 * the pages it opened threw no script errors and got no server errors.
 */
test.describe("Visitor", () => {
  test("the app opens on sign-in, and the cookie banner can be declined", async ({
    page
  }) => {
    const health = watchHealth(page);

    await visit(page, "/");
    await expect(page.getByLabel(/email/iu)).toBeVisible();

    const banner = page.getByRole("region", { name: /cookie consent/iu });

    await expect(banner).toBeVisible();
    await banner
      .getByRole("button", { name: /reject non-essential/iu })
      .click();
    await expect(banner).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel(/email/iu)).toBeVisible();
    await expect(banner).toHaveCount(0);
    expectHealthy(health);
  });

  test("log in refuses an unknown account with a message", async ({ page }) => {
    const health = watchHealth(page);

    await visit(page, "/login");
    await page.getByLabel(/email/iu).fill("nobody@example.com");
    await page.getByLabel(/password/iu).fill("Not-the-password-1");
    await page.getByRole("button", { name: /^sign in$/iu }).click();
    await expect(page.getByText(/incorrect/iu)).toBeVisible();
    expectHealthy(health);
  });

  test("sign up and forgot password pages open and validate", async ({
    page
  }) => {
    const health = watchHealth(page);

    await visit(page, "/signup");
    await page.getByRole("button", { name: /create account/iu }).click();
    await expect(page).toHaveURL(/\/signup/u);
    await visit(page, "/forgot-password");
    await expect(page.getByLabel(/email/iu)).toBeVisible();
    expectHealthy(health);
  });

  test("links that arrive without their token say what is missing", async ({
    page
  }) => {
    const health = watchHealth(page);

    for (const path of ["/verify-email", "/reset-password"]) {
      await visit(page, path);
      await expect(
        page.getByText(/missing|invalid|expired/iu).first(),
        `${path} explains the missing token`
      ).toBeVisible();
    }

    expectHealthy(health);
  });

  test("a members-only page sends a visitor to log in", async ({ page }) => {
    const health = watchHealth(page);

    for (const path of [
      "/account/billing",
      "/invitations/accept",
      "/account/ownership-transfer/accept"
    ]) {
      await visit(page, path);
      await expect(page, `${path} asks a visitor to sign in`).toHaveURL(
        /\/login/u
      );
    }

    expectHealthy(health);
  });

  test("an address that does not exist says so and leads home", async ({
    page
  }) => {
    const health = watchHealth(page);

    await visit(page, "/this-page-does-not-exist");
    await expect(
      page.getByRole("heading", { name: /page not found/iu })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /take me home/iu })
    ).toBeVisible();
    expectHealthy(health);
  });
});
