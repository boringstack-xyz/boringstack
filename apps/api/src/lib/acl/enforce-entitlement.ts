import { and, eq, isNull, sql } from "drizzle-orm";

import { accountMemberships } from "../../clients/postgres/schema";
import { ApiErrors } from "../errors";

import { enforceLimit } from "./enforce-limit";
import { resolveAccountFeatures } from "./resolve-account-features";

import type { DbOrTx } from "../../api/accounts/accounts.types";
import type { FeatureKey } from "./acl.types";

/**
 * Server-side entitlement checks.
 *
 * This is where plan features stop being display hints and start being
 * gates. A `can_invite_team` check in the SPA is not one — a `POST` to the
 * route walks straight past it — and a `max_seats` number nothing consults
 * is not a cap. Anything that reads like an entitlement has to be enforced
 * here, on the server, or it enforces nothing.
 */

/** Refuses the operation when the account's plan withholds `feature`. */
export const requireFeature = async (
  accountId: string,
  feature: FeatureKey
): Promise<void> => {
  const features = await resolveAccountFeatures(accountId);

  if (features[feature] === true) {
    return;
  }

  throw ApiErrors.forbidden(
    `Your plan does not include ${feature.replace(/_/gu, " ")}`
  );
};

/**
 * Refuses to add a member when the account is at its seat cap.
 *
 * Must run inside the same transaction as the membership insert, and takes
 * `pg_advisory_xact_lock` on the account first — the pattern
 * `enforce-limit.ts` documents and that no caller implemented. Counting
 * without the lock is a check-then-act: concurrent acceptances each read a
 * count below the cap and each commit, so the cap is exceeded by however
 * many requests happen to overlap.
 *
 * The cap is read at commit time rather than when the invitation was
 * issued, so invitations outstanding across a downgrade cannot land the
 * account above its new plan.
 */
export const enforceSeatAvailable = async (
  tx: DbOrTx,
  accountId: string
): Promise<void> => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${accountId}::text))`
  );

  const features = await resolveAccountFeatures(accountId);
  const maxSeats = features.max_seats;

  if (typeof maxSeats !== "number") {
    return;
  }

  const rows = await tx
    .select({ id: accountMemberships.id })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.accountId, accountId),
        isNull(accountMemberships.revokedAt)
      )
    );

  enforceLimit("max_seats", rows.length, maxSeats);
};
