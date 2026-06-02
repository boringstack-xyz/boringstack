import { Redis } from "ioredis";
import type {
  Context as RateLimitContext,
  Options as RateLimitOptions,
} from "elysia-rate-limit";

import { getValkeyAppClientOptions } from "../../clients/valkey";
import { logger } from "../../config/logger";
import { getErrorMessage } from "../errors";
import { nowMs } from "../time/now";

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

interface IIncrementResult {
  count: number;
  nextReset: Date;
  start: number;
}

const RATE_LIMIT_KEY_PREFIX = "rl:";

/*
 * A non-positive window means rate limiting is failing open on every
 * request. `init()` already warns once at startup, but startup logs roll
 * off and the open state would then be invisible to alerting. Re-emit the
 * warning from the hot increment path, throttled to once per interval so a
 * persistent misconfiguration keeps an alert rule firing without flooding
 * the log on every request.
 */
const DISABLED_WARN_INTERVAL_MS = 60_000;

const buildKey = (rawKey: string): string =>
  `${RATE_LIMIT_KEY_PREFIX}${rawKey}`;

export class ValkeyRateLimitContext implements RateLimitContext {
  private readonly client: Redis;
  private durationMs = 0;
  private lastDisabledWarnMs = Number.NEGATIVE_INFINITY;

  constructor(client: Redis = new Redis(getValkeyAppClientOptions())) {
    this.client = client;

    this.client.on("error", (err: Error) => {
      logger.warn("Rate-limit Valkey client error", {
        event: "cache_valkey_error",
        error: err.message,
      });
    });
  }

  init(options: Omit<RateLimitOptions, "context">): void {
    const { duration } = options;

    if (typeof duration === "number" && duration > 0) {
      this.durationMs = duration;

      return;
    }

    /*
     * A non-positive/missing duration makes every request take the
     * permissive fallback path below — i.e. rate limiting is silently off.
     * That is a misconfiguration, not an infra blip, so surface it loudly
     * instead of failing open without a trace.
     */
    this.durationMs = 0;
    logger.warn(
      "Rate-limit duration is not a positive number; Valkey rate limiting is disabled",
      {
        event: "rate_limit_misconfigured",
        duration: typeof duration === "number" ? duration : null,
      }
    );
  }

  async increment(
    key: string,
    duration?: number,
    requestTime?: number
  ): Promise<IIncrementResult> {
    const fullKey = buildKey(key);
    const now = requestTime ?? nowMs();
    const durationMs = duration ?? this.durationMs;

    if (durationMs <= 0) {
      this.warnRateLimitingDisabled(now, durationMs);

      return this.permissiveFallback(now, durationMs);
    }

    try {
      const result = await this.client
        .multi()
        .incr(fullKey)
        .pexpire(fullKey, durationMs, "NX")
        .pttl(fullKey)
        .exec();

      if (result === null) {
        return this.permissiveFallback(now, durationMs);
      }

      const countCmd = result[0];
      const ttlCmd = result[2];

      if (!countCmd || !ttlCmd) {
        return this.permissiveFallback(now, durationMs);
      }

      const [countErr, countRaw] = countCmd;
      const [ttlErr, ttlRaw] = ttlCmd;

      if (countErr !== null || ttlErr !== null) {
        return this.permissiveFallback(now, durationMs);
      }

      const count = typeof countRaw === "number" ? countRaw : Number(countRaw);
      const ttlMs = typeof ttlRaw === "number" ? ttlRaw : Number(ttlRaw);

      if (Number.isNaN(count)) {
        return this.permissiveFallback(now, durationMs);
      }

      const nextResetMs = ttlMs > 0 ? now + ttlMs : now + durationMs;

      return {
        count,
        nextReset: new Date(nextResetMs),
        start: nextResetMs - durationMs,
      };
    } catch (error: unknown) {
      logger.warn("Rate-limit Valkey increment failed; allowing request", {
        event: "cache_valkey_error",
        error: getErrorMessage(error),
      });

      return this.permissiveFallback(now, durationMs);
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

  /*
   * Surface a non-positive window from the request path, throttled so a
   * persistent misconfiguration stays visible to alerting without flooding
   * the log. `now` is the request clock, so the throttle is deterministic.
   */
  private warnRateLimitingDisabled(now: number, durationMs: number): void {
    if (now - this.lastDisabledWarnMs < DISABLED_WARN_INTERVAL_MS) {
      return;
    }

    this.lastDisabledWarnMs = now;
    logger.warn(
      "Rate-limit window is non-positive; Valkey rate limiting is failing open",
      {
        event: "rate_limit_misconfigured",
        durationMs,
      }
    );
  }

  /**
   * Return a "first request in window" shape so the caller treats the
   * request as allowed. We choose permissive over restrictive on
   * infrastructure failure because the default Traefik edge rate limit
   * (`api-ratelimit` middleware) still protects against runaway abuse
   * even when Valkey is unhappy.
   */
  private permissiveFallback(
    requestTime = nowMs(),
    durationMs = this.durationMs
  ): IIncrementResult {
    return {
      count: 1,
      nextReset: new Date(requestTime + durationMs),
      start: requestTime,
    };
  }
}
