import type { RedisOptions } from "bullmq";
import { env } from "../../config/env";

/*
 * Two Valkey client profiles, one source of truth.
 *
 * - `getValkeyConnectionOptions()`        → BullMQ queues & workers.
 *   `maxRetriesPerRequest: null` is REQUIRED by BullMQ — its blocking
 *   `BRPOPLPUSH` commands run for minutes and must never bail. The trade
 *   is that BullMQ owns connection health and we don't.
 *
 * - `getValkeyAppClientOptions({ connectTimeout })` → cache, pub/sub, OAuth
 *   state, health probe. Fail-fast pattern: don't queue commands, don't
 *   retry, don't block app threads on a flaky Valkey. A bad cache lookup
 *   should error in milliseconds, not freeze a request.
 */

const APP_CONNECT_TIMEOUT_MS = 2000;
const APP_COMMAND_TIMEOUT_MS = 1_000;

const baseConnection = () => ({
  host: env.VALKEY_HOST,
  port: env.VALKEY_PORT,
  ...(env.VALKEY_HOST === "localhost" && { family: 4 }),
  ...(env.VALKEY_PASSWORD !== "" && { password: env.VALKEY_PASSWORD }),
  db: env.VALKEY_DB,
});

export const getValkeyConnectionOptions = (): RedisOptions => ({
  ...baseConnection(),
  maxRetriesPerRequest: null,
});

interface IValkeyAppClientOverrides {
  connectTimeout?: number;
}

export const getValkeyAppClientOptions = (
  overrides: IValkeyAppClientOverrides = {}
): RedisOptions => ({
  ...baseConnection(),
  /*
   * Fail-fast profile. A single bad request shouldn't cascade into
   * stalled connections that block downstream callers.
   *
   * `lazyConnect` opens the socket on first command, capped by
   * `connectTimeout`. We KEEP `enableOfflineQueue` at its default (true)
   * so the first command waits for the in-flight lazy connect to
   * resolve instead of racing it — combining the two breaks the
   * publisher / cache / OAuth state on their very first call. The
   * `connectTimeout` is what bounds the wait; `maxRetriesPerRequest: 1`
   * bounds the retry loop. Together those give fail-fast semantics
   * without the race.
   */
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  connectTimeout: overrides.connectTimeout ?? APP_CONNECT_TIMEOUT_MS,
  /*
   * connectTimeout bounds the handshake; commandTimeout bounds every
   * command after it. Without it an established-but-slow Valkey delays
   * each cache / rate-limit / OAuth-state operation unboundedly.
   */
  commandTimeout: APP_COMMAND_TIMEOUT_MS,
});
