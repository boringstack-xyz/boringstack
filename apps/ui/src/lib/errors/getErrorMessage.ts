/**
 * Extract a stable string from an unknown error without dropping its cause
 * chain. Use this anywhere the `structured-logging` plugin would otherwise
 * flag a `String(err)` / `err.toString()` / `${err}` call.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.cause instanceof Error) {
      return `${error.message} (cause: ${error.cause.message})`;
    }

    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}
