import { type APIRequestContext, request } from "@playwright/test";
import { Secret, TOTP } from "otpauth";

import { nowMs } from "@/lib/time/now";

import { expect, test } from "./fixtures/auth";
import { LoginPage } from "./pages/LoginPage";

const API_BASE_URL = "http://localhost:7331";
const TOTP_STEP_MS = 30_000;

interface IMfaTestUser {
  readonly email: string;
  readonly password: string;
}

interface IEnrolledMfa {
  readonly secretBase32: string;
  readonly recoveryCodes: string[];
}

/**
 * Provisions a fresh verified user and enrols them in MFA via the API
 * (`/auth/mfa/setup` + `/auth/mfa/verify-setup`). Returns the secret +
 * recovery codes so the test can drive live TOTP codes against the UI.
 */
const provisionEnrolledUser = async (): Promise<{
  user: IMfaTestUser;
  mfa: IEnrolledMfa;
}> => {
  const ctx: APIRequestContext = await request.newContext({
    baseURL: API_BASE_URL
  });
  const email = `e2e-mfa-${String(Date.now())}-${String(Math.floor(Math.random() * 1_000_000))}@e2e.test`;
  const password = "E2EPassword123!";

  const registerRes = await ctx.post("/api/v1/auth/register", {
    data: { email, password, firstName: "Mfa", lastName: "Tester" }
  });

  if (!registerRes.ok()) {
    throw new Error(`register failed: ${await registerRes.text()}`);
  }

  const verifyRes = await ctx.post("/api/v1/auth/__test/force-verify", {
    data: { email }
  });

  if (!verifyRes.ok()) {
    throw new Error(`force-verify failed: ${await verifyRes.text()}`);
  }

  /*
   * force-verify also issues session cookies on the same context, so the
   * subsequent setup/verify-setup calls authenticate automatically.
   */
  const setupRes = await ctx.post("/api/v1/auth/mfa/setup", {
    data: { password }
  });

  if (!setupRes.ok()) {
    throw new Error(`mfa setup failed: ${await setupRes.text()}`);
  }

  const setupBody = (await setupRes.json()) as {
    data: { secretBase32: string; recoveryCodes: string[] };
  };
  const totp = new TOTP({
    issuer: "test",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(setupBody.data.secretBase32)
  });

  /*
   * Enrol with the PREVIOUS step's code on purpose. The API accepts a
   * ±1-step window and records the matched step as the replay
   * watermark — submitting the previous step parks the watermark one
   * step behind, so the test's first verify-login with a current-step
   * code is strictly greater and passes the replay guard immediately.
   * (The alternative — sleeping to the next 30s boundary — added up to
   * 30s per run and flaked under CI load.)
   */
  const verifySetupRes = await ctx.post("/api/v1/auth/mfa/verify-setup", {
    data: { code: totp.generate({ timestamp: nowMs() - TOTP_STEP_MS }) }
  });

  if (!verifySetupRes.ok()) {
    throw new Error(`mfa verify-setup failed: ${await verifySetupRes.text()}`);
  }

  await ctx.post("/api/v1/auth/logout");
  await ctx.dispose();

  return {
    user: { email, password },
    mfa: {
      secretBase32: setupBody.data.secretBase32,
      recoveryCodes: setupBody.data.recoveryCodes
    }
  };
};

const generateLiveTotp = (secretBase32: string): string =>
  new TOTP({
    issuer: "test",
    label: "test",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32)
  }).generate();

test.describe("MFA login flow", () => {
  test("password + TOTP completes the sign-in", async ({ page }) => {
    const { user, mfa } = await provisionEnrolledUser();
    const login = new LoginPage(page);

    await login.goto();
    await login.fill(user.email, user.password);
    await login.submit();

    /*
     * The MFA challenge form replaces the credentials form once /login
     * returns mfaRequired:true. The TOTP code input carries this testid.
     */
    const codeInput = page.getByTestId("mfa-login-code");

    await expect(codeInput).toBeVisible();
    await codeInput.fill(generateLiveTotp(mfa.secretBase32));
    await page.getByTestId("mfa-login-submit").click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("a recovery code completes the sign-in", async ({ page }) => {
    const { user, mfa } = await provisionEnrolledUser();
    const recoveryCode = mfa.recoveryCodes[0];

    if (recoveryCode === undefined) {
      throw new Error("recovery codes not returned");
    }

    const login = new LoginPage(page);

    await login.goto();
    await login.fill(user.email, user.password);
    await login.submit();

    const codeInput = page.getByTestId("mfa-login-code");

    await expect(codeInput).toBeVisible();

    // Toggle to recovery mode via the link button at the bottom.
    await page
      .getByRole("button", { name: /recovery code/i })
      .first()
      .click();

    await codeInput.fill(recoveryCode);
    await page.getByTestId("mfa-login-submit").click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("an invalid TOTP code keeps the user on the challenge form", async ({
    page
  }) => {
    const { user } = await provisionEnrolledUser();
    const login = new LoginPage(page);

    await login.goto();
    await login.fill(user.email, user.password);
    await login.submit();

    const codeInput = page.getByTestId("mfa-login-code");

    await expect(codeInput).toBeVisible();
    await codeInput.fill("000000");
    await page.getByTestId("mfa-login-submit").click();

    await expect(codeInput).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});
