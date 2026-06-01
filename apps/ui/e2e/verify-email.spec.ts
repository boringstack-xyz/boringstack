import { type APIRequestContext, request } from "@playwright/test";

import { expect, test } from "./fixtures/auth";
import { LoginPage } from "./pages/LoginPage";

const BASE_URL = "http://localhost:7331";

interface IPendingUser {
  readonly email: string;
  readonly password: string;
}

/*
 * Registers a user but stops short of verifying them — the API's new
 * verify-before-account contract leaves the user pending, unable to
 * log in, and the UI should expose a resend prompt. Returns the
 * credentials so the test can drive the LoginPage.
 */
async function registerPendingUser(
  ctx: APIRequestContext,
  workerIndex: number
): Promise<IPendingUser> {
  const user: IPendingUser = {
    email: `pending-${String(workerIndex)}-${String(Date.now())}-${String(Math.floor(Math.random() * 1_000_000))}@e2e.test`,
    password: "PendingTest1!"
  };

  const res = await ctx.post("/api/v1/auth/register", {
    data: {
      email: user.email,
      password: user.password,
      firstName: "Pending",
      lastName: "User"
    }
  });

  if (!res.ok()) {
    const body = await res.text();

    throw new Error(
      `Failed to register pending e2e user (HTTP ${String(res.status())}): ${body}`
    );
  }

  return user;
}

test.describe("Verify-before-account UX", () => {
  test("login with a still-pending user surfaces the verification prompt + resend CTA", async ({
    page
  }, testInfo) => {
    const ctx = await request.newContext({ baseURL: BASE_URL });

    try {
      const pending = await registerPendingUser(ctx, testInfo.workerIndex);
      const login = new LoginPage(page);

      await login.goto();
      await login.loginAs(pending.email, pending.password);

      /*
       * Toast wording is pinned in the en catalog: "Your email isn't
       * verified yet." Matching the substring keeps the assertion
       * resilient to copy tweaks.
       */
      await expect(page.getByText(/email isn't verified/i)).toBeVisible();

      await expect(
        page.getByRole("button", { name: /resend verification email/i })
      ).toBeVisible();
    } finally {
      await ctx.dispose();
    }
  });

  test("/verify-email with no ?token= renders the missing-token alert", async ({
    page
  }) => {
    await page.goto(`${BASE_URL}/verify-email`);
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText(/missing its token/i)).toBeVisible();
  });

  test("/verify-email with an invalid token renders the invalid-token alert", async ({
    page
  }) => {
    await page.goto(`${BASE_URL}/verify-email?token=${"0".repeat(48)}`);
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText(/invalid or expired/i)).toBeVisible();
  });
});
