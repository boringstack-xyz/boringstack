import type { UseQueryResult } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import type { IMe } from "@/lib/session";

import type { AuthStatus } from "./Auth.queries.utils.types";

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
