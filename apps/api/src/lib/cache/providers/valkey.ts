import { Redis } from "ioredis";
import { getValkeyAppClientOptions } from "../../../clients/valkey";
import { logger } from "../../../config/logger";
import { getErrorMessage } from "../../errors";
import type {
  CacheProviderName,
  ICacheService,
  ICacheSetOptions,
} from "../cache.types";

/**
 * Valkey-backed cache. Uses `ioredis` (the canonical Redis-protocol client
 * for Node/Bun); Valkey speaks the same wire protocol, so the library name
 * is incidental.
 */
export class ValkeyCacheService implements ICacheService {
  private static readonly keyPrefix = "cache:";

  public readonly providerName: CacheProviderName = "valkey";
  private client: Redis | null = null;

  private buildKey(key: string): string {
    return `${ValkeyCacheService.keyPrefix}${key}`;
  }

  private getClient(): Redis {
    if (this.client !== null) {
      return this.client;
    }

    const redisClient = new Redis(getValkeyAppClientOptions());

    redisClient.on("error", (err: Error) => {
      logger.error("Valkey cache client error", {
        event: "cache_valkey_error",
        error: err.message,
      });
    });

    this.client = redisClient;

    return redisClient;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.getClient().get(this.buildKey(key));

    if (raw === null) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error: unknown) {
      logger.warn("Failed to JSON.parse cached value; treating as miss", {
        event: "cache_parse_error",
        key,
        error: getErrorMessage(error),
      });

      return null;
    }
  }

  async set(
    key: string,
    value: unknown,
    options?: ICacheSetOptions
  ): Promise<void> {
    const serialized = JSON.stringify(value);

    if (options?.ttlSeconds !== undefined) {
      await this.getClient().set(
        this.buildKey(key),
        serialized,
        "EX",
        options.ttlSeconds
      );

      return;
    }

    await this.getClient().set(this.buildKey(key), serialized);
  }

  async del(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key)
      ? key.map((k) => this.buildKey(k))
      : [this.buildKey(key)];

    if (keys.length === 0) {
      return;
    }

    await this.getClient().del(...keys);
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.getClient().exists(this.buildKey(key));

    return exists === 1;
  }

  async wrap<T>(
    key: string,
    factory: () => Promise<T>,
    options?: ICacheSetOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const fresh = await factory();

    await this.set(key, fresh, options);

    return fresh;
  }

  async close(): Promise<void> {
    if (this.client === null) {
      return;
    }

    if (this.client.status === "ready") {
      await this.client.quit();
      this.client = null;

      return;
    }

    this.client.disconnect();
    this.client = null;
  }
}
