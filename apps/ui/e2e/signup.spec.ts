import { expect, test } from "./fixtures/auth";
import { SignUpPage } from "./pages/SignUpPage";

test.describe("Sign-up flow", () => {
  test("renders the form with email, password, and optional name fields", async ({
    page
  }) => {
    const signup = new SignUpPage(page);

    await signup.goto();
    await expect(signup.emailInput()).toBeVisible();
    await expect(signup.passwordInput()).toBeVisible();
    await expect(signup.firstNameInput()).toBeVisible();
    await expect(signup.lastNameInput()).toBeVisible();
    await expect(signup.submitButton()).toBeVisible();
  });

  test("shows validation errors for empty submission", async ({ page }) => {
    const signup = new SignUpPage(page);

    await signup.goto();
    await signup.submit();
    await expect(signup.errorAlerts()).toHaveCount(2);
  });

  test("shows validation error when password is too weak", async ({ page }) => {
    const signup = new SignUpPage(page);

    await signup.goto();
    await signup.fill({ email: "weak@example.com", password: "weak" });
    await signup.submit();
    await expect(signup.errorAlerts().first()).toBeVisible();
  });

  test("happy path: lands on the 'check your inbox' confirmation", async ({
    page
  }) => {
    const signup = new SignUpPage(page);
    const uniqueEmail = `e2e-signup-${String(Date.now())}-${String(Math.floor(Math.random() * 1_000_000))}@e2e.test`;

    await signup.goto();
    await signup.fill({
      email: uniqueEmail,
      // gitleaks:allow — synthetic test fixture, not a real credential
      password: "Strong-test-pass-1A",
      firstName: "Ada",
      lastName: "Lovelace"
    });
    await signup.submit();

    await expect(signup.checkEmailHeading()).toBeVisible();
    await expect(page.getByText(uniqueEmail)).toBeVisible();
  });

  test("the 'sign in' link returns to /login", async ({ page }) => {
    const signup = new SignUpPage(page);

    await signup.goto();
    await signup.signInLink().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page links to /signup", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /create one/i }).click();
    await expect(page).toHaveURL(/\/signup/);
  });
});
