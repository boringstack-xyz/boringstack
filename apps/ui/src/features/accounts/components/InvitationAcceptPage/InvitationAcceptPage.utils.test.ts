import { describe, expect, it } from "vitest";

import { resolveErrorMessage } from "./InvitationAcceptPage.utils";

const identityT = (key: string): string => key;

describe("resolveErrorMessage", () => {
  it("returns the missingToken copy when status is 'missing-token'", () => {
    expect(resolveErrorMessage("missing-token", null, identityT)).toBe(
      "accounts.invitations.accept.missingToken"
    );
  });

  it("returns the errorInvalid copy when status is 'invalid-token'", () => {
    expect(resolveErrorMessage("invalid-token", null, identityT)).toBe(
      "accounts.invitations.accept.errorInvalid"
    );
  });

  it("returns the server message verbatim for generic errors", () => {
    expect(resolveErrorMessage("error", "Server is down", identityT)).toBe(
      "Server is down"
    );
  });

  it("falls back to the generic copy when no server message is present", () => {
    expect(resolveErrorMessage("error", null, identityT)).toBe(
      "accounts.invitations.accept.errorGeneric"
    );
  });
});
