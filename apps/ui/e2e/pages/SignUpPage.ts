import type { Page } from "@playwright/test";

/**
 * Page object for /signup. The full flow goes:
 *
 *   1. Submit the form → server creates a pending user + sends verify email.
 *   2. Component swaps to a "check your inbox" view inline (no separate route).
 *   3. User clicks the email link → /verify-email?token=... → session cookies
 *      land + redirect to /dashboard. That last step is exercised by the
 *      verify-email.spec, not here.
 */
export class SignUpPage {
  public constructor(public readonly page: Page) {}

  public async goto(): Promise<void> {
    await this.page.goto("/signup");
  }

  public emailInput() {
    return this.page.getByLabel(/email/i);
  }

  public passwordInput() {
    return this.page.getByLabel(/password/i);
  }

  public firstNameInput() {
    return this.page.getByLabel(/first name/i);
  }

  public lastNameInput() {
    return this.page.getByLabel(/last name/i);
  }

  public submitButton() {
    return this.page.getByRole("button", { name: /create account/i });
  }

  public async fill(input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<void> {
    await this.emailInput().fill(input.email);
    await this.passwordInput().fill(input.password);

    if (input.firstName !== undefined) {
      await this.firstNameInput().fill(input.firstName);
    }

    if (input.lastName !== undefined) {
      await this.lastNameInput().fill(input.lastName);
    }
  }

  public async submit(): Promise<void> {
    await this.submitButton().click();
  }

  public errorAlerts() {
    return this.page.getByRole("alert");
  }

  public checkEmailHeading() {
    return this.page.getByRole("heading", { name: /check your email/i });
  }

  public signInLink() {
    return this.page.getByRole("link", { name: /sign in/i });
  }
}
