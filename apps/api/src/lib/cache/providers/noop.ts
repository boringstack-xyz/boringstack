import type {
  CacheProviderName,
  ICacheService,
  ICacheSetOptions,
} from "../cache.types";

/**
 * Always-miss cache used when `CACHE_ENABLED=false`. Lets callers stay
 * unconditional (`cache.wrap(...)`) without a runtime null check on the
 * cache instance — every call falls straight through to `factory()`.
 *
 * All methods are genuinely synchronous; they return pre-resolved
 * promises only to satisfy the async `ICacheService` contract.
 */
export class NoopCacheService implements ICacheService {
  public readonly providerName: CacheProviderName = "noop";

  get<T>(_key: string): Promise<T | null> {
    return Promise.resolve(null);
  }

  set(
    _key: string,
    _value: unknown,
    _options?: ICacheSetOptions
  ): Promise<void> {
    return Promise.resolve();
  }

  del(_key: string | string[]): Promise<void> {
    return Promise.resolve();
  }

  has(_key: string): Promise<boolean> {
    return Promise.resolve(false);
  }

  /*
   * Always 1: nothing is stored, so every increment is the first. A caller
   * enforcing an attempt budget against this provider gets no enforcement
   * at all — which is why production refuses `CACHE_ENABLED=false`
   * alongside fail-closed revocation (`config/env/validate.ts`,
   * `checkRevocationHasDurableStore`).
   */
  increment(_key: string, _ttlSeconds?: number): Promise<number> {
    return Promise.resolve(1);
  }

  wrap<T>(
    _key: string,
    factory: () => Promise<T>,
    _options?: ICacheSetOptions
  ): Promise<T> {
    return factory();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}
