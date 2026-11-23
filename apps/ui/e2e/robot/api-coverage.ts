import type { IRobotCoverage } from "./coverage";

/*
 * Every API operation, and the robot journeys that call it in production.
 *
 * Two checks keep this honest:
 * - src/app/router/routes.test.tsx fails when an operation in the generated
 *   OpenAPI types (src/lib/api/schema.d.ts) has no entry here, or an entry
 *   names a journey the robot does not have. A new endpoint cannot ship
 *   without the robot calling it or a written reason why it cannot.
 * - e2e/robot/check-api-coverage.ts fails a robot run when the journeys an
 *   entry names passed but none of them called the operation. A claim that
 *   stops being true fails the next run.
 *
 * Keys are `METHOD /path` exactly as the OpenAPI document spells them.
 */
const SIGN_UP = "signs up through the form and is told to check email";
const UNVERIFIED = "cannot log in before the email is verified";
const FIRST_LOGIN = "logs in after verifying and lands on the dashboard";
const PROFILE = "renames itself on the profile page and the name sticks";
const RENAME = "renames the workspace in settings";
const NOTIFICATIONS = "opens notifications and their preferences";
const OWNER_PAGES = "opens the audit log and the join requests as the owner";
const BILLING = "opens billing on the free plan";
const CHECKOUT = "is offered checkout on billing, and Stripe opens";
const FREE_INVITES = "cannot invite a teammate on the free plan";
const PRO = "on Pro, the invite form opens";
const INVITE =
  "invites a robot teammate, resends the invitation and revokes it";
const PASSWORD = "changes its password in settings";
const SIGN_OUT = "logs back in with the new password and signs out";
const MFA =
  "turns on two-factor sign-in, signs in with a code, and turns it off";
const DELETE = "deletes its workspace from the danger zone";
const RESET = "asks for a password reset and is told to check email";
const REMOVED = "is removed, with everything it made";
const UNKNOWN = "log in refuses an unknown account with a message";
const PRODUCT_EVENTS =
  "answers the one-question prompt and sends a product event";

const PROBE =
  "Infrastructure probe at the API root, outside the app's /api path: the uptime check and the cluster read it, not a person.";
const TEST_ONLY =
  "Test-only route: answers 404 in production (NODE_ENV=test or E2E_TEST_ENDPOINTS_ENABLED only).";
const EMAILED_TOKEN =
  "Needs the token from an email; robot addresses receive no mail, and the robot verifies through /auth/synthetic/verify instead.";
const OAUTH =
  "Signing in with an OAuth provider needs a real provider account, which a robot must not hold.";
const PROVIDER_CALLBACK =
  "Called by the email or payment provider with a signed payload, never by a browser.";
const SECOND_MEMBER =
  "Needs a second member in the account; the robot is one user. Covered by the browser tests in e2e/.";
const PUSH =
  "Web Push needs a browser permission grant and a push service; the robot's headless browser has neither.";

const FOLLOW_UP_TOKEN =
  "Needs the signed token from a follow-up email; robot addresses receive no mail. Covered by lifecycle.utils and lifecycle.routes tests.";

