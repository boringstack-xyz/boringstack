import { expect, test } from "./fixtures/auth";

/**
 * OAuth flow E2E — server-side flow.
 *
 * The API owns the full OAuth dance (PKCE, IdP exchange, cookie). The SPA's
 * only responsibility is to redirect the browser to `/api/v1/auth/oauth/{provider}`
 * when the user clicks the button, and to land them on `/oauth/success`
 * (where the cookie is already set) or surface an `?error=` returned by the
 * API on the same path.
 *
 * Playwright can't go all the way to a real IdP, so we assert the SPA's
 * behavior up to the API redirect.
 */

test.describe("OAuth flow", () => {
  test("Google button navigates to /api/v1/auth/oauth/google", async ({
    page,
    login
  }) => {
    await login.goto();

    /*
     * Intercept the API redirect — the SPA does window.location.assign, so
     * Playwright sees a top-level navigation. We block it from following
     * through to the (unreachable in test) IdP.
     */
    await page.route("**/api/v1/auth/oauth/google", (route) => {
      void route.fulfill({ status: 204, body: "" });
    });

    await page.getByRole("button", { name: /continue with google/i }).click();
    await page.waitForURL(/\/api\/v1\/auth\/oauth\/google/);

    expect(page.url()).toContain("/api/v1/auth/oauth/google");
  });

  test("GitHub button navigates to /api/v1/auth/oauth/github", async ({
    page,
    login
  }) => {
    await login.goto();

    await page.route("**/api/v1/auth/oauth/github", (route) => {
      void route.fulfill({ status: 204, body: "" });
    });

    await page.getByRole("button", { name: /continue with github/i }).click();
    await page.waitForURL(/\/api\/v1\/auth\/oauth\/github/);

    expect(page.url()).toContain("/api/v1/auth/oauth/github");
  });

  test("LinkedIn button navigates to /api/v1/auth/oauth/linkedin", async ({
    page,
    login
  }) => {
    await login.goto();

    await page.route("**/api/v1/auth/oauth/linkedin", (route) => {
      void route.fulfill({ status: 204, body: "" });
    });

    await page.getByRole("button", { name: /continue with linkedin/i }).click();
    await page.waitForURL(/\/api\/v1\/auth\/oauth\/linkedin/);

    expect(page.url()).toContain("/api/v1/auth/oauth/linkedin");
  });

  test("success page surfaces a friendly OAuth error message", async ({
    page
  }) => {
    await page.goto("/oauth/success?error=access_denied");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(
      page.getByText(/cancelled sign in or denied access/i)
    ).toBeVisible();
  });
});
