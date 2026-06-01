import { describe, expect, it } from "vitest";

import { resolveStatusMessage } from "./OwnershipTransferAcceptPage.utils";

const identityT = (key: string): string => key;

describe("resolveStatusMessage", () => {
  it("returns the missingToken copy when no token is present", () => {
    expect(resolveStatusMessage("missing-token", null, identityT)).toBe(
      "accounts.ownershipTransfer.missingToken"
    );
  });

  it("returns the errorInvalid copy on a 4xx from the API", () => {
    expect(resolveStatusMessage("invalid-token", null, identityT)).toBe(
      "accounts.ownershipTransfer.errorInvalid"
    );
  });

  it("returns the success-accepted copy after a successful accept", () => {
    expect(resolveStatusMessage("accepted", null, identityT)).toBe(
      "accounts.ownershipTransfer.successAccepted"
    );
  });

  it("returns the success-declined copy after a successful decline", () => {
    expect(resolveStatusMessage("declined", null, identityT)).toBe(
      "accounts.ownershipTransfer.successDeclined"
    );
  });

  it("returns the server-provided message verbatim for generic errors", () => {
    expect(resolveStatusMessage("error", "boom", identityT)).toBe("boom");
  });

  it("falls back to the generic error when no server message is present", () => {
    expect(resolveStatusMessage("error", null, identityT)).toBe(
      "accounts.ownershipTransfer.errorGeneric"
    );
  });

  it("returns the intro copy in idle / pending states", () => {
    expect(resolveStatusMessage("idle", null, identityT)).toBe(
      "accounts.ownershipTransfer.intro"
    );
    expect(resolveStatusMessage("accepting", null, identityT)).toBe(
      "accounts.ownershipTransfer.intro"
    );
    expect(resolveStatusMessage("declining", null, identityT)).toBe(
      "accounts.ownershipTransfer.intro"
    );
  });
});
