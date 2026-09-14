/**
 * Query keys for TanStack Query cache invalidation.. The session key
 * (`/me`) lives in `@/lib/session`. Endpoint paths are not
 * duplicated here: they're consumed directly from the OpenAPI schema by the
 * typed `apiClient.GET("/api/v1/users/me")` calls in Auth.queries.ts.
 */
export const AUTH_QUERY_KEYS = {
  mfaStatus: ["auth", "mfa", "status"] as const
};
