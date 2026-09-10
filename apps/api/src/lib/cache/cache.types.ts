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
   * Atomically adds one to a counter and returns the new value, setting
   * `ttlSeconds` only when the counter is created.
   *
   * Read-modify-write through `get` + `set` is not equivalent, and the
   * difference is a security boundary: concurrent callers all read the same
   * value and all write value+1, so an N-attempt budget enforced that way
   * yields far more than N attempts under load. The TTL applies on creation
   * only, so incrementing a counter cannot hold its window open.
   */
  increment: (key: string, ttlSeconds?: number) => Promise<number>;

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
