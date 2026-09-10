import { accountsService } from "../../src/api/accounts";
import type {
  ICreatePersonalAccountResult,
  IProvisionOutcome,
} from "../../src/api/accounts/accounts.types";
import { EMAIL_PROVIDER_KEY } from "../../src/api/auth/auth.constants";
import { normalizeEmail } from "../../src/lib/email";
import { passwordService } from "../../src/lib/password";
import { now } from "../../src/lib/time/now";

import {
  accountPlans,
  db,
  eq,
  planFeatures,
  plans,
  userAuthProviders,
  users,
  type IAccount,
  type IAccountMembership,
  type IUser,
} from "./db";

interface ISeedVerifiedUserInput {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  isPlatformAdmin?: boolean;
}

interface ISeedVerifiedUserResult {
  user: IUser;
  account: IAccount;
  membership: IAccountMembership;
  password: string;
}

interface ISeedPendingUserInput {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

interface ISeedPendingUserResult {
  user: IUser;
  password: string;
}

const DEFAULT_PASSWORD = "Hunter2Strong!";

/**
 * Narrows a provisioning outcome to the success case.
 *
 * `provisionAfterVerification` returns a discriminated result because the
 * claimed-domain branch has to commit its pending join request rather than
 * abort the transaction with a throw. Tests that are not about domain
 * claiming assert they got an account.
 */
export const expectProvisioned = (
  outcome: IProvisionOutcome
): ICreatePersonalAccountResult => {
  if (outcome.kind !== "provisioned") {
    throw new Error(
      `expected provisioning to succeed, got "${outcome.kind}" for domain ${outcome.domain}`
    );
  }

  return outcome;
};

/**
 * Fixture for any test that needs a fully-provisioned account holder.
 * Inserts the user row (already verified), the password-auth provider
 * row, and runs the production-path provisioning. Use this instead of
 * driving `authService.register` + verify dance in tests that aren't
 * actually exercising those routes.
 */
export const seedVerifiedUser = async (
  input: ISeedVerifiedUserInput
): Promise<ISeedVerifiedUserResult> => {
  const password = input.password ?? DEFAULT_PASSWORD;
  const passwordHash = await passwordService.hash(password);
  const verifiedAt = now();
  const normalizedEmail = normalizeEmail(input.email);

  const [user] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      firstName: input.firstName ?? "",
      lastName: input.lastName ?? "",
      emailVerifiedAt: verifiedAt,
      isPlatformAdmin: input.isPlatformAdmin ?? false,
    })
    .returning();

  if (!user) {
    throw new Error("seedVerifiedUser: failed to insert user row");
  }

  await db.insert(userAuthProviders).values({
    userId: user.id,
    provider: EMAIL_PROVIDER_KEY,
    providerUserId: normalizedEmail,
    passwordHash,
  });

  const provisioned = expectProvisioned(
    await accountsService.provisionAfterVerification({ userId: user.id })
  );

  return {
    user,
    account: provisioned.account,
    membership: provisioned.membership,
    password,
  };
};

/**
 * Fixture for tests that exercise the pending-user state. Inserts the
 * user without `emailVerifiedAt` and a password-auth provider row.
 * No account or membership is created; that's the whole point.
 */
export const seedPendingUser = async (
  input: ISeedPendingUserInput
): Promise<ISeedPendingUserResult> => {
  const password = input.password ?? DEFAULT_PASSWORD;
  const passwordHash = await passwordService.hash(password);
  const normalizedEmail = normalizeEmail(input.email);

  const [user] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      firstName: input.firstName ?? "",
      lastName: input.lastName ?? "",
    })
    .returning();

  if (!user) {
    throw new Error("seedPendingUser: failed to insert user row");
  }

  await db.insert(userAuthProviders).values({
    userId: user.id,
    provider: EMAIL_PROVIDER_KEY,
    providerUserId: normalizedEmail,
    passwordHash,
  });

  return { user, password };
};

interface IGrantTeamPlanInput {
  accountId: string;
  /** Seats the plan allows, including the owner. */
  maxSeats?: number;
  canInviteTeam?: boolean;
}

/**
 * Puts an account on a plan that permits team management.
 *
 * Needed because entitlement is enforced server-side: `can_invite_team`
 * defaults to false and `max_seats` to 1 (`lib/acl/acl.constants.ts`), so an
 * account with no plan row is a single-seat account that cannot invite. Any
 * test exercising invitation or join-request mechanics has to say which plan
 * the account is on, the same way a real deployment does.
 */
export const grantTeamPlan = async (
  input: IGrantTeamPlanInput
): Promise<void> => {
  const name = `test-team-${String(input.maxSeats ?? 25)}-${String(
    input.canInviteTeam ?? true
  )}`;

  const [inserted] = await db
    .insert(plans)
    .values({ name, stripePriceId: `price_${name}` })
    .onConflictDoNothing()
    .returning();

  const [plan] = inserted
    ? [inserted]
    : await db.select().from(plans).where(eq(plans.name, name));

  if (!plan) {
    throw new Error("grantTeamPlan: failed to resolve the plan row");
  }

  for (const feature of [
    {
      featureKey: "can_invite_team",
      value: { bool: input.canInviteTeam ?? true },
    },
    { featureKey: "max_seats", value: { number: input.maxSeats ?? 25 } },
  ]) {
    await db
      .insert(planFeatures)
      .values({ planId: plan.id, ...feature })
      .onConflictDoUpdate({
        target: [planFeatures.planId, planFeatures.featureKey],
        set: { value: feature.value },
      });
  }

  await db.insert(accountPlans).values({
    accountId: input.accountId,
    planId: plan.id,
    status: "active",
    source: "stripe",
    stripeSubscriptionId: `sub_${name}`,
    currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });
};
