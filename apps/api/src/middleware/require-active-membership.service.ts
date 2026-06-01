import { eq } from "drizzle-orm";

import { accountsService } from "../api/accounts";
import { db } from "../clients/postgres";
import { accounts } from "../clients/postgres/schema";
import { ApiErrors } from "../lib/errors";

import type { ActiveMembership } from "./require-active-membership.types";

export const lookupActiveMembership = async (
  userId: string,
  accountId: string
): Promise<ActiveMembership> => {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account) {
    throw ApiErrors.unauthorized("Account not available");
  }

  if (account.deletedAt !== null) {
    throw ApiErrors.unauthorized("Account not available");
  }

  const membership = await accountsService.getActiveMembership(
    userId,
    accountId
  );

  if (!membership) {
    throw ApiErrors.unauthorized("Membership not active for this account");
  }

  return membership;
};
