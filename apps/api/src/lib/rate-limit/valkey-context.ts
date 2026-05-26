import { Redis } from "ioredis";

import { getValkeyAppClientOptions } from "../../clients/valkey";
import { logger } from "../../config/logger";
import { getErrorMessage } from "../errors";

/**
 * Valkey-backed `Context` for elysia-rate-limit. Replace the default
 * in-memory context with this when running more than one replica —
 * otherwise each replica enforces its own quota and a brute-force
 * attacker just rotates which instance they hit.
 *
 * Semantics match the default `DefaultContext`:
 *
 *   - `increment(key)`: bumps the counter, returns `{ count, nextReset }`.
 *     First write of a key sets the TTL; subsequent writes preserve it.
 *   - `decrement(key)`: lowers the counter (used when the wrapped
 *     handler reports success and `countFailedRequest=true`).
 *   - `reset(key?)`: drops one or all keys (only used by tests).
 *   - `kill()`: closes the ioredis client during graceful shutdown.
 *
 * The implementation deliberately keeps the network round-trip small —
 * one `MULTI` + `INCR` + `PEXPIRE` + `PTTL` per request — so a hot path
 * costs a single pipelined call. We tolerate a Valkey blip by treating
 * the failure as "request allowed" instead of "request blocked": the
 * default is "more permissive on infra failure, not less" so a flaky
 * cache doesn't lock real users out.
 */

interface IInitOptions {
  duration: number;
}

interface IIncrementResult {
  count: number;
  nextReset: Date;
}

const RATE_LIMIT_KEY_PREFIX = "rl:";

const buildKey = (rawKey: string): string =>
  `${RATE_LIMIT_KEY_PREFIX}${rawKey}`;

export class ValkeyRateLimitContext {
  private readonly client: Redis;
  private durationMs = 0;

  constructor(client: Redis = new Redis(getValkeyAppClientOptions())) {
    this.client = client;

    this.client.on("error", (err: Error) => {
      logger.warn("Rate-limit Valkey client error", {
        event: "cache_valkey_error",
        error: err.message,
      });
    });
  }

  init(options: IInitOptions): void {
    this.durationMs = options.duration;
  }

  async increment(key: string): Promise<IIncrementResult> {
    const fullKey = buildKey(key);

    try {
      const result = await this.client
        .multi()
        .incr(fullKey)
        .pexpire(fullKey, this.durationMs, "NX")
        .pttl(fullKey)
        .exec();

      if (result === null) {
        return this.permissiveFallback();
      }

      const countCmd = result[0];
      const ttlCmd = result[2];

      if (!countCmd || !ttlCmd) {
        return this.permissiveFallback();
      }

      const [countErr, countRaw] = countCmd;
      const [ttlErr, ttlRaw] = ttlCmd;

      if (countErr !== null || ttlErr !== null) {
        return this.permissiveFallback();
      }

      const count = typeof countRaw === "number" ? countRaw : Number(countRaw);
      const ttlMs = typeof ttlRaw === "number" ? ttlRaw : Number(ttlRaw);

      if (Number.isNaN(count)) {
        return this.permissiveFallback();
      }

      const nextResetMs =
        ttlMs > 0 ? Date.now() + ttlMs : Date.now() + this.durationMs;

      return { count, nextReset: new Date(nextResetMs) };
    } catch (error: unknown) {
      logger.warn("Rate-limit Valkey increment failed; allowing request", {
        event: "cache_valkey_error",
        error: getErrorMessage(error),
      });

      return this.permissiveFallback();
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await this.client.decr(buildKey(key));
    } catch (error: unknown) {
      logger.warn("Rate-limit Valkey decrement failed", {
        event: "cache_valkey_error",
        error: getErrorMessage(error),
      });
    }
  }

  async reset(key?: string): Promise<void> {
    if (key !== undefined) {
      await this.client.del(buildKey(key));

      return;
    }

    const stream = this.client.scanStream({
      match: `${RATE_LIMIT_KEY_PREFIX}*`,
    });

    for await (const batch of stream) {
      const keys = Array.isArray(batch)
        ? batch.filter((value): value is string => typeof value === "string")
        : [];

      if (keys.length > 0) {
        await this.client.del(keys);
      }
    }
  }

  async kill(): Promise<void> {
    if (this.client.status === "ready") {
      await this.client.quit();

      return;
    }

    this.client.disconnect();
  }

  /**
   * Return a "first request in window" shape so the caller treats the
   * request as allowed. We choose permissive over restrictive on
   * infrastructure failure because the default Traefik edge rate limit
   * (`api-ratelimit` middleware) still protects against runaway abuse
   * even when Valkey is unhappy.
   */
  private permissiveFallback(): IIncrementResult {
    return {
      count: 1,
      nextReset: new Date(Date.now() + this.durationMs),
    };
  }
}
