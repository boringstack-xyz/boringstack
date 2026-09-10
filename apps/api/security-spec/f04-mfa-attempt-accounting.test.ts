/**
 * F04: MFA attempt accounting races under concurrency.
 *
 * `recordFailedAttempt` (mfa.service.ts:510-549) reads the challenge, adds
 * one, and writes it back:
 *
 *   const attempts = current.attempts + 1;     // :515
 *   await cacheService.set(challengeKey, { userId: current.userId, attempts },
 *                          { ttlSeconds: MFA_CHALLENGE_TTL_SECONDS });  // :539
 *
 * `current` was read before the request began. Concurrent wrong submissions
 * all observe the same N and all write N+1, so the 5-attempt budget
 * (MFA_MAX_CHALLENGE_ATTEMPTS) buys an attacker far more than five guesses
 * against a six-digit code.
 *
 * `ICacheService` exposes only get/set/del/has/wrap/close: no INCR, no CAS,
 * no Lua, so there is no atomic primitive available at this layer. INCR does
 * exist in the codebase, but only in the rate-limit modules, which the MFA
 * counter does not reach.
 *
 * Worth crediting the code: the two OTHER MFA races are closed properly with
 * Postgres compare-and-set: TOTP step reuse (`:250-265`) and recovery-code
 * reuse (`:353-362`) both use conditional UPDATE ... RETURNING. The gap is
 * specific to the aggregate counter.
 *
 * Second defect: line 542 re-applies the full 5-minute TTL on every failure,
 * so a steady trickle of wrong codes keeps a challenge alive indefinitely
 * instead of expiring five minutes after issue.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { Redis } from "ioredis";

import { now } from "../src/lib/time/now";
import { mfaService } from "../src/api/auth/services/mfa.service";
import { MFA_MAX_CHALLENGE_ATTEMPTS } from "../src/api/auth/mfa.constants";
import { AUDIT_ACTIONS } from "../src/lib/audit-log";
import {
  and,
  auditLog,
  cleanDatabase,
  db,
  eq,
  users,
} from "../tests/helpers/db";
import { seedVerifiedUser } from "../tests/helpers/auth";
import { raceAll, requireDbOrFail, requireValkeyOrFail } from "./harness";

/** Opens a raw client against the same Valkey the cache provider uses. */
const valkeyClient = async (): Promise<Redis> => {
  const client = new Redis({
    host: process.env.VALKEY_HOST ?? "127.0.0.1",
    port: Number(process.env.VALKEY_PORT ?? 6379),
    password: process.env.VALKEY_PASSWORD,
    lazyConnect: true,
  });

  await client.connect();

  return client;
};

const clearChallengeKeys = async (): Promise<void> => {
  const client = await valkeyClient();

  try {
    const keys = await client.keys("*mfa:challenge:*");

    if (keys.length > 0) {
      await client.del(...keys);
    }
  } finally {
    await client.quit();
  }
};

const WRONG_CODE = "000000";

/** A user with MFA switched on, without going through enrolment. */
const seedMfaUser = async (email: string): Promise<string> => {
  const { user } = await seedVerifiedUser({ email });

  const { encryptString } = await import("../src/lib/crypto/aes-gcm.utils");

  await db
    .update(users)
    .set({
      mfaEnabledAt: now(),
      mfaSecretEncrypted: encryptString("JBSWY3DPEHPK3PXP"),
    })
    .where(eq(users.id, user.id));

  return user.id;
};

beforeEach(async () => {
  await requireDbOrFail();
  await requireValkeyOrFail();
  await cleanDatabase();

  /*
   * `cleanDatabase` does not touch Valkey, and the TTL assertion locates the
   * challenge by key pattern. A challenge left behind by an earlier test
   * would be matched instead, and its already-decaying TTL would satisfy the
   * assertion for the wrong reason.
   */
  await clearChallengeKeys();
});

