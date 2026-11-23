import { randomUUID } from "node:crypto";

import { DashboardPage } from "../pages/DashboardPage";
import { SignUpPage } from "../pages/SignUpPage";
import { walkConfig } from "./walk.config";
import { expect, test } from "./walk.fixture";

/* `factory walk` sets FACTORY_BASE_URL to the stack being walked. */
test.use({ baseURL: walkConfig.baseURL });

test("a new person signs up and reaches the dashboard", async ({
  page,
  walk
}) => {
  const signup = new SignUpPage(page);
  const dashboard = new DashboardPage(page);
  // A reserved address: no mail can reach it, so the step below verifies it.
  const email = `walk-${randomUUID()}@robot.boringstack.invalid`;

  await walk.step("Open the sign-up page", async () => {
    await signup.goto();
    await expect(signup.emailInput()).toBeVisible();
  });

  await walk.step("Fill in the sign-up form", async () => {
    await signup.fill({
      email,
      // gitleaks:allow: synthetic test fixture, not a real credential
      password: "Strong-test-pass-1A",
      firstName: "Ada",
      lastName: "Lovelace"
    });
  });

  await walk.step(
    "Send the form and see the check-your-inbox message",
    async () => {
      await signup.submit();
      await expect(signup.checkEmailHeading()).toBeVisible();
    }
  );

  await walk.step("Verify the address, since no mail reaches it", async () => {
    const response = await page.request.post(
      "/api/v1/auth/__test/force-verify",
      {
        data: { email }
      }
    );

    expect(response.ok()).toBeTruthy();
  });

  await walk.step("Land on the dashboard", async () => {
    await dashboard.goto();
    await expect(dashboard.heading()).toBeVisible();
  });
});
