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
];

/** Browser preflight cache TTL in seconds (24h). */
export const CORS_MAX_AGE_SECONDS = 86_400;
