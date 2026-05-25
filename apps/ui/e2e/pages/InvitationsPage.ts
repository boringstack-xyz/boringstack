import type { Page } from "@playwright/test";

export class InvitationsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/account/invitations");
  }

  emailInput() {
    return this.page.getByLabel(/email/i);
  }

  roleSelect() {
    return this.page.locator("select#invite-role");
  }

  submitButton() {
    return this.page.getByTestId("invite-submit");
  }

  formError() {
    return this.page.getByTestId("invite-form-error");
  }

  rows() {
    return this.page.getByTestId("invitation-row");
  }
}
