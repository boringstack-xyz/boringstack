import { ApiErrors } from "../errors";

import type { FeatureKey } from "./acl.types";

/**
 * Throws `ApiErrors.limitExceeded` (402) when `currentCount` is at or
 * above `limit`. Pure: callers compute both numbers (typically inside
 * a transaction with `pg_advisory_xact_lock(hashtext(accountId))` for
 * race-safety on hot insert paths).
 */
export const enforceLimit = (
  feature: FeatureKey,
  currentCount: number,
  limit: number
): void => {
  if (currentCount >= limit) {
    throw ApiErrors.limitExceeded(feature, { current: currentCount, limit });
  }
};
