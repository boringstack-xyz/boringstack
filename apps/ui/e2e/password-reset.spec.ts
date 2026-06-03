import { request } from "@playwright/test";
import { z } from "zod";

import { expect, test } from "./fixtures/auth";
import {
  E2E_API_BASE_URL,
  type ITestUser,
  registerAndVerify,
  uniqueEmail
} from "./fixtures/helpers";
import { parseBody } from "./fixtures/parse";

const ORIGINAL_PASSWORD = "OriginalPwd123!";
const NEW_PASSWORD = "BrandNewPwd456!";

async function fetchResetToken(email: string): Promise<string> {
  const ctx = await request.newContext({ baseURL: E2E_API_BASE_URL });
  const res = await ctx.post("/api/v1/auth/__test/issue-reset-token", {
    data: { email }
  });

  if (!res.ok()) {
    throw new Error(
      `issue-reset-token failed (${String(res.status())}): ${await res.text()}`
    );
  }

  const body = await parseBody(
    res,
    z.object({ data: z.object({ token: z.string().optional() }).optional() })
  );
  const token = body.data?.token;

  await ctx.dispose();

  if (typeof token !== "string" || token === "") {
    throw new Error("expected raw reset token in response");
  }

  return token;
}

test.describe("Password reset", () => {
  /*
   * Root cause was a Chromium cookie-commit lag under Playwright: the
   * login response sets the auth cookie but the browser sometimes
   * hasn't committed it by the time ProtectedRoute mounts and fires
   * GET /me. /me saw no cookie, returned `{user: null}`, the SPA
   * treated that as anonymous, and bounced back to /login.
   *
   * Closed by `features/auth/Auth.session.sync.ts`: every session-
   * establishing flow (login, MFA verify, email verify, OAuth
   * callback) now pre-fetches /me with short retries (5 × 30 ms)
   * BEFORE the consumer navigates. The cookie window closes inside
   * the retry budget and the post-navigation useMe is a cache hit.
   */
  test("user requests a reset, sets a new password via the link, signs in with it", async ({
    page
  }) => {
    const user: ITestUser = {
      email: uniqueEmail("reset-happy"),
      password: ORIGINAL_PASSWORD
    };

    await registerAndVerify(user, "Reset", "User");

    /*
     * The forgot-password screen always renders an enumeration-safe
     * "check your inbox" page regardless of whether the email is
     * registered, so we exercise the UI for parity but pull the real
     * token from the test endpoint right after.
     */
    await page.goto("/forgot-password");
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(
      page.getByRole("heading", { name: /check your email/i })
    ).toBeVisible();

    const token = await fetchResetToken(user.email);

    await page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
    await expect(
      page.getByRole("heading", { name: /reset password/i })
    ).toBeVisible();

    await page.getByLabel(/new password/i).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: /update password/i }).click();

    await expect(
      page.getByRole("heading", { name: /password updated/i })
    ).toBeVisible();

    /*
     * Sign in with the new password to prove the reset actually
     * landed against the user's authProvider row.
     */
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("a reset-link with an invalid token surfaces the invalid-token alert", async ({
    page
  }) => {
    await page.goto("/reset-password?token=not-a-real-token");
    await page.getByLabel(/new password/i).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: /update password/i }).click();

    /*
     * The API rejects with 400 "Invalid or expired reset token"; the
     * SPA mounts the resulting error in an alert. Match on the
     * inline message so we don't depend on whether the SPA also flips
     * the page to the dedicated invalid-token view.
     */
    await expect(page.getByRole("alert")).toBeVisible();
  });
});
