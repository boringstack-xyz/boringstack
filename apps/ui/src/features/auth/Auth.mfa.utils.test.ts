import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/ApiError";

import { unwrapMfaEnvelope } from "./Auth.mfa.utils";

describe("unwrapMfaEnvelope", () => {
  it("returns the inner data when present", () => {
    expect(unwrapMfaEnvelope({ data: { ok: true } })).toEqual({ ok: true });
  });

  it("throws an ApiError when data is missing", () => {
    expect(() => unwrapMfaEnvelope({})).toThrow(ApiError);
    expect(() => unwrapMfaEnvelope(undefined)).toThrow(ApiError);
  });
});
