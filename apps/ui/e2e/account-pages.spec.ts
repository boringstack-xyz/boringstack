import { expect, test } from "./fixtures/auth";

test.describe("Account · Settings", () => {
  test("renders settings with account rename and security controls", async ({
    page,
    authedPage
  }) => {
    await authedPage.dashboard.goto();
    await page.goto("/account/settings");

    await expect(
      page.getByRole("heading", { level: 1, name: /settings/i })
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 2, name: /account/i })
    ).toBeVisible();
    await expect(page.getByLabel(/workspace name/i)).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /security/i })
    ).toBeVisible();
    await expect(page.getByLabel(/current password/i)).toBeVisible();
    await expect(page.getByLabel(/new password/i)).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /danger zone/i })
    ).toBeVisible();
  });

  test("is reachable via the sidebar from /dashboard", async ({
    page,
    authedPage
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await authedPage.dashboard.goto();
    await page
      .getByTestId("app-sidebar")
      .first()
      .getByRole("link", { name: /settings/i })
      .click();
    await expect(page).toHaveURL(/\/account\/settings/);
  });
});

test.describe("Account · Profile", () => {
  test("renders editable profile inputs plus identity summary", async ({
    page,
    authedPage,
    testUser
  }) => {
    await authedPage.dashboard.goto();
    await page.goto("/account/profile");

    await expect(
      page.getByRole("heading", { level: 1, name: /profile/i })
    ).toBeVisible();

    /*
     * The e2e fixture registers with firstName="E2E" + lastName="User" → initials
     * read as "EU".
     */
    await expect(page.getByText("EU", { exact: true })).toBeVisible();
    await expect(page.getByText(testUser.email)).toBeVisible();
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/first name/i)).toBeEditable();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeEditable();
  });

  test("is reachable via the sidebar from /dashboard", async ({
    page,
    authedPage
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await authedPage.dashboard.goto();
    await page
      .getByTestId("app-sidebar")
      .first()
      .getByRole("link", { name: /profile/i })
      .click();
    await expect(page).toHaveURL(/\/account\/profile/);
  });
});
