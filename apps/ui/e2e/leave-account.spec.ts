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

test.describe("Leave account", () => {
  test("a member can leave from the danger zone and lands on /login", async ({
    page
  }) => {
    const owner: ITestUser = {
      email: uniqueEmail("leave-owner"),
      password: E2E_PASSWORD
    };
    const member: ITestUser = {
      email: uniqueEmail("leave-member"),
      password: E2E_PASSWORD
    };

    await registerAndVerify(owner, "Owner", "User");
    await registerAndVerify(member, "Member", "User");

    /*
     * Invite member into owner's account so member holds memberships
     * on both their personal account and the owner's account. After
     * leaving the owner's account, member still has the personal
     * account to fall back to.
     */
    const ctxOwner = await authedContext(owner);
    const ownerAccountId = await fetchActiveAccountId(ctxOwner);

    const inviteRes = await ctxOwner.post(
      `/api/v1/accounts/${ownerAccountId}/invitations`,
      {
        data: { email: member.email, roleToAssign: "member" }
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
    await ctxOwner.dispose();

    const ctxMember = await authedContext(member);
    const acceptRes = await ctxMember.post("/api/v1/invitations/accept", {
      data: { token: rawToken }
    });

    if (!acceptRes.ok()) {
      throw new Error(
        `accept failed (${String(acceptRes.status())}): ${await acceptRes.text()}`
      );
    }

    await ctxMember.dispose();

    /*
     * Browser login lands on the user's default (personal) account,
     * where they're owner. Use the UI switcher to pick the invited
     * account so the danger zone resolves to "Leave" instead of
     * "Delete".
     */
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(member.email);
    await page.getByLabel(/password/i).fill(member.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);

    const switcherTrigger = page.getByTestId("account-switcher-trigger");

    await expect(switcherTrigger).toBeVisible();
    await switcherTrigger.click();

    const ownerItem = page
      .getByTestId("account-switcher-item")
      .filter({ hasText: /Owner User/i })
      .first();

    await ownerItem.click();

    /*
     * After the account swap the SPA refetches /me; wait for the
     * trigger label to flip before navigating away.
     */
    await expect(switcherTrigger).toHaveText(/Owner User/i);

    await page.goto("/account/settings");

    const leaveButton = page.getByRole("button", { name: /leave account/i });

    await expect(leaveButton).toBeVisible();
    await leaveButton.click();

    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });
});
