import { cacheService } from "./cache.service";

/*
 * Generation-scoped cache keys.
 *
 * Read caches over slowly changing reference data (a catalog, a plan
 * table) want a long TTL, but every write path that changes the data has
 * to be able to drop the whole namespace at once: a seed, an admin
 * publish, a migration. Deleting keys one by one does not work when the
 * keys carry request digests, so the namespace carries a generation
 * number instead. Readers put the current generation in every key;
 * writers bump it, and every old key becomes unreachable and ages out.
 */
const generationKey = (namespace: string): string =>
  `cache:generation:${namespace}`;

/** Current generation of a namespace; a namespace nobody bumped is at 0. */
export const readGeneration = async (namespace: string): Promise<number> =>
  (await cacheService.get<number>(generationKey(namespace))) ?? 0;

/**
 * Invalidates every generation-scoped key of the namespace at once and
 * returns the new generation. Atomic across replicas with the Valkey
 * provider; call it from every write path that changes the cached data.
 */
export const bumpGeneration = async (namespace: string): Promise<number> =>
  cacheService.increment(generationKey(namespace));

/**
 * Builds a read key that includes the namespace's current generation:
 * `cache:<namespace>:v<generation>:<part>:<part>`.
 */
export const generationScopedKey = async (
  namespace: string,
  ...parts: readonly string[]
): Promise<string> =>
  [
    `cache:${namespace}`,
    `v${String(await readGeneration(namespace))}`,
    ...parts,
  ].join(":");
