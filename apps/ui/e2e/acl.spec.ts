import { expect, test } from "./fixtures/auth";
import { InvitationsPage } from "./pages/InvitationsPage";

test.describe("ACL — multi-tenant golden paths", () => {
  test("solo signup hides the AccountSwitcher (one membership)", async ({
    authedPage,
    page
  }) => {
    /*
     * The AccountSwitcher only renders when memberships.length > 1.
     * A fresh signup creates exactly one personal-account membership,
     * so the trigger should be absent.
     */
    await authedPage.dashboard.goto();
    await expect(page.getByTestId("account-switcher-trigger")).toHaveCount(0);
  });

  test("/account/invitations is gated by ProtectedRoute", async ({ page }) => {
    /*
     * Unauthenticated visit should bounce to /login (same gate that
     * protects /dashboard). Establishes that the new route is wired
     * through `<ProtectedRoute>` not exposed to anonymous traffic.
     */
    await page.goto("/account/invitations");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/account/invitations renders the page heading for an authenticated owner", async ({
    authedPage,
    page
  }) => {
    /*
     * Proves: routing wired, AppShell wraps, /me resolves, page mounts.
     * The invite form itself is feature-gated (can_invite_team) and the
     * Free-plan default disables that gate, so we don't assert the
     * form is visible here — that's the next test's job.
     */
    const invitations = new InvitationsPage(page);

    await invitations.goto();
    await expect(page).toHaveURL(/\/account\/invitations/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(authedPage.dashboard).toBeDefined();
  });

  test("invite form is gated by the can_invite_team feature (hidden on Free plan)", async ({
    authedPage,
    page
  }) => {
    /*
     * Proves the <Can I="invite" a="TeamMember"> gate actually denies
     * when the feature is off. Free plan default is `can_invite_team:
     * false`, so a freshly-registered owner should NOT see the submit
     * button. If you set the feature to `true` by default in
     * apps/api/src/lib/acl/acl.constants.ts FEATURES, this test
     * flips and `e2e/acl.spec.ts:78` becomes the one to update.
     */
    const invitations = new InvitationsPage(page);

    await invitations.goto();
    await expect(invitations.submitButton()).toHaveCount(0);
    expect(authedPage.dashboard).toBeDefined();
  });

  test("empty state renders when no invitations are pending", async ({
    authedPage,
    page
  }) => {
    const invitations = new InvitationsPage(page);

    await invitations.goto();
    await expect(invitations.rows()).toHaveCount(0);
    expect(authedPage.dashboard).toBeDefined();
  });
});
