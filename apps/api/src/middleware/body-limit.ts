import { Elysia } from "elysia";
import { ApiErrors } from "../lib/errors";

const MAX_BODY_SIZE_BYTES = 1024 * 1024; // 1 MB

/*
 * Reject requests whose advertised Content-Length exceeds the cap. Cheap
 * pre-parse guard against runaway payloads. Does NOT defend against a
 * client that omits the header and streams chunked input — that's the
 * edge layer's job (Traefik, Cloudflare).
 */
export const bodyLimit = new Elysia().onParse(({ request }) => {
  const contentLength = request.headers.get("content-length");

  if (contentLength === null) {
    return;
  }

  const size = Number.parseInt(contentLength, 10);

  if (Number.isNaN(size) || size <= MAX_BODY_SIZE_BYTES) {
    return;
  }

  throw ApiErrors.validation("Request body exceeds 1 MB limit", "body");
});
