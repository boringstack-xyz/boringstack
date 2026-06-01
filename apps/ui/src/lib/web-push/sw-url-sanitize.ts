/*
 * URL sanitization for the Web Push service worker.
 *
 * The push payload's `url` field is untrusted: it travels through the
 * transport, the browser push service, and our own queue before reaching
 * the worker. A malicious or buggy payload could otherwise redirect a
 * focused tab off-origin or trick `client.url.includes(...)` substring
 * matching into focusing the wrong window.
 *
 * KEEP IN SYNC with the inlined copy at `public/sw.js`. The worker is a
 * classic script (no ES module imports) so it cannot import from this
 * module at runtime — both implementations must mirror each other. Tests
 * in `tests/sw/sw.test.ts` exercise the TS surface.
 */

/**
 * Reduce an inbound payload URL to a safe same-origin app path.
 * Returns "/" when the input is missing, malformed, or off-origin.
 */
export function sanitizeTargetPath(rawUrl: unknown, origin: string): string {
  if (typeof rawUrl !== "string" || rawUrl === "") {
    return "/";
  }

  try {
    const parsed = new URL(rawUrl, origin);

    if (parsed.origin !== origin) {
      return "/";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

/** Exact same-origin path/search/hash compare. No substring matching. */
export function clientPathMatches(
  clientUrl: string,
  targetPath: string,
  origin: string
): boolean {
  try {
    const parsed = new URL(clientUrl);

    if (parsed.origin !== origin) {
      return false;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}` === targetPath;
  } catch {
    return false;
  }
}
