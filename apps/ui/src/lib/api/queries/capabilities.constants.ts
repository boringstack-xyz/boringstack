export const CAPABILITIES_QUERY_KEY = ["capabilities"] as const;

/** Capabilities are stable per deploy but may change without a full reload. */
export const CAPABILITIES_STALE_MS = 5 * 60 * 1000;
export const CAPABILITIES_GC_MS = 30 * 60 * 1000;
