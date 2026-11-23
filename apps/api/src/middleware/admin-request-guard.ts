import { Elysia } from "elysia";

import { logger } from "../config/logger";
import { ApiErrors } from "../lib/errors";

/*
 * Sent by the admin dashboard on every request; a plain form cannot set it.
 * The name carries the project token so rename-project.sh rewrites it on
 * both sides (this file and the admin SPA's client).
 */
export const ADMIN_REQUEST_HEADER = "x-boringstack-admin";

/* Reads under this prefix need the dashboard too; /health and the rest do not. */
export const ADMIN_API_PREFIX = "/api/v1/admin";

const READ_METHODS = new Set(["GET", "HEAD"]);
const SAME_ORIGIN_SITES = new Set(["same-origin", "none"]);

/**
 * Why an admin request is refused, or null when it may proceed. Exported
 * for unit tests; the hook below is what enforces it.
 *
 * A read outside `/api/v1/admin` (health probes, the OpenAPI document)
 * always passes. An admin read passes only with the first two rules below:
 * a cross-site `<img>` or a link prefetch must not reach the operator's
 * data, and a no-login API has no reason to answer any browser but the
 * dashboard. A write passes only when all three hold:
 * - `sec-fetch-site` is absent, `same-origin` or `none` (a browser on
 *   another site, or a sibling host, is refused outright);
 * - it carries `x-boringstack-admin: 1`, which a cross-site page can only
 *   add through a CORS preflight the admin API never answers;
 * - a body, when present, is `application/json`, so a plain HTML form
 *   (urlencoded, multipart, text/plain) never reaches a handler.
 */
export const adminRequestRefusal = (input: {
  method: string;
  path: string;
  secFetchSite: string | null;
  adminHeader: string | null;
  contentType: string | null;
  hasBody: boolean;
}): string | null => {
  const isRead = READ_METHODS.has(input.method.toUpperCase());
  const isAdminPath =
    input.path === ADMIN_API_PREFIX ||
    input.path.startsWith(`${ADMIN_API_PREFIX}/`);

  if (isRead && !isAdminPath) {
    return null;
  }

  if (
    input.secFetchSite !== null &&
    !SAME_ORIGIN_SITES.has(input.secFetchSite.toLowerCase())
  ) {
    return "cross_site";
  }

  if (input.adminHeader !== "1") {
    return "missing_admin_header";
  }

  if (isRead) {
    return null;
  }

  const mediaType = (input.contentType ?? "")
    .split(";")[0]
    ?.trim()
    .toLowerCase();

  return input.hasBody && mediaType !== "application/json" ? "not_json" : null;
};

const hasBody = (request: Request): boolean => {
  const length = request.headers.get("content-length");

  return length !== null
    ? Number.parseInt(length, 10) > 0
    : request.body !== null;
};

/*
 * Cross-site protection for the LAN admin API, which has no session to
 * check. `onRequest` so a refused request is never parsed or routed, and
 * `.as("global")` so it covers routes mounted after it. The 403 is
 * returned, not thrown, so the status survives.
 */
export const adminRequestGuard = new Elysia()
  .onRequest(({ request, set }) => {
    const reason = adminRequestRefusal({
      method: request.method,
      path: new URL(request.url).pathname,
      secFetchSite: request.headers.get("sec-fetch-site"),
      adminHeader: request.headers.get(ADMIN_REQUEST_HEADER),
      contentType: request.headers.get("content-type"),
      hasBody: hasBody(request),
    });

    if (reason === null) {
      return undefined;
    }

    logger.warn("Admin request refused", {
      event: "authz_denied",
      reason,
      method: request.method,
    });

    const error = ApiErrors.forbidden(
      "The admin API answers only the admin dashboard"
    );

    set.status = error.statusCode;

    return error.toResponse();
  })
  .as("global");
