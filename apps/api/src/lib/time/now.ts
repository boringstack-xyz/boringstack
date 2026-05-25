/*
 * The canonical wall-clock used everywhere a timestamp is captured.
 *
 * Why this exists: tests mock one site, format changes happen in one
 * place, and `rg "now\("` enumerates every "capture the current moment"
 * call site. Inline `new Date().toISOString()` is forbidden by
 * `no-restricted-syntax` in the ESLint config.
 */
export function now(): string {
  return new Date().toISOString();
}
