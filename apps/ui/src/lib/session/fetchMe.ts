import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import type { IMe } from "./session.types";
import { isAuthenticatedMe } from "./session.utils";

/*
 * Reads the current session. Returns null when the caller is logged out.
 *
 * Two shapes mean logged out: `200 { user: null }` (no session cookie) and a
 * 401 that survived the refresh middleware (the access cookie expired and the
 * refresh cookie is gone or was refused). The middleware has already tried a
 * silent refresh and retried `/me` by the time a 401 reaches this function, so
 * it is not retried here. Other failures (network, 5xx) still throw.
 */
export async function fetchCurrentMe(): Promise<IMe | null> {
  try {
    const { data } = await apiClient.GET("/api/v1/users/me");

    return isAuthenticatedMe(data) ? data : null;
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) {
      return null;
    }

    throw error;
  }
}
