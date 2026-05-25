import { describe, expect, test } from "bun:test";

import { errorHandler } from "../../src/middleware/error-handler";
import { ApiError, ApiErrors } from "../../src/lib/errors";

interface ISet {
  status?: number | string;
}

describe("errorHandler", () => {
  test("ApiError pass-through: status comes from the error, body is the canonical envelope", () => {
    const set: ISet = {};
    const err = ApiErrors.unauthorized();

    const body = errorHandler({ code: "UNAUTHORIZED", error: err, set });

    expect(set.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("ApiError pass-through preserves the original code even when Elysia surfaces a generic code string", () => {
    const set: ISet = {};
    const err = new ApiError("CONFLICT", "Email already registered", 409);

    const body = errorHandler({ code: "UNKNOWN", error: err, set });

    expect(set.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toBe("Email already registered");
  });

  test("Elysia NOT_FOUND code becomes a 404 ApiError when the thrown value isn't already one", () => {
    const set: ISet = {};

    const body = errorHandler({
      code: "NOT_FOUND",
      error: new Error("route not registered"),
      set,
    });

    expect(set.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("Elysia VALIDATION code becomes a 400 with the field carried through", () => {
    const set: ISet = {};
    const raw = new Error("password too weak");

    Object.assign(raw, { field: "password" });

    const body = errorHandler({ code: "VALIDATION", error: raw, set });

    expect(set.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.field).toBe("password");
  });

  test("VALIDATION without a 'field' property still 400s (field is optional)", () => {
    const set: ISet = {};

    const body = errorHandler({
      code: "VALIDATION",
      error: new Error("missing email"),
      set,
    });

    expect(set.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.field).toBeUndefined();
  });

  test("Unknown error type maps to 500 internal — does NOT leak the original message", () => {
    const set: ISet = {};

    const body = errorHandler({
      code: "INTERNAL_SERVER_ERROR",
      error: new Error("very specific stack trace from upstream"),
      set,
    });

    expect(set.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.message).not.toContain("very specific stack trace");
  });

  test("Default branch (unrecognized code) maps to 500", () => {
    const set: ISet = {};

    const body = errorHandler({
      code: "WAT_NEW_CODE",
      error: new Error("???"),
      set,
    });

    expect(set.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  test("Non-Error values are still handled (e.g., string throws)", () => {
    const set: ISet = {};

    const body = errorHandler({
      code: "UNKNOWN",
      error: "something terrible happened",
      set,
    });

    expect(set.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  test("INVALID_COOKIE_SIGNATURE maps to 401 (untrusted cookie input, not internal error)", () => {
    const set: ISet = {};

    const body = errorHandler({
      code: "INVALID_COOKIE_SIGNATURE",
      error: new Error('"auth_token" has invalid cookie signature'),
      set,
    });

    expect(set.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("PARSE maps to 400 (body parse failure is user input, not internal)", () => {
    const set: ISet = {};

    const body = errorHandler({
      code: "PARSE",
      error: new Error("Unexpected end of JSON input"),
      set,
    });

    expect(set.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
