import { describe, expect, it } from "vitest";

import { resolveErrorMessage } from "./VerifyEmailPage.utils";

const identityT = (key: string): string => key;

describe("resolveErrorMessage", () => {
  it("returns the missingToken copy when status is 'missing-token'", () => {
    expect(resolveErrorMessage("missing-token", null, identityT)).toBe(
      "auth.verifyEmail.missingToken"
    );
  });

  it("returns the invalidToken copy when status is 'invalid-token'", () => {
    expect(resolveErrorMessage("invalid-token", null, identityT)).toBe(
      "auth.verifyEmail.invalidToken"
    );
  });

  it("returns the server message verbatim for generic errors", () => {
    expect(resolveErrorMessage("error", "Server is down", identityT)).toBe(
      "Server is down"
    );
  });

  it("falls back to the network-error copy when no server message is present", () => {
    expect(resolveErrorMessage("error", null, identityT)).toBe(
      "auth.login.errors.network"
    );
  });
});
