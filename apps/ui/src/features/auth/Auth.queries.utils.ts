import type { UseQueryResult } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";

import type { AuthStatus } from "./Auth.queries.utils.types";
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

/*
 * Discriminator helper: maps a TanStack Query result for `useMe` to
 * one of four states. `ProtectedRoute` and `OfflineFallback` are the
 * primary consumers. The `AuthStatus` union lives in the sibling
 * `.types.ts` file (module-boundaries rule).
 */
export function resolveAuthStatus(
  result: Pick<UseQueryResult<IMe | null>, "data" | "error">
): AuthStatus | null {
  if (result.error !== null) {
    if (
      result.error instanceof ApiError &&
      (result.error.isUnauthorized || result.error.isForbidden)
    ) {
      return { kind: "unauthorized", error: result.error };
    }

    return { kind: "offline", error: result.error };
  }

  if (result.data === undefined) {
    return null;
  }

  if (result.data === null) {
    return { kind: "anonymous" };
  }

  return { kind: "authed", me: result.data };
}
