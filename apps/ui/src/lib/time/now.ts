/*
 * The canonical wall-clock used everywhere a timestamp is captured.
 *
 * Why this exists: tests mock one site, format changes happen in one
 * place, and `rg "now\("` enumerates every "capture the current moment"
 * call site. Inline `new Date().toISOString()` is forbidden by
 * `no-restricted-syntax` in the ESLint config; bare `Date.now()` is
 * forbidden by `code-flow/no-bare-date-now`.
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Epoch milliseconds form of {@link now}. The numeric variant used
 * wherever code measures elapsed time, compares against an expiry,
 * or feeds a `new Date(ms)` parser.
 */
export function nowMs(): number {
  return Date.now();
}