export const ROBOT_API_COVERAGE: Readonly<Record<string, IRobotCoverage>> = {
  "GET /": { notChecked: PROBE },
  "GET /health": { notChecked: PROBE },
  "GET /ready": { notChecked: PROBE },
  "GET /metrics": { notChecked: PROBE },
  "GET /api/v1/capabilities/": { journeys: [UNVERIFIED, FIRST_LOGIN] },
  "POST /api/v1/auth/register": { journeys: [SIGN_UP] },
  "POST /api/v1/auth/login": { journeys: [UNVERIFIED, FIRST_LOGIN, UNKNOWN] },
  "POST /api/v1/auth/verify-email": { notChecked: EMAILED_TOKEN },
  "POST /api/v1/auth/resend-verification": { journeys: [UNVERIFIED] },
  "POST /api/v1/auth/__test/force-verify": { notChecked: TEST_ONLY },
  "POST /api/v1/auth/__test/issue-reset-token": { notChecked: TEST_ONLY },
  "POST /api/v1/auth/synthetic/verify": { journeys: [FIRST_LOGIN] },
  "POST /api/v1/auth/synthetic/upgrade": { journeys: [PRO] },
  "POST /api/v1/auth/synthetic/cleanup": { journeys: [REMOVED] },
  "POST /api/v1/auth/forgot-password": { journeys: [RESET] },
  "POST /api/v1/auth/reset-password": { notChecked: EMAILED_TOKEN },
  "POST /api/v1/auth/logout": { journeys: [SIGN_OUT, MFA] },
  "POST /api/v1/auth/refresh": { journeys: [SIGN_OUT, MFA] },
  "GET /api/v1/auth/oauth/{provider}": { notChecked: OAUTH },
  "DELETE /api/v1/auth/oauth/{provider}": { notChecked: OAUTH },
  "GET /api/v1/auth/oauth/{provider}/callback": { notChecked: OAUTH },
  "GET /api/v1/auth/oauth/{provider}/link": { notChecked: OAUTH },
  "POST /api/v1/auth/change-password": { journeys: [PASSWORD] },
  "POST /api/v1/auth/mfa/verify-login": { journeys: [MFA] },
  "POST /api/v1/auth/mfa/verify-recovery": {
    notChecked:
      "A recovery code works once; the robot proves sign-in with a live code instead. Covered by e2e/mfa.spec.ts."
  },
  "GET /api/v1/auth/mfa/status": { journeys: [RENAME, PASSWORD, MFA] },
  "POST /api/v1/auth/mfa/setup": { journeys: [MFA] },
  "POST /api/v1/auth/mfa/verify-setup": { journeys: [MFA] },
  "POST /api/v1/auth/mfa/disable": { journeys: [MFA] },
  "POST /api/v1/auth/mfa/regenerate-recovery-codes": { journeys: [MFA] },
  "GET /api/v1/users/me": { journeys: [FIRST_LOGIN, PROFILE] },
  "PATCH /api/v1/users/me": { journeys: [PROFILE] },
  "POST /api/v1/billing/__test/grant-team-plan": { notChecked: TEST_ONLY },
  "GET /api/v1/billing/subscription": { journeys: [BILLING] },
  "POST /api/v1/billing/stripe/checkout-session": { journeys: [CHECKOUT] },
  "POST /api/v1/billing/stripe/portal-session": {
    notChecked:
      "The billing portal needs a paying Stripe customer; the robot's Pro plan is granted without payment."
  },
  "GET /api/v1/billing/plans": { journeys: [BILLING] },
  "POST /api/v1/billing/stripe/webhooks": { notChecked: PROVIDER_CALLBACK },
  "GET /api/v1/admin/queues": {
    notChecked:
      "Platform-admin only; the robot never holds platform admin in production."
  },
  "GET /api/v1/dashboard/summary": { journeys: [FIRST_LOGIN] },
  "GET /api/v1/dashboard/activity": { journeys: [FIRST_LOGIN] },
  "POST /api/v1/feedback/{moment}/show": {
    journeys: [FIRST_LOGIN, PRODUCT_EVENTS]
  },
  "PUT /api/v1/feedback/{moment}": { journeys: [PRODUCT_EVENTS] },
  "POST /api/v1/product-events/": { journeys: [PRODUCT_EVENTS] },
  "POST /api/v1/notifications/push/subscribe": { notChecked: PUSH },
  "DELETE /api/v1/notifications/push/subscribe": { notChecked: PUSH },
  "GET /api/v1/notifications/push/subscriptions": { notChecked: PUSH },
  "GET /api/v1/notifications/": { journeys: [FIRST_LOGIN, NOTIFICATIONS] },
  "GET /api/v1/notifications/preferences": { journeys: [NOTIFICATIONS] },
  "PUT /api/v1/notifications/preferences": {
    notChecked:
      "A new account has no preferences to save until it has received a notification; the robot's account never does."
  },
  "PATCH /api/v1/notifications/{id}": {
    notChecked:
      "Needs a notification to mark; nothing sends the robot one. Covered by the browser tests in e2e/."
  },
  "POST /api/v1/notifications/mark-all-read": {
    notChecked:
      "Needs a notification to mark; nothing sends the robot one. Covered by the browser tests in e2e/."
  },
  "GET /api/v1/notifications/stream": { journeys: [FIRST_LOGIN] },
  "POST /api/v1/webhooks/resend": { notChecked: PROVIDER_CALLBACK },
  "POST /api/v1/webhooks/sendgrid": { notChecked: PROVIDER_CALLBACK },
  "POST /api/v1/accounts/switch": { notChecked: SECOND_MEMBER },
  "GET /api/v1/accounts/{id}/invitations": {
    journeys: [FREE_INVITES, PRO, INVITE]
  },
  "POST /api/v1/accounts/{id}/invitations": { journeys: [INVITE] },
  "POST /api/v1/accounts/{id}/invitations/{invitationId}/resend": {
    journeys: [INVITE]
  },
  "DELETE /api/v1/accounts/{id}/invitations/{invitationId}": {
    journeys: [INVITE]
  },
  "DELETE /api/v1/accounts/{id}": { journeys: [DELETE] },
  "PATCH /api/v1/accounts/{id}": { journeys: [RENAME] },
  "POST /api/v1/accounts/{id}/transfer-ownership": {
    notChecked: SECOND_MEMBER
  },
  "GET /api/v1/accounts/{id}/transfer-ownership/pending": {
    notChecked: SECOND_MEMBER
  },
  "DELETE /api/v1/accounts/{id}/transfer-ownership/{transferId}": {
    notChecked: SECOND_MEMBER
  },
  "DELETE /api/v1/accounts/{id}/memberships/me": { notChecked: SECOND_MEMBER },
  "GET /api/v1/accounts/{id}/audit-log": { journeys: [OWNER_PAGES] },
  "GET /api/v1/accounts/{id}/join-requests": { journeys: [OWNER_PAGES] },
  "POST /api/v1/accounts/{id}/join-requests/{requestId}/approve": {
    notChecked: SECOND_MEMBER
  },
  "POST /api/v1/accounts/{id}/join-requests/{requestId}/deny": {
    notChecked: SECOND_MEMBER
  },
  "POST /api/v1/invitations/accept": { notChecked: SECOND_MEMBER },
  "POST /api/v1/invitations/ownership-transfer/accept": {
    notChecked: SECOND_MEMBER
  },
  "POST /api/v1/invitations/ownership-transfer/decline": {
    notChecked: SECOND_MEMBER
  },
  "GET /api/v1/lifecycle/unsubscribe": { notChecked: FOLLOW_UP_TOKEN },
  "POST /api/v1/lifecycle/unsubscribe": { notChecked: FOLLOW_UP_TOKEN }
};
