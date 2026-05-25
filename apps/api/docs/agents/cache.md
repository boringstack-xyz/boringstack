# Cache

Read this when adding a new cache read/write or a new cache key
namespace.

## Reading + writing

```ts
import { cacheService } from "../../lib/cache";

const cached = await cacheService.get<Widget>(widgetCacheKey(id));
if (cached) return cached;

const widget = await db.query.widgets.findFirst({ where: eq(widgets.id, id) });
if (widget) {
  await cacheService.set(widgetCacheKey(id), widget, { ttlSeconds: 300 });
}
```

## Lint contract

The `cache-keys` plugin requires:

- `ttlSeconds` on every `.set` (no unbounded entries → no Valkey OOM).
- Keys carry a namespace prefix (`cache:`, `stripe:`, `session:`,
  `rate:`, `oauth:`) — prevents collisions on shared Valkey.

## Provider toggle

`CACHE_ENABLED` + `CACHE_PROVIDER` (`memory`, `valkey`). The memory
provider is process-local — use Valkey for production deployments with

> 1 replica.
