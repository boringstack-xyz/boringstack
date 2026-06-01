import { describe, expect, it } from "bun:test";

import { extractTrustedClientIp } from "../../../src/config/security/security";

describe("extractTrustedClientIp", () => {
  it("returns the leftmost X-Forwarded-For entry (client-closest)", () => {
    expect(
      extractTrustedClientIp({
        forwardedFor: "203.0.113.7, 10.0.0.1, 10.0.0.2",
        socketAddress: "10.0.0.2",
      })
    ).toBe("203.0.113.7");
  });

  it("trims whitespace from the leftmost entry", () => {
    expect(
      extractTrustedClientIp({
        forwardedFor: "  203.0.113.7  , 10.0.0.1",
        socketAddress: undefined,
      })
    ).toBe("203.0.113.7");
  });

  it("falls back to the socket address when X-Forwarded-For is absent", () => {
    expect(
      extractTrustedClientIp({
        forwardedFor: null,
        socketAddress: "192.0.2.5",
      })
    ).toBe("192.0.2.5");
  });

  it("falls back to the socket address when X-Forwarded-For is empty", () => {
    expect(
      extractTrustedClientIp({
        forwardedFor: "",
        socketAddress: "192.0.2.5",
      })
    ).toBe("192.0.2.5");
  });

  it("returns empty string when neither is available — limiter treats this as anonymous", () => {
    expect(
      extractTrustedClientIp({
        forwardedFor: null,
        socketAddress: undefined,
      })
    ).toBe("");
  });
});
