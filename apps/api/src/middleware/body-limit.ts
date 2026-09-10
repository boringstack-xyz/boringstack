import { Elysia } from "elysia";
import { ApiError, ApiErrors } from "../lib/errors";

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
 * This is the cheap pre-parse check, not the enforcement boundary. The
 * enforcement boundary is `maxRequestBodySize` on the server
 * (`src/index.ts`), which bounds a body while it streams and therefore
 * covers chunked transfers and stripped headers, the cases a header check
 * cannot see. Rejecting a bodied request that carries no `Content-Length`
 * is not a substitute: it refuses legitimate chunked clients while still
 * letting a lying header through to an unbounded read.
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
    /*
     * Nothing to check. A chunked request advertises no length, and the
     * transport cap is what bounds it.
     */
    return;
  }

  const size = Number.parseInt(input.contentLength, 10);

  if (Number.isNaN(size)) {
    throw ApiErrors.validation(
      "Content-Length header must be a number",
      "body"
    );
  }

  if (size > cap) {
    throw ApiErrors.payloadTooLarge("Request body exceeds 1 MB limit");
  }
};

/*
 * Three details here matter.
 *
 * `.as("global")`: Elysia scopes lifecycle hooks to the declaring instance
 * and its descendants, so a plugin the parent `use`s does not cover routes
 * the parent registers afterwards, which is exactly how
 * `config/app/app.ts` composes. Without this the hook is mounted, looks
 * correct, and runs for no route in the application.
 *
 * `onRequest`, not `onParse`: Elysia wraps anything thrown during the parse
 * phase in its own `ParseError`, so an `ApiError` never reaches the error
 * handler and a 413 arrives as a 400 "could not be parsed".
 * Indistinguishable from malformed JSON. `onRequest` also runs before
 * routing, so an over-cap body is refused without matching a route.
 *
 * Short-circuit, not throw: a value returned from `onRequest` becomes the
 * response directly. Throwing from this phase routes through `onError`,
 * where the status the handler sets does not survive and the client gets
 * the right envelope under a 200.
 */
export const bodyLimit = new Elysia()
  .onRequest(({ request, set }) => {
    try {
      enforceBodyLimit({
        method: request.method,
        contentLength: request.headers.get("content-length"),
      });
    } catch (error: unknown) {
      if (!(error instanceof ApiError)) {
        throw error;
      }

      set.status = error.statusCode;

      return error.toResponse();
    }

    return undefined;
  })
  .as("global");
