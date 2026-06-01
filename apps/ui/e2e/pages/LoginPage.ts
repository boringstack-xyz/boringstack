import type { Page } from "@playwright/test";

/**
 * Page object for the login page. Encapsulates the selectors and primary
 * actions so specs read at the user-intent level, not the DOM level.
 */
export class LoginPage {
  public constructor(public readonly page: Page) {}

  public async goto(): Promise<void> {
    await this.page.goto("/login");
  }

  public emailInput() {
    return this.page.getByLabel(/email/i);
  }

  public passwordInput() {
    return this.page.getByLabel(/password/i);
  }

  public submitButton() {
    return this.page.getByRole("button", { name: /sign in/i });
  }

  public async fill(email: string, password: string): Promise<void> {
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
  }

  public async submit(): Promise<void> {
    await this.submitButton().click();
  }

  public async loginAs(email: string, password: string): Promise<void> {
    await this.fill(email, password);
    await this.submit();
  }

  public errorAlerts() {
    return this.page.getByRole("alert");
  }
}
