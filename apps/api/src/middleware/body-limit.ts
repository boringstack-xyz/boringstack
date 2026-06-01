import { Elysia } from "elysia";
import { ApiErrors } from "../lib/errors";

export const MAX_BODY_SIZE_BYTES = 1024 * 1024; // 1 MB

/*
 * Methods that carry a request body. GET/HEAD/OPTIONS/DELETE don't,
 * so a missing Content-Length on those is normal and not something
 * this middleware needs to enforce.
 */
const BODIED_METHODS = new Set(["POST", "PUT", "PATCH"]);

/**
 * Pure guard, exported for direct unit testing. The integration path
 * through `Elysia.handle` + Bun's Request normaliser rewrites headers
 * in ways the standard `new Request(...)` API can't override, so this
 * function gets tested with raw values.
 *
 * Two reject paths:
 *   1. Content-Length present → exceeds cap → throws.
 *   2. Bodied method WITHOUT a Content-Length (chunked transfer, or
 *      a misbehaving client/proxy that stripped the header) → throws.
 *      Without this leg a caller can omit the header and stream an
 *      unbounded body past the cap.
 *
 * The API doesn't accept streaming uploads anywhere; forks that add
 * one should mount a route-specific exemption rather than loosening
 * this global cap.
 */
export const enforceBodyLimit = (input: {
  method: string;
  contentLength: string | null;
  maxBytes?: number;
}): void => {
  if (!BODIED_METHODS.has(input.method)) {
    return;
  }

  const cap = input.maxBytes ?? MAX_BODY_SIZE_BYTES;

  if (input.contentLength === null) {
    throw ApiErrors.validation(
      "Content-Length header is required for requests with a body",
      "body"
    );
  }

  const size = Number.parseInt(input.contentLength, 10);

  if (Number.isNaN(size)) {
    throw ApiErrors.validation(
      "Content-Length header must be a number",
      "body"
    );
  }

  if (size > cap) {
    throw ApiErrors.validation("Request body exceeds 1 MB limit", "body");
  }
};

export const bodyLimit = new Elysia().onParse(({ request }) => {
  enforceBodyLimit({
    method: request.method,
    contentLength: request.headers.get("content-length"),
  });
});
