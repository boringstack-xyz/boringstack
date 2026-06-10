/**
 * Per-email rate limiter for endpoints that trigger external email delivery
 * (resend-verification, forgot-password) — caps inbox-spam attacks from
 * distributed IPs.
 *
 * Two backends, selected by config (mirroring `security.ts`'s rate-limit
 * context choice):
 *
 *   - **Valkey** when `CACHE_ENABLED && CACHE_PROVIDER === "valkey"`: a shared
 *     counter so the quota holds across replicas. A per-process limiter is
 *     bypassable under horizontal scale — an attacker just rotates which
 *     replica they hit, multiplying the real cap by the replica count.
 *   - **In-memory** otherwise (the single-process default of this template),
 *     and as the fallback when a Valkey call fails — so a cache blip degrades
 *     to per-process enforcement rather than no enforcement at all.
 */
import { Redis } from "ioredis";

import { getValkeyAppClientOptions } from "../../clients/valkey";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { getErrorMessage } from "../errors";
import { nowMs } from "../time/now";

const WINDOW_MS = 300_000; // 5 minutes
const MAX_ATTEMPTS = 3;
const SWEEP_INTERVAL_MS = 600_000; // 10 minutes
const KEY_PREFIX = "erl:";

class InMemoryEmailRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  constructor() {
    setInterval(() => {
      this.sweep();
    }, SWEEP_INTERVAL_MS).unref();
  }

  check(key: string): boolean {
    const now = nowMs();
    const timestamps = this.attempts.get(key) ?? [];
    const valid = timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);

    if (valid.length >= MAX_ATTEMPTS) {
      this.attempts.set(key, valid);

      return false;
    }

    valid.push(now);
    this.attempts.set(key, valid);

    return true;
  }

  /**
   * Housekeeping: sweep the map periodically so it doesn't grow forever.
   * Called automatically every 10 minutes; safe to call manually in tests.
   */
  sweep(): void {
    const now = nowMs();

    for (const [key, timestamps] of this.attempts) {
      const valid = timestamps.filter(
        (timestamp) => now - timestamp < WINDOW_MS
      );

      if (valid.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, valid);
      }
    }
  }
}

class ValkeyEmailRateLimiter {
  private client: Redis | null = null;
  private readonly fallback: InMemoryEmailRateLimiter;

  constructor(fallback: InMemoryEmailRateLimiter) {
    this.fallback = fallback;
  }

  private getClient(): Redis {
    if (this.client !== null) {
      return this.client;
    }

    const client = new Redis(getValkeyAppClientOptions());

    client.on("error", (err: Error) => {
      logger.warn("Email rate-limit Valkey client error", {
        event: "cache_valkey_error",
        error: err.message,
      });
    });

    this.client = client;

    return client;
  }

  /**
   * Fixed-window counter: INCR the key, set its TTL only on the first write
   * (PEXPIRE NX), and allow while the count is within the cap. Any Valkey
   * failure falls back to the in-memory limiter so enforcement never silently
   * drops to nothing.
   */
  async check(key: string): Promise<boolean> {
    const fullKey = `${KEY_PREFIX}${key}`;

    try {
      const result = await this.getClient()
        .multi()
        .incr(fullKey)
        .pexpire(fullKey, WINDOW_MS, "NX")
        .exec();

      if (result === null) {
        return this.fallback.check(key);
      }

      const countCmd = result[0];

      if (!countCmd) {
        return this.fallback.check(key);
      }

      const [countErr, countRaw] = countCmd;

      if (countErr !== null) {
        return this.fallback.check(key);
      }

      const count = typeof countRaw === "number" ? countRaw : Number(countRaw);

      if (Number.isNaN(count)) {
        return this.fallback.check(key);
      }

      return count <= MAX_ATTEMPTS;
    } catch (error: unknown) {
      logger.warn(
        "Email rate-limit Valkey check failed; falling back to in-memory",
        {
          event: "cache_valkey_error",
          error: getErrorMessage(error),
        }
      );

      return this.fallback.check(key);
    }
  }
}

class EmailRateLimiter {
  private readonly inMemory = new InMemoryEmailRateLimiter();
  private readonly valkey = new ValkeyEmailRateLimiter(this.inMemory);

  /**
   * Returns `true` when the email is allowed another attempt, `false` when it
   * has exhausted its window. Email is normalized (trim + lowercase) so casing
   * and whitespace share one bucket.
   */
  check(email: string): Promise<boolean> {
    const key = email.toLowerCase().trim();

    if (env.CACHE_ENABLED && env.CACHE_PROVIDER === "valkey") {
      return this.valkey.check(key);
    }

    return Promise.resolve(this.inMemory.check(key));
  }

  sweep(): void {
    this.inMemory.sweep();
  }
}

export const emailRateLimiter = new EmailRateLimiter();
