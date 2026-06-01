/**
 * CORS policy values. Security headers (CSP, HSTS, X-Frame-Options, etc.) are
 * NOT set here — they come from Traefik in the production stack. See
 * `infra/compose/compose/docker-compose.production-labels.yml`
 * for the single source of truth.
 *
 * In same-origin deployments (BoringStack's default), ALLOWED_ORIGINS is
 * empty and the CORS middleware below is not mounted at all.
 */

export const CORS_METHODS = [
  "GET",
  "PUT",
  "POST",
  "PATCH",
  "DELETE",
  "OPTIONS",
];

export const CORS_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Requested-With",
  /*
   * Sentry browser SDK writes both the Sentry-native and W3C trace
   * headers on outbound fetches when `browserTracingIntegration` is on
   * (see apps/ui/src/app/main.tsx). Without these in the allowlist the
   * cross-origin preflight rejects the request before it ever reaches
   * the API, and the SPA degrades to untraced calls.
   */
  "sentry-trace",
  "baggage",
  "traceparent",
];

/**
 * Response headers the browser is allowed to expose to JS via
 * `response.headers.get(...)`. Same-origin reads them unconditionally;
 * cross-origin needs an explicit allowlist. `x-request-id` is the
 * forensic id our error toasts surface — without it, "ask support for
 * request id X" breaks the moment the API runs on a different host.
 */
export const CORS_EXPOSED_HEADERS = ["x-request-id"];

/** Browser preflight cache TTL in seconds (24h). */
export const CORS_MAX_AGE_SECONDS = 86_400;
