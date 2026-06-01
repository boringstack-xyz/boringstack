export type CacheProviderName = "memory" | "valkey" | "noop";

export interface ICacheSetOptions {
  /** Time-to-live in seconds. Omit for no expiration. */
  ttlSeconds?: number;
}

export interface ICacheService {
  /** Returns the cached value or `null` when absent / expired. */
  get: <T>(key: string) => Promise<T | null>;

  /** Stores a value, JSON-serialized in non-memory providers. */
  set: (
    key: string,
    value: unknown,
    options?: ICacheSetOptions
  ) => Promise<void>;

  /** Deletes one or more keys. */
  del: (key: string | string[]) => Promise<void>;

  /** True when the key is present and not expired. */
  has: (key: string) => Promise<boolean>;

  /**
   * Read-through helper: returns the cached value when present, otherwise
   * runs `factory()`, caches the result, and returns it.
   *
   * Concurrent callers may each invoke `factory` once — this is intentional
   * to keep the implementation lock-free across multiple processes. Use a
   * dedicated lock if duplicate work would be expensive.
   */
  wrap: <T>(
    key: string,
    factory: () => Promise<T>,
    options?: ICacheSetOptions
  ) => Promise<T>;

  /** Best-effort connection close used during graceful shutdown. */
  close: () => Promise<void>;

  /** Identifies which provider is active (for logging / health checks). */
  readonly providerName: CacheProviderName;
}
