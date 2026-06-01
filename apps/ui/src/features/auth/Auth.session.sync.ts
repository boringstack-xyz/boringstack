import type { QueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

import { AUTH_QUERY_KEYS } from "./Auth.constants";
import { isAuthenticatedMe } from "./Auth.queries.utils";
import type { IMe } from "./Auth.types";

/**
 * After any flow that establishes a fresh session (login, MFA verify,
 * email verify, OAuth callback), fetch `/me` with short retries before
 * the consumer navigates away. Two failure modes this closes:
 *
 *   1. **Chromium cookie-commit lag** under Playwright. The login
 *      response sets `Set-Cookie`, but the browser sometimes hasn't
 *      committed it to the cookie jar by the time a follow-up fetch
 *      reads it back. `/me` then sees no cookie, returns
 *      `{user: null}`, the SPA interprets that as anonymous, and
 *      ProtectedRoute redirects back to /login. The retries ride out
 *      the commit window.
 *
 *   2. **Cache propagation gaps** in `jwtRevocationService` between
 *      `revokeAllForUser` (called during password reset) and
 *      `buildJWTPayload`'s `getUserRevokeCutoff` read on the immediate
 *      login. The iat-lift in `buildJWTPayload` already covers the
 *      common case; the retries here are the belt-and-suspenders for
 *      the rare miss.
 *
 * Returns the authed `IMe` if one is found within the retry budget,
 * `null` if /me persistently reports anonymous (legitimate logged-out
 * state). The caller decides whether to navigate or stay.
 */
export async function syncMeAfterSessionEstablished(
  qc: QueryClient
): Promise<IMe | null> {
  /*
   * Retry budget: 5 attempts at 30 ms apart = max ~150 ms blocking
   * before the navigation proceeds. The cookie commit usually lands
   * inside the first attempt; the budget covers the long-tail cases
   * Codex reproduced under Playwright (~1/3 failure rate).
   */
  const MAX_ATTEMPTS = 5;
  const BACKOFF_MS = 30;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const me = await qc.fetchQuery<IMe | null>({
      queryKey: AUTH_QUERY_KEYS.me,
      queryFn: async (): Promise<IMe | null> => {
        const { data } = await apiClient.GET("/api/v1/users/me");

        return isAuthenticatedMe(data) ? data : null;
      },
      /*
       * staleTime: 0 forces each iteration to actually hit the API.
       * After the loop exits, `useMe`'s own `staleTime: 60_000`
       * applies, so the cached value sticks past the navigation.
       */
      staleTime: 0
    });

    if (me !== null) {
      return me;
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, BACKOFF_MS);
      });
    }
  }

  return null;
}
