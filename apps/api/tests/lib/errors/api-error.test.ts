import { describe, expect, test } from "bun:test";
import { ApiError, ApiErrors, ErrorCodes } from "../../../src/lib/errors";

describe("ApiError", () => {
  test("toResponse() includes code, message, and timestamp", () => {
    const err = new ApiError(ErrorCodes.UNAUTHORIZED, "Nope", 401);
    const res = err.toResponse();

    expect(res.success).toBe(false);
    expect(res.error.code).toBe(ErrorCodes.UNAUTHORIZED);
    expect(res.error.message).toBe("Nope");
    expect(typeof res.error.timestamp).toBe("string");
    expect(res.error.fieldErrors).toBeUndefined();
    expect(res.error.details).toBeUndefined();
  });

  test("toResponse() includes fieldErrors and details when set", () => {
    const err = new ApiError(
      ErrorCodes.VALIDATION_ERROR,
      "Bad",
      400,
      { email: "Bad email" },
      { received: "x" }
    );
    const res = err.toResponse();

    expect(res.error.fieldErrors).toEqual({ email: "Bad email" });
    expect(res.error.details).toEqual({ received: "x" });
  });

  test("statusCode defaults to 500", () => {
    const err = new ApiError(ErrorCodes.INTERNAL_SERVER_ERROR, "Boom");

    expect(err.statusCode).toBe(500);
  });

  test("name is 'ApiError' (so instanceof checks downstream are reliable)", () => {
    const err = new ApiError(ErrorCodes.NOT_FOUND, "x", 404);

    expect(err.name).toBe("ApiError");
    expect(err instanceof ApiError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});

describe("ApiErrors factory", () => {
  test("validation() lifts a single field string into a one-key fieldErrors map", () => {
    const err = ApiErrors.validation("Bad email", "email");

    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(err.fieldErrors).toEqual({ email: "Bad email" });
  });

  test("validation() accepts an explicit fieldErrors map for multi-field cases", () => {
    const err = ApiErrors.validation("Validation failed", {
      email: "Invalid email",
      password: "Too short",
    });

    expect(err.fieldErrors).toEqual({
      email: "Invalid email",
      password: "Too short",
    });
  });

  test("notFound() → 404", () => {
    const err = ApiErrors.notFound("Ticket");

    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Ticket not found");
  });

  test("unauthorized() / invalidCredentials() / tokenExpired() → 401", () => {
    expect(ApiErrors.unauthorized().statusCode).toBe(401);
    expect(ApiErrors.invalidCredentials().statusCode).toBe(401);
    expect(ApiErrors.tokenExpired().statusCode).toBe(401);
  });

  test("forbidden() → 403", () => {
    expect(ApiErrors.forbidden().statusCode).toBe(403);
  });

  test("conflict() → 409", () => {
    expect(ApiErrors.conflict("dup").statusCode).toBe(409);
  });

  test("rateLimit() → 429", () => {
    expect(ApiErrors.rateLimit().statusCode).toBe(429);
  });

  test("externalService() → 502", () => {
    expect(ApiErrors.externalService().statusCode).toBe(502);
  });

  test("missingField() includes the field name in the message and fieldErrors", () => {
    const err = ApiErrors.missingField("email");

    expect(err.message).toContain("email");
    expect(err.fieldErrors).toEqual({ email: err.message });
  });
});
