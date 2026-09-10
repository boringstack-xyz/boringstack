/**
 * F15 — the credential and global limiters share one Valkey counter.
 *
 * `src/lib/rate-limit/valkey-context.ts:53`:
 *
 *   const buildKey = (rawKey: string): string =>
 *     `${RATE_LIMIT_KEY_PREFIX}${rawKey}`;
 *
 * `rawKey` is the client IP and nothing else. `buildRateLimit()` and
 * `buildAuthRateLimit()` (src/config/security/security.ts:108, :120) each
 * construct their own `ValkeyRateLimitContext`, but both write `rl:<ip>`.
 * The library's `seed` distinguishes only the Elysia plugin instance, not
 * the storage key.
 *
 * Consequences, with RATE_LIMIT_MAX=100/60s and AUTH_RATE_LIMIT_MAX=10/60s:
 * ten unrelated public requests exhaust the credential budget, and whichever
 * policy touches the key first owns the TTL window.
 *
 * There is a second effect the review did not name. The global limiter's
 * `onError` hook is global-scoped, so it fires on failed auth responses and
 * calls `decrement` on the same shared key — refunding exactly the failures
 * that `countFailedRequest: true` exists to charge for.
 *
 * This cannot reproduce under the default test environment, which pins
 * CACHE_PROVIDER=memory where each limiter gets its own LRU. The suite runs
 * with SECURITY_SPEC=true so the real provider is used.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { ValkeyRateLimitContext } from "../src/lib/rate-limit/valkey-context";
import { requireValkeyOrFail } from "./harness";

const WINDOW_MS = 60_000;
const CLIENT_IP = "203.0.113.77";

let general: ValkeyRateLimitContext;
let credential: ValkeyRateLimitContext;

/*
 * `init` takes the plugin's full option set minus `context`. Only duration
 * and max matter here; the rest mirror the real defaults so the contexts are
 * configured exactly as `buildRateLimit()` / `buildAuthRateLimit()` configure
 * theirs.
 */
const initOptions = (
  max: number
): Parameters<ValkeyRateLimitContext["init"]>[0] => ({
  duration: WINDOW_MS,
  max,
  errorResponse: "rate-limited",
  scoping: "global",
  countFailedRequest: false,
  generator: () => CLIENT_IP,
  skip: () => false,
  headers: true,
});

beforeEach(async () => {
  await requireValkeyOrFail();

  general = new ValkeyRateLimitContext();
  credential = new ValkeyRateLimitContext();

  general.init(initOptions(100));
  credential.init(initOptions(10));

  await general.reset(CLIENT_IP);
  await credential.reset(CLIENT_IP);
});

afterEach(async () => {
  await general.reset(CLIENT_IP);
  await credential.reset(CLIENT_IP);
  await general.kill();
  await credential.kill();
});

describe("F15 rate limit namespacing", () => {
  test("public traffic does not consume the credential budget", async () => {
    // Twenty ordinary requests: well inside the 100/60s general budget.
    for (let i = 0; i < 20; i += 1) {
      await general.increment(CLIENT_IP);
    }

    const afterPublicTraffic = await credential.increment(CLIENT_IP);

    /*
     * The first login attempt from this IP must be the first against the
     * credential budget. Today it reports 21, because both policies write
     * the same `rl:203.0.113.77`.
     */
    expect(afterPublicTraffic.count).toBe(1);
  });

  test("the two limiters keep independent windows", async () => {
    await credential.increment(CLIENT_IP);
    await general.reset(CLIENT_IP);

    const credentialAfterGeneralReset = await credential.increment(CLIENT_IP);

    // Resetting one policy must not clear the other's counter.
    expect(credentialAfterGeneralReset.count).toBe(2);
  });

  test("control: a limiter counts its own traffic", async () => {
    await credential.increment(CLIENT_IP);
    const second = await credential.increment(CLIENT_IP);

    expect(second.count).toBe(2);
  });
});
