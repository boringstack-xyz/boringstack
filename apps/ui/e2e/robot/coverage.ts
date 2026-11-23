/*
 * Every page of the app, and the robot journey that opens it in production.
 * src/app/router/routes.test.tsx fails when a route has no entry here or an
 * entry names a journey the robot does not have, so a new page cannot ship
 * without the robot checking it or a written reason why it cannot.
 */
export interface IRobotCoverage {
  /** Titles of the journeys in e2e/robot/*.spec.ts that open this page. */
  readonly journeys?: readonly string[];
  /** Why no robot journey can open this page. Shown to the owner in the docs. */
  readonly notChecked?: string;
}

const SIGN_IN =
  "the app opens on sign-in, and the cookie banner can be declined";
const MEMBERS_ONLY = "a members-only page sends a visitor to log in";
const NO_TOKEN = "links that arrive without their token say what is missing";

export const ROBOT_COVERAGE: Readonly<Record<string, IRobotCoverage>> = {
  "*": { journeys: ["an address that does not exist says so and leads home"] },
  "/": { journeys: [SIGN_IN] },
  "/account/audit-log": {
    journeys: ["opens the audit log and the join requests as the owner"]
  },
  "/account/billing": {
    journeys: [
      "opens billing on the free plan",
      "is offered checkout on billing, and Stripe opens",
      MEMBERS_ONLY
    ]
  },
  "/account/invitations": {
    journeys: [
      "cannot invite a teammate on the free plan",
      "on Pro, the invite form opens"
    ]
  },
  "/account/ownership-transfer/accept": { journeys: [MEMBERS_ONLY] },
  "/account/profile": {
    journeys: ["renames itself on the profile page and the name sticks"]
  },
  "/account/requests": {
    journeys: ["opens the audit log and the join requests as the owner"]
  },
  "/account/settings": {
    journeys: [
      "renames the workspace in settings",
      "changes its password in settings"
    ]
  },
  "/dashboard": {
    journeys: [
      "logs in after verifying and lands on the dashboard",
      "logs back in with the new password and signs out"
    ]
  },
  "/forgot-password": {
    journeys: [
      "sign up and forgot password pages open and validate",
      "asks for a password reset and is told to check email"
    ]
  },
  "/invitations/accept": { journeys: [MEMBERS_ONLY] },
  "/login": {
    journeys: [
      "log in refuses an unknown account with a message",
      "cannot log in before the email is verified"
    ]
  },
  "/notifications": {
    journeys: ["opens notifications and their preferences"]
  },
  "/notifications/preferences": {
    journeys: ["opens notifications and their preferences"]
  },
  "/oauth/success": {
    notChecked:
      "Signing in with an OAuth provider needs a real provider account, which a robot must not hold."
  },
  "/reset-password": { journeys: [NO_TOKEN] },
  "/signup": {
    journeys: [
      "signs up through the form and is told to check email",
      "sign up and forgot password pages open and validate"
    ]
  },
  "/verify-email": { journeys: [NO_TOKEN] }
};
