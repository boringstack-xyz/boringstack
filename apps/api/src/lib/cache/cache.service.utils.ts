import { env } from "../../config/env";
import { logger } from "../../config/logger";
import type { ICacheService } from "./cache.types";
import { MemoryCacheService } from "./providers/memory";
import { NoopCacheService } from "./providers/noop";
import { ValkeyCacheService } from "./providers/valkey";

/**
 * Selects the cache provider based on env flags:
 *
 *   CACHE_ENABLED=false           → NoopCacheService (always-miss)
 *   CACHE_PROVIDER=memory         → MemoryCacheService (per-process Map)
 *   CACHE_PROVIDER=valkey         → ValkeyCacheService (shared across replicas)
 *
 * Callers should always use `cacheService`. Switching providers never
 * requires changing call sites.
 */
export const buildCacheService = (): ICacheService => {
  if (!env.CACHE_ENABLED) {
    return new NoopCacheService();
  }

  switch (env.CACHE_PROVIDER) {
    case "memory":
      logger.info("Cache initialized: in-memory (single-process only)", {
        event: "cache_initialized",
        provider: "memory",
      });

      return new MemoryCacheService();
    case "valkey":
      logger.info("Cache initialized: valkey", {
        event: "cache_initialized",
        provider: "valkey",
        host: env.VALKEY_HOST,
        port: env.VALKEY_PORT,
      });

      return new ValkeyCacheService();
  }
};
