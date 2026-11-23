import { eq } from "drizzle-orm";
import { Elysia } from "elysia";

import { getResolvedOperator } from "../boot/operator";
import type { IUser } from "../api/users/users.types";
import { db } from "../clients/postgres";
import { users } from "../clients/postgres/schema";
import { logger } from "../config/logger";
import { ApiErrors } from "../lib/errors";

let cache: IUser | null = null;

const load = async (operatorId: string): Promise<IUser> => {
  if (cache?.id === operatorId) {
    return cache;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, operatorId),
  });

  if (user?.isPlatformAdmin !== true) {
    throw ApiErrors.forbidden();
  }

  cache = user;

  return cache;
};

/** Test hook: forget the cached operator. */
export const resetOperatorCache = (): void => {
  cache = null;
};

/**
 * Guard for the LAN-only admin API. There is no session: every request acts
 * as the operator resolved at boot (`src/admin.ts`).
 *
 * Chain it onto the routes it protects (`requireOperator().get(...)`), the
 * same shape as `requirePlatformAdmin`. In any process that never resolved
 * an operator (the public app), it rejects with 403. It never allows by
 * default.
 */
export const requireOperator = () =>
  new Elysia().onBeforeHandle(async () => {
    const operator = getResolvedOperator();

    if (operator === null) {
      logger.warn("Operator check denied: no operator resolved", {
        event: "authz_denied",
      });

      throw ApiErrors.forbidden();
    }

    await load(operator.id);
  });
