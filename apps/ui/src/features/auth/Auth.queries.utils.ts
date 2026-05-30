import type { IMe } from "./Auth.types";

/*
 * `/api/v1/users/me` returns a discriminated union: `{ user: null }` for
 * anonymous callers and the full session payload for authenticated ones.
 * openapi-fetch widens the response type with empty-content-type branches
 * which makes direct field narrowing brittle — this typeguard collapses
 * the messy union to a clean `IMe | null` decision.
 */
export function isAuthenticatedMe(data: unknown): data is IMe {
  return (
    data !== null &&
    typeof data === "object" &&
    "user" in data &&
    data.user !== null
  );
}
