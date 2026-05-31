import { nowMs } from "../../time/now";
import type {
  CacheProviderName,
  ICacheService,
  ICacheSetOptions,
} from "../cache.types";

/**
 * Process-local cache used in development, tests, and as the default
 * fallback when `CACHE_ENABLED=false`. Not safe across multiple processes
 * — use the Valkey provider in production deployments with > 1 replica.
 */
export class MemoryCacheService implements ICacheService {
  public readonly providerName: CacheProviderName = "memory";
  private readonly store = new Map<
    string,
    { value: unknown; expiresAt: number | null }
  >();

  private isExpired(entry: {
    value: unknown;
    expiresAt: number | null;
  }): boolean {
    return entry.expiresAt !== null && entry.expiresAt <= nowMs();
  }

  get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);

    if (!entry) {
      return Promise.resolve(null);
    }

    if (this.isExpired(entry)) {
      this.store.delete(key);

      return Promise.resolve(null);
    }

    return Promise.resolve(entry.value as T);
  }

  set(key: string, value: unknown, options?: ICacheSetOptions): Promise<void> {
    const expiresAt =
      options?.ttlSeconds !== undefined
        ? nowMs() + options.ttlSeconds * 1000
        : null;

    this.store.set(key, { value, expiresAt });

    return Promise.resolve();
  }

  del(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      for (const k of key) {
        this.store.delete(k);
      }
    } else {
      this.store.delete(key);
    }

    return Promise.resolve();
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
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

  close(): Promise<void> {
    this.store.clear();

    return Promise.resolve();
  }
}
