import { ApiErrors } from "../../lib/errors";
import { accountsService } from "../accounts";
import type { IUser } from "../users/users.types";

import type { IPublicUser } from "./auth.types";

export const toPublicUser = (user: IUser): IPublicUser => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  emailVerified: user.emailVerifiedAt !== null,
});

export const normalizeEmail = (email: string): string =>
  email.toLowerCase().trim();

/**
 * Resolves the active account for JWT issuance. Picks the user's
 * first active membership in joined-at order; the JWT-claimed account
 * can be switched at runtime via the account-switch endpoint. Throws
 * when the user has no active memberships — that's an invariant break
 * (signup always creates a personal account).
 */
export const resolveActiveAccountId = async (
  userId: string
): Promise<string> => {
  const memberships = await accountsService.getMembershipsForUser(userId);
  const first = memberships[0];

  if (first === undefined) {
    throw ApiErrors.internal(`User ${userId} has no active memberships`);
  }

  return first.accountId;
};
