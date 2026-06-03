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
  return `e2e-switch-${prefix}-${String(Date.now())}-${String(
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

async function getActiveAccountId(ctx: APIRequestContext): Promise<string> {
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
    const userA: IUser = { email: uniqueEmail("a"), password: PASSWORD };
    const userB: IUser = { email: uniqueEmail("b"), password: PASSWORD };

    /*
     * Distinct first/last names per user so the personal account
     * names (which derive from "FirstName LastName") differ — that
     * lets us locate the non-active row in the switcher by label.
     */
    await registerAndVerify(userA, "Alpha", "Owner");
    await registerAndVerify(userB, "Bravo", "Owner");

    const ctxA = await authedContext(userA);
    const accountA = await getActiveAccountId(ctxA);

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
