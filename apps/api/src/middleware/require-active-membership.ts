import { membershipMemo } from "./require-active-membership.memo";
import { lookupActiveMembership } from "./require-active-membership.service";

import type { ActiveMembership } from "./require-active-membership.types";

/** Test-only helper. Clears the in-process membership memo. */
export const clearMembershipCacheForTests = (): void => {
  membershipMemo.clearForTests();
};

/**
 * Per-request membership recheck. Confirms the JWT-claimed
 * `(user, account)` still maps to an active membership and that the
 * parent account is not soft-deleted. Caches the row for 30s to bound
 * query rate; consumers that need the freshest row (privileged ops:
 * account delete, ownership transfer, billing-portal create, role
 * change) call `resolveFreshMembership` instead.
 *
 * Designed as a plain async function rather than an Elysia plugin so
 * the request-context type stays inferable end-to-end: callers wire
 * it via their own `.derive(async ({ user, accountId }) => ({
 * membership: await resolveActiveMembership(user.id, accountId) }))`.
 */
export const resolveActiveMembership = async (
  userId: string,
  accountId: string
): Promise<ActiveMembership> => {
  const nowMs = Date.now();
  const cached = membershipMemo.read(userId, accountId, nowMs);

  if (cached !== null) {
    return cached;
  }

  const membership = await lookupActiveMembership(userId, accountId);

  membershipMemo.write(userId, accountId, membership, nowMs);

  return membership;
};

/**
 * Cache-bypassing variant for privileged operations. Re-fetches the
 * membership row every call so the freshest role is used (the JWT
 * claim is only a hint at that layer).
 */
export const resolveFreshMembership = async (
  userId: string,
  accountId: string
): Promise<ActiveMembership> => {
  const nowMs = Date.now();
  const membership = await lookupActiveMembership(userId, accountId);

  membershipMemo.write(userId, accountId, membership, nowMs);

  return membership;
};
