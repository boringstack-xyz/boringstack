import createClient, { type Middleware } from "openapi-fetch";

import { env } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { logger } from "@/lib/logger/logger";

import { ApiError } from "./ApiError";
import type { IApiErrorBody } from "./ApiError.types";
import type { paths } from "./schema";

const BASE_URL = env.VITE_API_URL.replace(/\/$/, "");

/*
 * ----------------------------------------------------------------------------
 * Token refresh — silent retry on 401.
 *
 * Why this exists: HTTP-only session cookies expire. Without this, every
 * expired-token API call kicks the user back to /login mid-task. With this,
 * the UI quietly calls /api/v1/auth/refresh once and retries the original
 * request.
 *
 * Loop guard: requests to /auth/refresh + /auth/login themselves never
 * trigger a refresh. If refresh fails, the original 401 propagates and
 * ProtectedRoute redirects to /login.
 *
 * Concurrency: multiple requests can hit 401 at the same time (e.g. dashboard
 * loads 4 queries in parallel). `inFlightRefresh` is a module-level promise
 * so all of them join the same refresh — not 4 parallel refreshes.
 * ----------------------------------------------------------------------------
 */

let inFlightRefresh: Promise<boolean> | null = null;

/*
 * `/auth/refresh` returns 200 with `{ success, data: { user: User | null },
 * timestamp }`. The auth cookie is rotated server-side via httpOnly Set-Cookie;
 * the body itself never carries a token. `data.user !== null` is the
 * discriminator between a real refresh and an anonymous probe (no refresh
 * cookie present). Treating `response.ok` alone as success retries the SSE
 * reconnect loop indefinitely after logout because the anonymous probe is
 * also a 200.
 */
function getProp(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }

  return Reflect.get(value, key);
}

async function readSessionUserId(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.clone().json();
    const userId = getProp(getProp(getProp(body, "data"), "user"), "id");

    if (typeof userId === "string" && userId.length > 0) {
      return userId;
    }

    return null;
  } catch {
    return null;
  }
}

export async function performRefresh(): Promise<boolean> {
  inFlightRefresh ??= (async (): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include"
      });

      if (!response.ok) {
        logger.info({ event: "auth.refresh_attempt", success: false });

        return false;
      }

      const userId = await readSessionUserId(response);
      const success = userId !== null;

      logger.info({ event: "auth.refresh_attempt", success });

      return success;
    } catch (cause) {
      logger.warn({
        event: "auth.refresh_failed",
        error: getErrorMessage(cause)
      });

      return false;
    } finally {
      /*
       * Reset on the next microtask so concurrent callers all see the same
       * promise but a fresh refresh fires on the next 401 wave.
       */
      queueMicrotask(() => {
        inFlightRefresh = null;
      });
    }
  })();

  return inFlightRefresh;
}

function isRefreshableEndpoint(url: string): boolean {
  return !url.includes("/auth/refresh") && !url.includes("/auth/login");
}

const tokenRefresh: Middleware = {
  onResponse: async ({ response, request }) => {
    if (response.status !== 401) {
      return response;
    }

    if (!isRefreshableEndpoint(request.url)) {
      return response;
    }

    const refreshed = await performRefresh();

    if (!refreshed) {
      return response;
    }

    /*
     * Re-issue the original request. `Request` is single-use after its body
     * is read, but openapi-fetch hasn't consumed the body yet at this point,
     * so a clone is enough. Falling back to the original lets reads-without-
     * body (GET, DELETE) work too.
     */
    const retryInit: RequestInit = {
      method: request.method,
      headers: request.headers,
      credentials: "include",
      body: ["GET", "HEAD"].includes(request.method)
        ? null
        : await request.clone().text()
    };

    return fetch(request.url, retryInit);
  }
};

/*
 * ----------------------------------------------------------------------------
 * Throw-on-error — bridges openapi-fetch's `{ data, error, response }` shape
 * to TanStack Query's "throw to signal failure" expectation. Runs AFTER
 * `tokenRefresh` so a transparent retry has a chance first.
 * ----------------------------------------------------------------------------
 */

/*
 * The api always envelopes errors as `{ success: false, error: { code,
 * message, fieldErrors?, timestamp } }`. The flat `IApiErrorBody` shape
 * (no envelope) is retained as a fallback for any non-enveloped 4xx that
 * slips through — opaque proxy errors, 502s from edge, etc. — so the
 * caller always sees a usable code/message instead of `undefined`.
 */
const extractApiErrorBody = (raw: unknown): IApiErrorBody => {
  if (typeof raw !== "object" || raw === null) {
    return { message: "Unknown error" };
  }

  if ("error" in raw) {
    const nested: unknown = raw.error;

    if (typeof nested === "object" && nested !== null) {
      return nested as IApiErrorBody;
    }
  }

  return raw as IApiErrorBody;
};

const throwOnError: Middleware = {
  onResponse: async ({ response }) => {
    if (response.ok) {
      return response;
    }

    const requestId = response.headers.get("x-request-id") ?? undefined;
    let body: IApiErrorBody = { message: response.statusText };

    try {
      const text = await response.clone().text();

      if (text !== "") {
        body = extractApiErrorBody(JSON.parse(text));
      }
    } catch (cause) {
      logger.warn({
        event: "api.error_parse_failed",
        status: response.status,
        error: getErrorMessage(cause)
      });
    }

    throw new ApiError(response.status, {
      message: body.message,
      code: body.code,
      fieldErrors: body.fieldErrors,
      details: body.details,
      requestId
    });
  }
};

/**
 * The typed OpenAPI client. All HTTP goes through this — components and hooks
 * call typed methods that match the spec.
 *
 *   const { data } = await openapi.GET("/api/v1/users/me");
 *   //      ^? { id, email, firstName, lastName, emailVerified, role, ... }
 *
 * On non-2xx responses an `ApiError` is thrown (see throwOnError middleware).
 * On 401 the client silently attempts `/auth/refresh` once and retries the
 * original request (see tokenRefresh middleware).
 */
export const openapi = createClient<paths>({
  baseUrl: BASE_URL,
  credentials: "include"
});

/*
 * Middleware order matters. openapi-fetch runs `onResponse` middlewares in
 * REVERSE registration order (last-added runs first), so registering
 * `throwOnError` BEFORE `tokenRefresh` is correct: tokenRefresh sees the 401
 * first, retries transparently if the refresh succeeds, and only then does
 * throwOnError see the final (post-retry) response.
 */
openapi.use(throwOnError);
openapi.use(tokenRefresh);

/*
 * Web Push subscription endpoints. Same auth + refresh + ApiError pipeline
 * as the rest of the typed openapi client — the helpers are thin wrappers
 * over `openapi.POST` / `openapi.DELETE` that exist purely so callers can
 * stay in domain types (IWebPushSubscribeBody) instead of repeating the
 * full `paths` lookup at each call site.
 */

export interface IWebPushSubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
  userAgent?: string;
}

export async function subscribeWebPush(
  body: IWebPushSubscribeBody
): Promise<void> {
  await openapi.POST("/api/v1/notifications/push/subscribe", { body });
}

export async function unsubscribeWebPush(endpoint: string): Promise<void> {
  await openapi.DELETE("/api/v1/notifications/push/subscribe", {
    body: { endpoint }
  });
}
