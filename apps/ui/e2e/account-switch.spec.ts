import { z } from "zod";

import { expect, test } from "./fixtures/auth";
import {
  E2E_PASSWORD,
  type ITestUser,
  authedContext,
  fetchActiveAccountId,
  registerAndVerify,
  uniqueEmail
} from "./fixtures/helpers";
import { parseBody } from "./fixtures/parse";

test.describe("Account switcher", () => {
  test("a member with two memberships can switch the active account", async ({
    page
  }) => {
    /*
     * Two real users, each with their own personal account, then user
     * A invites user B → B holds memberships on both accounts. We
     * drive the API directly for setup so the test stays focused on
     * the switcher UI.
     */
    const userA: ITestUser = {
      email: uniqueEmail("switch-a"),
      password: E2E_PASSWORD
    };
    const userB: ITestUser = {
      email: uniqueEmail("switch-b"),
      password: E2E_PASSWORD
    };

    /*
     * Distinct first/last names per user so the personal account
     * names (which derive from "FirstName LastName") differ — that
     * lets us locate the non-active row in the switcher by label.
     */
    await registerAndVerify(userA, "Alpha", "Owner");
    await registerAndVerify(userB, "Bravo", "Owner");

    const ctxA = await authedContext(userA);
    const accountA = await fetchActiveAccountId(ctxA);

    const inviteRes = await ctxA.post(
      `/api/v1/accounts/${accountA}/invitations`,
      {
        data: { email: userB.email, roleToAssign: "member" }
      }
    );

    if (!inviteRes.ok()) {
      throw new Error(
        `invite failed (${String(inviteRes.status())}): ${await inviteRes.text()}`
      );
    }

    const inviteBody = await parseBody(
      inviteRes,
      z.object({ rawToken: z.string().optional() })
    );
    const rawToken = inviteBody.rawToken;

    expect(rawToken, "API should expose rawToken in non-prod").toBeTruthy();
    await ctxA.dispose();

    const ctxB = await authedContext(userB);
    const acceptRes = await ctxB.post("/api/v1/invitations/accept", {
      data: { token: rawToken }
    });

    if (!acceptRes.ok()) {
      throw new Error(
        `accept failed (${String(acceptRes.status())}): ${await acceptRes.text()}`
      );
    }

    await ctxB.dispose();

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(userB.email);
    await page.getByLabel(/password/i).fill(userB.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);

    const trigger = page.getByTestId("account-switcher-trigger");

    await expect(trigger).toBeVisible();

    /*
     * Capture the active account label before switching so we can
     * assert the trigger label changes after click — independent of
     * which order the SPA renders the memberships in.
     */
    const labelBefore = (await trigger.textContent())?.trim() ?? "";

    await trigger.click();

    const items = page.getByTestId("account-switcher-item");

    await expect(items).toHaveCount(2);

    /*
     * Click whichever item is NOT the current one. The dropdown items
     * surface role copy; matching on the non-active label is more
     * stable than depending on account name ordering.
     */
    const otherItem = items.filter({ hasNotText: labelBefore }).first();

    await otherItem.click();

    await expect
      .poll(async () => (await trigger.textContent())?.trim() ?? "", {
        message: "trigger label should reflect the newly active account"
      })
      .not.toBe(labelBefore);
  });
});
