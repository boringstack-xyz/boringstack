import { describe, expect, it, vi } from "vitest";

import { resolveOAuthErrorMessage } from "@/lib/auth/oauth.errors";

const t = vi.fn((key: string) => key);

describe("resolveOAuthErrorMessage", () => {
  it("maps known IdP error codes to i18n keys", () => {
    expect(resolveOAuthErrorMessage("access_denied", t)).toBe(
      "auth.oauth.failed.errors.access_denied"
    );
    expect(t).toHaveBeenCalledWith("auth.oauth.failed.errors.access_denied");
  });

  it("normalizes error codes before lookup", () => {
    resolveOAuthErrorMessage(" Access_Denied ", t);

    expect(t).toHaveBeenCalledWith("auth.oauth.failed.errors.access_denied");
  });

  it("falls back to unknown for unrecognized codes", () => {
    expect(resolveOAuthErrorMessage("totally_custom", t)).toBe(
      "auth.oauth.failed.errors.unknown"
    );
  });

  it("falls back to unknown for empty input", () => {
    expect(resolveOAuthErrorMessage("   ", t)).toBe(
      "auth.oauth.failed.errors.unknown"
    );
  });
});
