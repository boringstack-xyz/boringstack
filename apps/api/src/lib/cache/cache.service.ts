import type { ICacheService } from "./cache.types";
import { buildCacheService } from "./cache.service.utils";

export const cacheService: ICacheService = buildCacheService();
