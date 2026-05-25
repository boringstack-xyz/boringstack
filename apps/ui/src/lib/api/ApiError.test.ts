import { describe, expect, it } from "vitest";

import { ApiError } from "./ApiError";

describe("ApiError", () => {
  it("carries message + status", () => {
    const err = new ApiError(400, { message: "Bad input" });

    expect(err.message).toBe("Bad input");
    expect(err.status).toBe(400);
    expect(err.name).toBe("ApiError");
  });

  it("flags 401 as unauthorized", () => {
    const err = new ApiError(401, { message: "Unauthorized" });

    expect(err.isUnauthorized).toBe(true);
    expect(err.isForbidden).toBe(false);
    expect(err.isValidation).toBe(false);
    expect(err.isServer).toBe(false);
  });

  it("flags 403 as forbidden", () => {
    const err = new ApiError(403, { message: "Forbidden" });

    expect(err.isForbidden).toBe(true);
    expect(err.isUnauthorized).toBe(false);
  });

  it("flags EMAIL_NOT_VERIFIED via the response code, not the status alone", () => {
    const yes = new ApiError(403, {
      message: "Verify your email",
      code: "EMAIL_NOT_VERIFIED"
    });

    expect(yes.isEmailNotVerified).toBe(true);
    expect(yes.isForbidden).toBe(true);

    const noCodeOn403 = new ApiError(403, { message: "Forbidden" });

    expect(noCodeOn403.isEmailNotVerified).toBe(false);

    const otherCode = new ApiError(403, {
      message: "Forbidden",
      code: "INSUFFICIENT_PERMISSIONS"
    });

    expect(otherCode.isEmailNotVerified).toBe(false);
  });

  it("flags 400 and 422 as validation", () => {
    expect(new ApiError(400, { message: "" }).isValidation).toBe(true);
    expect(new ApiError(422, { message: "" }).isValidation).toBe(true);
    expect(new ApiError(404, { message: "" }).isValidation).toBe(false);
  });

  it("flags 5xx as server errors", () => {
    expect(new ApiError(500, { message: "" }).isServer).toBe(true);
    expect(new ApiError(503, { message: "" }).isServer).toBe(true);
    expect(new ApiError(499, { message: "" }).isServer).toBe(false);
  });

  it("preserves field-level errors and request id", () => {
    const err = new ApiError(422, {
      message: "Validation failed",
      code: "VALIDATION",
      fieldErrors: { email: "Already taken" },
      requestId: "req_abc123"
    });

    expect(err.fieldErrors).toEqual({ email: "Already taken" });
    expect(err.code).toBe("VALIDATION");
    expect(err.requestId).toBe("req_abc123");
  });

  it("is catchable as an Error", () => {
    try {
      throw new ApiError(500, { message: "kaboom" });
    } catch (caught) {
      expect(caught).toBeInstanceOf(Error);
      expect(caught).toBeInstanceOf(ApiError);
    }
  });
});
