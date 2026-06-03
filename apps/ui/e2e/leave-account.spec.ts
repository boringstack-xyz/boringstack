import { type APIRequestContext, request } from "@playwright/test";
import { z } from "zod";

import { expect, test } from "./fixtures/auth";
import { parseBody } from "./fixtures/parse";

interface IUser {
  readonly email: string;
  readonly password: string;
}

const BASE_URL = "http://localhost:7331";
const PASSWORD = "E2EPassword123!";

function uniqueEmail(prefix: string): string {
  return `e2e-leave-${prefix}-${String(Date.now())}-${String(
    Math.floor(Math.random() * 1_000_000)
  )}@e2e.test`;
}

async function registerAndVerify(
  user: IUser,
  firstName: string,
  lastName: string
): Promise<void> {
  const ctx: APIRequestContext = await request.newContext({
    baseURL: BASE_URL
  });

  const registerRes = await ctx.post("/api/v1/auth/register", {
    data: {
      email: user.email,
      password: user.password,
      firstName,
      lastName
    }
  });

  if (!registerRes.ok()) {
    throw new Error(
      `register failed (${String(registerRes.status())}): ${await registerRes.text()}`
    );
  }

  const verifyRes = await ctx.post("/api/v1/auth/__test/force-verify", {
    data: { email: user.email }
  });

  if (!verifyRes.ok()) {
    throw new Error(
      `force-verify failed (${String(verifyRes.status())}): ${await verifyRes.text()}`
    );
  }

  await ctx.dispose();
}

async function authedContext(user: IUser): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const loginRes = await ctx.post("/api/v1/auth/login", {
    data: { email: user.email, password: user.password }
  });

  if (!loginRes.ok()) {
    throw new Error(
      `login failed (${String(loginRes.status())}): ${await loginRes.text()}`
    );
  }

  return ctx;
}

async function activeAccountId(ctx: APIRequestContext): Promise<string> {
  const meRes = await ctx.get("/api/v1/users/me");

  if (!meRes.ok()) {
    throw new Error(`/me failed (${String(meRes.status())})`);
  }

  const body = await parseBody(
    meRes,
    z.object({ account: z.object({ id: z.string() }) })
  );

  return body.account.id;
}

test.describe("Leave account", () => {
  test("a member can leave from the danger zone and lands on /login", async ({
    page
  }) => {
    const owner: IUser = { email: uniqueEmail("owner"), password: PASSWORD };
    const member: IUser = {
      email: uniqueEmail("member"),
      password: PASSWORD
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
    const ownerAccountId = await activeAccountId(ctxOwner);

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