describe("F04 MFA attempt accounting", () => {
  test("no more than the budget of guesses is ever evaluated", async () => {
    const userId = await seedMfaUser("f04-admission@example.com");
    const challenge = await mfaService.issueChallenge(userId);

    /*
     * Counts ADMISSIONS, not refusals.
     *
     * Charging an attempt only once a code turns out to be wrong bounds
     * nothing: every request that already read the challenge goes on to
     * evaluate its code, and a correct one among the surplus reaches the
     * success path without consulting the counter. The returned `kind`
     * cannot see that: surplus submissions come back `locked_out` whether
     * their code was evaluated or refused at the door.
     *
     * The audit trail can. A submission admitted to evaluation and found
     * wrong records `AUTH_MFA_LOGIN_FAILED`; one refused before evaluation
     * records only `AUTH_MFA_LOGIN_LOCKED_OUT`. So the number of FAILED
     * rows is the number of guesses the server actually checked.
     */
    await raceAll(MFA_MAX_CHALLENGE_ATTEMPTS + 3, async () =>
      mfaService.verifyTotpLogin(challenge.challengeToken, WRONG_CODE)
    );

    // Audit writes are fire-and-forget; give them a moment to land.
    await Bun.sleep(500);

    const evaluated = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.userId, userId),
          eq(auditLog.action, AUDIT_ACTIONS.AUTH_MFA_LOGIN_FAILED)
        )
      );

    expect(evaluated.length).toBeLessThanOrEqual(MFA_MAX_CHALLENGE_ATTEMPTS);
  });

  test("a correct code cannot win a race once the budget is spent", async () => {
    const userId = await seedMfaUser("f04-latecomer@example.com");
    const challenge = await mfaService.issueChallenge(userId);

    /* Spend the whole budget serially, so the challenge is closed. */
    for (let i = 0; i < MFA_MAX_CHALLENGE_ATTEMPTS; i += 1) {
      await mfaService
        .verifyTotpLogin(challenge.challengeToken, WRONG_CODE)
        .catch(() => undefined);
    }

    const { buildTotp } = await import("../src/api/auth/services/mfa.utils");
    const validCode = buildTotp(
      "JBSWY3DPEHPK3PXP",
      "f04-latecomer@example.com"
    ).generate();

    const outcome = await mfaService
      .verifyTotpLogin(challenge.challengeToken, validCode)
      .then((result) => result.kind)
      .catch(() => "rejected" as const);

    /*
     * The right code arriving after the budget is gone must not open the
     * door. This is the case a failure-only counter lets through.
     */
    expect(outcome).not.toBe("verified");
  });

  test("concurrent wrong codes each consume an attempt", async () => {
    const userId = await seedMfaUser("f04-race@example.com");
    const challenge = await mfaService.issueChallenge(userId);

    const burst = MFA_MAX_CHALLENGE_ATTEMPTS + 3;

    const outcomes = await raceAll(burst, async () =>
      mfaService.verifyTotpLogin(challenge.challengeToken, WRONG_CODE)
    );

    /*
     * Once the budget is spent the challenge must be gone, so the surplus
     * submissions cannot be evaluated at all. Today every one of them is
     * evaluated, because they all read the same pre-burst counter.
     */
    const evaluated = outcomes.filter(
      (outcome) =>
        outcome.status === "fulfilled" && outcome.value.kind === "failed"
    );

    expect(evaluated.length).toBeLessThanOrEqual(MFA_MAX_CHALLENGE_ATTEMPTS);
  });

  test("a failed attempt does not extend the challenge lifetime", async () => {
    const userId = await seedMfaUser("f04-ttl@example.com");

    const client = await valkeyClient();

    try {
      const challenge = await mfaService.issueChallenge(userId);

      /*
       * The challenge key is derived from a hash of the token, so it cannot
       * be recomputed here. The cache provider also prefixes keys with
       * "cache:". Exactly one exists after issuing.
       */
      const [key] = await client.keys("*mfa:challenge:*");

      if (key === undefined) {
        throw new Error("f04: no challenge key found in Valkey");
      }

      const before = await client.ttl(key);

      await Bun.sleep(1100);
      await mfaService.verifyTotpLogin(challenge.challengeToken, WRONG_CODE);

      const after = await client.ttl(key);

      /*
       * A wrong code must not buy more time. Today `recordFailedAttempt`
       * re-`set`s the challenge with a fresh 5-minute TTL, so `after` comes
       * back at or above `before` and the window never closes.
       */
      expect(after).toBeLessThan(before);
    } finally {
      await client.quit();
    }
  });

  test("control: sequential wrong codes are counted one at a time", async () => {
    const userId = await seedMfaUser("f04-serial@gmail.com");
    const challenge = await mfaService.issueChallenge(userId);

    const first = await mfaService.verifyTotpLogin(
      challenge.challengeToken,
      WRONG_CODE
    );
    const second = await mfaService.verifyTotpLogin(
      challenge.challengeToken,
      WRONG_CODE
    );

    /*
     * Proves the challenge, the fixture and the counter all work when the
     * submissions do not overlap, so the burst assertion above is about
     * concurrency rather than about a broken setup.
     */
    expect(first.kind).toBe("failed");
    expect(second.kind).toBe("failed");
  });
});
