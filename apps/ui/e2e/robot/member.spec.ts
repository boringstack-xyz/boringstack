import type { BrowserContext, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Secret, TOTP } from "otpauth";

import { paceContext, requestsMade, takeTurn } from "./fixtures/pace";
import {
  type IPageHealth,
  type IRobotUser,
  ROBOT_EMAIL_DOMAIN,
  dismissInterruptions,
  expect,
  expectHealthy,
  newRobotUser,
  removeRobotUser,
  test,
  upgradeRobot,
  verifyRobotEmail,
  visit,
  watchHealth
} from "./fixtures/robot";
import { robotConfig } from "./robot.config";

/*
 * One new member, from the sign-up form to its own removal: the robot signs
 * up as a person would, uses every page a free account reaches, moves its
 * own account to Pro to reach what a paying member uses, and is removed at
 * the end. The journeys share that one account and run in order.
 *
 * Product journeys go here too: every route in src/app/router/routes.tsx
 * names the journey that opens it in e2e/robot/coverage.ts.
 */
const TOTP_STEP_MS = 30_000;

const totpCode = (secretBase32: string, offsetMs = 0): string =>
  new TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32)
  }).generate({ timestamp: Date.now() + offsetMs });

test.describe.configure({ mode: "serial" });

test.describe("Member", () => {
  /* TODO(@boringstack/maintainers): not debt, a setting: runs wherever SYNTHETIC_CHECK_SECRET is set (docs/operations/production-verification.md). */
  test.skip(
    robotConfig.secret === undefined,
    "SYNTHETIC_CHECK_SECRET is not set, so the robot cannot verify its sign-up"
  );

  let context: BrowserContext;
  let page: Page;
  let health: IPageHealth;
  let user: IRobotUser;
  let password = "";

  const logIn = async (): Promise<void> => {
    await visit(page, "/login");
    await page.getByLabel(/email/iu).fill(user.email);
    await page.getByLabel(/password/iu).fill(password);
    await page.getByRole("button", { name: /^sign in$/iu }).click();
  };

  test.beforeAll(async ({ browser }) => {
    user = newRobotUser();
    password = user.password;
    context = await browser.newContext();
    await paceContext(context);
    page = await context.newPage();
    health = watchHealth(page);
    await dismissInterruptions(page);
  });

  test.afterEach(() => {
    expectHealthy(health);
  });

  test.afterAll(async () => {
    await context.close();
    await removeRobotUser(user);

    const made = requestsMade();

    console.log(
      `robot: ${String(made.api)} API requests, ${String(made.signIn)} to sign-in routes`
    );
  });

  test("signs up through the form and is told to check email", async () => {
    await visit(page, "/signup");
    await page.getByLabel(/email/iu).fill(user.email);
    await page.getByLabel(/password/iu).fill(password);
    await page.getByLabel(/first name/iu).fill(user.firstName);
    await page.getByLabel(/last name/iu).fill(user.lastName);
    await page.getByRole("button", { name: /create account/iu }).click();
    await expect(
      page.getByRole("heading", { name: /check your email/iu })
    ).toBeVisible();
    await expect(page.getByText(user.email)).toBeVisible();
  });

  test("cannot log in before the email is verified", async () => {
    await logIn();
    await expect(page.getByText(/email isn't verified/iu)).toBeVisible();
    await page
      .getByRole("button", { name: /resend verification email/iu })
      .click();
    await expect(
      page.getByText(/fresh verification link is on the way/iu)
    ).toBeVisible();
  });

  test("logs in after verifying and lands on the dashboard", async () => {
    await verifyRobotEmail(user);
    await logIn();
    await expect(page).toHaveURL(/\/dashboard/u);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  /*
   * The app sends these only with analytics consent, and the robot declines
   * cookies, so the calls are made through the signed-in session directly.
   * The consent gate itself is covered by the UI unit tests.
   */
  test("answers the one-question prompt and sends a product event", async () => {
    await visit(page, "/dashboard");

    await takeTurn("POST", "/api/v1/product-events/");
    const event = await page.request.post("/api/v1/product-events/", {
      data: { kind: "feedback_given", context: "" }
    });

    await takeTurn("PUT", "/api/v1/feedback/onboarded");
    const answer = await page.request.put("/api/v1/feedback/onboarded", {
      data: { answer: "", dismissed: true }
    });

    expect([event.status(), answer.status()]).toEqual([204, 204]);
  });

  test("renames itself on the profile page and the name sticks", async () => {
    await visit(page, "/account/profile");

    const first = page.getByLabel(/first name/iu);

    await first.fill("Robot");
    await page.getByRole("button", { name: /save changes/iu }).click();
    await expect(page.getByText(/profile updated/iu)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/first name/iu)).toHaveValue("Robot");
  });

  test("renames the workspace in settings", async () => {
    await visit(page, "/account/settings");
    await page.getByLabel(/workspace name/iu).fill("Robot workspace");
    await page.getByRole("button", { name: /save name/iu }).click();
    await expect(page.getByText(/workspace renamed/iu)).toBeVisible();
  });

  test("opens notifications and their preferences", async () => {
    await visit(page, "/notifications");
    await expect(
      page.getByRole("heading", { level: 1, name: /notifications/iu })
    ).toBeVisible();
    await visit(page, "/notifications/preferences");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /notification preferences/iu
      })
    ).toBeVisible();
  });

  test("opens the audit log and the join requests as the owner", async () => {
    await visit(page, "/account/audit-log");
    await expect(
      page.getByRole("heading", { level: 1, name: /audit log/iu })
    ).toBeVisible();
    await visit(page, "/account/requests");
    await expect(
      page.getByRole("heading", { level: 1, name: /join requests/iu })
    ).toBeVisible();
  });

  test("opens billing on the free plan", async () => {
    await visit(page, "/account/billing");
    await expect(
      page.getByRole("heading", { level: 1, name: /billing/iu })
    ).toBeVisible();
  });

  test("is offered checkout on billing, and Stripe opens", async () => {
    /* TODO(@boringstack/maintainers): not debt, a setting: only production has a real Stripe to open. */
    test.skip(
      !robotConfig.liveServices,
      "ROBOT_LIVE_SERVICES is not true: no real Stripe here"
    );

    await visit(page, "/account/billing");
    await page
      .getByRole("button", { name: /^upgrade$/iu })
      .first()
      .click();
    await expect(page).toHaveURL(/checkout\.stripe\.com/u, { timeout: 30_000 });
    await visit(page, "/account/billing");
  });

  test("cannot invite a teammate on the free plan", async () => {
    await visit(page, "/account/invitations");
    await expect(page.getByText(/gated by the/iu)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send invitation/iu })
    ).toHaveCount(0);
  });

  test("on Pro, the invite form opens", async () => {
    await upgradeRobot(user);
    await visit(page, "/account/invitations");
    /* No invitation is sent: it would email a real address. */
    await expect(
      page.getByRole("button", { name: /send invitation/iu })
    ).toBeVisible();
  });

  test("invites a robot teammate, resends the invitation and revokes it", async () => {
    /* The invitee is another robot address, so no mail leaves the system. */
    const invitee = `invitee-${randomUUID()}@${ROBOT_EMAIL_DOMAIN}`;

    await visit(page, "/account/invitations");
    await page.getByLabel(/^email$/iu).fill(invitee);
    await page.getByRole("button", { name: /send invitation/iu }).click();

    const row = page.getByRole("row").filter({ hasText: invitee });

    await expect(row).toBeVisible();
    await row.getByRole("button", { name: /^resend$/iu }).click();
    await row.getByRole("button", { name: /^revoke$/iu }).click();
    await expect(row).toHaveCount(0);
  });

  test("changes its password in settings", async () => {
    const next = `${password}-next`;

    await visit(page, "/account/settings");
    await page.getByLabel(/current password/iu).fill(password);
    await page.getByLabel(/new password/iu).fill(next);
    await page.getByRole("button", { name: /^change password$/iu }).click();
    await expect(page.getByText(/password changed/iu)).toBeVisible();
    password = next;
  });

  test("logs back in with the new password and signs out", async () => {
    await logIn();
    await expect(page).toHaveURL(/\/dashboard/u);
    await page
      .getByRole("button", { name: /sign out/iu })
      .first()
      .click();
    await expect(page).toHaveURL(/\/(login)?$/u);
  });

  test("turns on two-factor sign-in, signs in with a code, and turns it off", async () => {
    await logIn();
    await expect(page).toHaveURL(/\/dashboard/u);
    await visit(page, "/account/settings");
    await page.getByLabel(/confirm your password to start/iu).fill(password);
    await page.getByTestId("mfa-enroll-start").click();

    const secret = (await page.getByTestId("mfa-secret").textContent()) ?? "";

    /*
     * Enrol with the previous step's code: the API records the matched step
     * as its replay watermark, so the sign-in below with the current step's
     * code is accepted without waiting for the next 30 seconds.
     */
    await page
      .getByTestId("mfa-verify-input")
      .fill(totpCode(secret, -TOTP_STEP_MS));
    await page.getByTestId("mfa-verify-submit").click();
    await expect(page.getByText(/two-factor is active/iu)).toBeVisible();

    await page
      .getByLabel(/confirm your password to regenerate codes/iu)
      .fill(password);
    await page
      .getByRole("button", { name: /regenerate recovery codes/iu })
      .click();
    await expect(page.getByText(/recovery codes regenerated/iu)).toBeVisible();

    await page
      .getByRole("button", { name: /sign out/iu })
      .first()
      .click();
    await logIn();
    await page.getByTestId("mfa-login-code").fill(totpCode(secret));
    await page.getByTestId("mfa-login-submit").click();
    await expect(page).toHaveURL(/\/dashboard/u);

    await visit(page, "/account/settings");
    await page.getByLabel(/confirm your password to disable/iu).fill(password);
    await page.getByTestId("mfa-disable-submit").click();
    await expect(
      page.getByText(/two-factor authentication disabled/iu)
    ).toBeVisible();
  });

  test("deletes its workspace from the danger zone", async () => {
    await visit(page, "/account/settings");
    await page.getByLabel(/to confirm/iu).fill("Robot workspace");
    await page.getByRole("button", { name: /^delete account$/iu }).click();
    await expect(page).toHaveURL(/\/(login)?$/u);
  });

  test("asks for a password reset and is told to check email", async () => {
    await visit(page, "/forgot-password");
    await page.getByLabel(/email/iu).fill(user.email);
    await page
      .getByRole("button")
      .filter({ hasText: /send|reset/iu })
      .click();
    await expect(
      page.getByRole("heading", { name: /check your email/iu })
    ).toBeVisible();
  });

  test("is removed, with everything it made", async () => {
    await removeRobotUser(user);
  });
});
