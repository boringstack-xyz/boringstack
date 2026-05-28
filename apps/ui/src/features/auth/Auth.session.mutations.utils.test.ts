import { describe, expect, it } from "vitest";

import {
  isLoginUserEnvelope,
  isMfaRequiredEnvelope
} from "./Auth.session.mutations.utils";

describe("isMfaRequiredEnvelope", () => {
  it("accepts a well-formed mfa-required envelope", () => {
    expect(
      isMfaRequiredEnvelope({
        mfaRequired: true,
        challengeToken: "abcdef1234567890"
      })
    ).toBe(true);
  });

  it("rejects envelopes missing the challenge token", () => {
    expect(isMfaRequiredEnvelope({ mfaRequired: true })).toBe(false);
  });

  it("rejects user envelopes", () => {
    expect(isMfaRequiredEnvelope({ user: { id: "u1" } })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isMfaRequiredEnvelope(null)).toBe(false);
    expect(isMfaRequiredEnvelope("string")).toBe(false);
  });
});

describe("isLoginUserEnvelope", () => {
  it("accepts an envelope with a user object", () => {
    expect(isLoginUserEnvelope({ user: { id: "u1" } })).toBe(true);
  });

  it("rejects envelopes without a user", () => {
    expect(isLoginUserEnvelope({ user: null })).toBe(false);
    expect(isLoginUserEnvelope({})).toBe(false);
  });
});
