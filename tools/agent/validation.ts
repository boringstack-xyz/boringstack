/** JSON and filesystem errors cross a trust boundary; narrow them before use. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRecord(source: string): Record<string, unknown> {
  const value: unknown = JSON.parse(source);

  if (!isRecord(value)) {
    throw new Error("Expected a JSON object");
  }

  return value;
}

export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((entry: unknown) => typeof entry === "string")
  );
}

export function errorHasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export function requireValue<T>(value: T | undefined, description: string): T {
  if (value === undefined) {
    throw new Error(description);
  }

  return value;
}

/** Read mutable abort state at each boundary rather than narrowing it across awaits. */
export function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}
