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

## Namespaces that change under you

A read cache over reference data (a catalog, a plan table) should not wait
for its TTL when a seed, an admin publish or a migration changes the data.
Put the namespace's generation in every read key and bump it from every
write path:

```ts
import { bumpGeneration, generationScopedKey } from "../../lib/cache";

// reader
const key = await generationScopedKey("catalog", "list", digest);
const items = await cacheService.wrap(key, load, { ttlSeconds: 3600 });

// seed, publish, migration
await bumpGeneration("catalog");
```

A bump makes every old key unreachable at once; the entries age out on
their own TTL. `readGeneration(namespace)` exposes the counter for keys
built elsewhere. Seeds must be idempotent and must bump, otherwise a
pre-seed empty list stays cached until it expires.

## Lint contract

The `cache-keys` plugin requires:

- `ttlSeconds` on every `.set` (no unbounded entries → no Valkey OOM).
- Keys carry a namespace prefix (`cache:`, `stripe:`, `session:`,
  `rate:`, `oauth:`) — prevents collisions on shared Valkey.

## Provider toggle

`CACHE_ENABLED` + `CACHE_PROVIDER` (`memory`, `valkey`). The memory
provider is process-local — use Valkey for production deployments with

> 1 replica.
