import { describe, expect, it } from "bun:test";

import {
  CORS_ALLOWED_HEADERS,
  CORS_EXPOSED_HEADERS,
} from "../../../src/config/security/security.constants";

describe("CORS allowlist", () => {
  it("allows the Sentry browser SDK trace propagation headers", () => {
    /*
     * `browserTracingIntegration` writes both the Sentry-native
     * `sentry-trace` + `baggage` headers and the W3C `traceparent`
     * header on outbound /api/* fetches. Cross-origin preflight has
     * to allow them all or the API never sees the call.
     */
    expect(CORS_ALLOWED_HEADERS).toContain("sentry-trace");
    expect(CORS_ALLOWED_HEADERS).toContain("baggage");
    expect(CORS_ALLOWED_HEADERS).toContain("traceparent");
  });

  it("exposes x-request-id to the browser", () => {
    /*
     * Error toasts read `response.headers.get("x-request-id")` and
     * show it for support. Cross-origin reads need an explicit
     * exposed-headers allowlist.
     */
    expect(CORS_EXPOSED_HEADERS).toContain("x-request-id");
  });
});
