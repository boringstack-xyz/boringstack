/**
 * Operator resolution for the LAN-only admin API.
 *
 * The admin process has no login: it acts as one known platform admin, the
 * "operator". The operator is resolved once at boot from
 * `users.is_platform_admin`, optionally pinned by `ADMIN_OPERATOR_USER_ID`
 * when more than one platform admin exists. A bad setup aborts the boot
 * instead of surfacing as a 403 on the first request.
 */
import { eq } from "drizzle-orm";

import { db } from "../clients/postgres";
import { users } from "../clients/postgres/schema";
import { env } from "../config/env";
import { BootInvariantError } from "./invariants";

export interface IOperator {
  id: string;
}

let resolved: IOperator | null = null;

/** The operator resolved at boot, or null when this process never resolved one. */
export const getResolvedOperator = (): IOperator | null => resolved;

/** Set by `src/admin.ts` after `resolveOperator()`. The public app never calls it. */
export const setResolvedOperator = (operator: IOperator | null): void => {
  resolved = operator;
};

export const resolveOperator = async (
  configuredId: string = env.ADMIN_OPERATOR_USER_ID
): Promise<IOperator> => {
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isPlatformAdmin, true));

  if (configuredId !== "") {
    const match = admins.find((admin) => admin.id === configuredId);

    if (!match) {
      throw new BootInvariantError([
        `ADMIN_OPERATOR_USER_ID ${configuredId} is not a platform admin`,
      ]);
    }

    return { id: match.id };
  }

  const [only, second] = admins;

  if (!only) {
    throw new BootInvariantError([
      "no platform admin exists: set users.is_platform_admin for the operator",
    ]);
  }

  if (second) {
    throw new BootInvariantError([
      "more than one platform admin exists: set ADMIN_OPERATOR_USER_ID to choose the operator",
    ]);
  }

  return { id: only.id };
};
