import type { Page } from "@playwright/test";

export class DashboardPage {
  public constructor(public readonly page: Page) {}

  public async goto(): Promise<void> {
    await this.page.goto("/dashboard");
  }

  public heading() {
    return this.page.getByRole("heading", { level: 1 });
  }

  public logoutButton() {
    return this.page.getByRole("button", { name: /sign out/i });
  }

  public async logout(): Promise<void> {
    await this.logoutButton().click();
  }
}
