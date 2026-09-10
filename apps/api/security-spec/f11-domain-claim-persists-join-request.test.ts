/**
 * F11 — domain-claim onboarding rolls back its own join request.
 *
 * `accounts.service.ts:377-389` files a pending join request and then throws:
 *
 *   await joinRequestsService.createPending({...}, tx);
 *   ...
 *   throw ApiErrors.domainClaimed(claimed.name, { accountId: claimed.id, domain });
 *
 * `tx` is the enclosing transaction opened at `:44`, there is no savepoint,
 * and no caller catches `domainClaimed` — the callers are `oauth.service.ts:128`
 * and `email-verification.service.ts:95,181`. The throw aborts the transaction
 * and discards the insert.
 *
 * The comment at `:369-375` states the intent plainly ("file a pending join
 * request so the existing owner can approve") and the code defeats it. The
 * try/catch around the insert guards against `createPending` throwing, which
 * is the wrong failure mode; the actual failure is silent rollback. The
 * owner-approval path the API advertises never has a row to approve.
 *
 * Second half: `join-requests.service.ts:69-77` fires the owner notification
 * synchronously inside the still-open transaction, and `fireOwnerNotification`
 * queries via `db` rather than `tx` (`:225`, `:235`), so it reads outside the
 * transaction entirely. The owner is emailed a review link for a request id
 * that will not exist.
 *
 * Fixture note. The joining user is seeded UNPROVISIONED, so provisioning
 * is invoked exactly once, by the test. `seedVerifiedUser` calls
 * `provisionAfterVerification` itself, and with domain claiming enabled
 * that fails during setup — leaving the test red without ever reaching its
 * assertion, which is a fixture failure dressed as a proven finding.
 *
 * Requires ACCOUNT_DOMAIN_CLAIMING=true; `resolveDomainClaim` returns null
 * immediately when the flag is off.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { accountsService } from "../src/api/accounts/accounts.service";
import { ApiError, ErrorCodes } from "../src/lib/errors";
import { now } from "../src/lib/time/now";
import {
  accountJoinRequests,
  accountMemberships,
  accounts,
  and,
  cleanDatabase,
  db,
  eq,
  users,
} from "../tests/helpers/db";
import { seedPendingUser, seedVerifiedUser } from "../tests/helpers/auth";
import { requireDbOrFail, specPrecondition } from "./harness";

const DOMAIN = "claimed-f11.example";

/**
 * Runs provisioning and reports which of the two expected outcomes happened,
 * rethrowing anything else.
 *
 * Swallowing every error with `.catch(() => undefined)` would erase the
 * difference between the finding and a database outage: both leave no
 * membership and no surviving request, so both produce the same assertion
 * failure below and the real cause never reaches the report. The reconciler
 * cannot recover a cause the test has already discarded.
 *
 * `DOMAIN_CLAIMED` is matched by code rather than message, so rewording the
 * copy does not break the test. The `provisioned` branch exists because the
 * planned fix replaces the throw with a typed pending result; when that lands
 * this returns normally and the assertion on the persisted row still governs.
 */
const provision = async (userId: string): Promise<"claimed" | "provisioned"> =>
  accountsService
    .provisionAfterVerification({ userId })
    .then((): "provisioned" => "provisioned")
    .catch((error: unknown): "claimed" => {
      if (
        error instanceof ApiError &&
        error.code === ErrorCodes.DOMAIN_CLAIMED
      ) {
        return "claimed";
      }

      throw error;
    });

/** A verified user with no account yet, so the test owns provisioning. */
const seedVerifiedButUnprovisioned = async (email: string): Promise<string> => {
  const { user } = await seedPendingUser({ email });

  await db
    .update(users)
    .set({ emailVerifiedAt: now() })
    .where(eq(users.id, user.id));

  return user.id;
};

beforeEach(async () => {
  await requireDbOrFail();
  await cleanDatabase();
});

describe("F11 domain claim persists the join request", () => {
  test("a rejected domain-claim signup leaves exactly one pending request", async () => {
    const { account: owned } = await seedVerifiedUser({
      email: `owner@${DOMAIN}`,
    });

    /*
     * Provisioning the owner is what claims the domain. Asserted rather than
     * assumed: if claiming is off, or the domain is treated as public, the
     * branch under test is never reached and everything below is meaningless.
     */
    const [ownerAccount] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, owned.id));

    specPrecondition(
      ownerAccount?.claimedDomain === DOMAIN,
      `expected the owner account to claim ${DOMAIN}, got ` +
        `${String(ownerAccount?.claimedDomain)} — is ACCOUNT_DOMAIN_CLAIMING set?`
    );

    const joinerId = await seedVerifiedButUnprovisioned(`newcomer@${DOMAIN}`);

    /*
     * Outcome-shaped rather than message-shaped. Replacing the thrown
     * `domainClaimed` with a typed transaction result is a better design
     * that leaves user-facing behaviour unchanged, and a test keyed on the
     * exception text would fail that correct refactor. What must hold
     * either way is that the joiner does not get their own account.
     */
    await provision(joinerId);

    const ownMemberships = await db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.userId, joinerId));

    specPrecondition(
      ownMemberships.length === 0,
      `the joiner was provisioned their own account (${ownMemberships.length} ` +
        "membership(s)), so the domain-claim branch never ran"
    );

    const pending = await db
      .select()
      .from(accountJoinRequests)
      .where(
        and(
          eq(accountJoinRequests.accountId, owned.id),
          eq(accountJoinRequests.userId, joinerId)
        )
      );

    /*
     * The API tells this user "the domain is claimed, an owner will review
     * your request". That promise requires the row to survive the response.
     */
    expect(pending).toHaveLength(1);
  });

  test("control: a public-domain signup still provisions its own account", async () => {
    const joinerId = await seedVerifiedButUnprovisioned("someone@gmail.com");

    const outcome = await provision(joinerId);

    /*
     * Proves the fixture provisions correctly when the domain-claim branch is
     * not involved, so a failure above is about the rollback and not seeding.
     */
    expect(outcome).toBe("provisioned");
  });
});
