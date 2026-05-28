/**
 * Generic type guard for "is this a non-null object I can index by
 * string?". Used at parser boundaries (JSON envelopes, router state,
 * arbitrary `unknown`) before further narrowing.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
