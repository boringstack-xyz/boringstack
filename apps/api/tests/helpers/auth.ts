import { accountsService } from "../../src/api/accounts";
import { EMAIL_PROVIDER_KEY } from "../../src/api/auth/auth.constants";
import { normalizeEmail } from "../../src/lib/email";
import { passwordService } from "../../src/lib/password";
import { now } from "../../src/lib/time/now";

import {
  db,
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

  const provisioned = await accountsService.provisionAfterVerification({
    userId: user.id,
  });

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
