import { describe, expect, spyOn, test } from "bun:test";

import { logger } from "../../src/config/logger";
import { errorHandler } from "../../src/middleware/error-handler";
import { ApiError, ApiErrors } from "../../src/lib/errors";

interface ISet {
  status?: number | string;
}

function hasStatusCode(payload: unknown): payload is { statusCode: unknown } {
  return (
    payload !== null && typeof payload === "object" && "statusCode" in payload
  );
}

const readStatusCode = (payload: unknown): unknown =>
  hasStatusCode(payload) ? payload.statusCode : undefined;

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

  test("Elysia VALIDATION code becomes a 400 with the field lifted into fieldErrors — value sanitized", () => {
    const set: ISet = {};
    /*
     * Framework error messages can embed the submitted body; we lift the
     * field name (schema-known, safe) but replace the message with a
     * generic "Invalid value" so no raw input reaches the client.
     */
    const raw = new Error("password too weak");

    Object.assign(raw, { field: "password" });

    const body = errorHandler({ code: "VALIDATION", error: raw, set });

    expect(set.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fieldErrors).toEqual({
      password: "Invalid value",
    });
  });

  test("VALIDATION without a 'field' property still 400s (fieldErrors is optional)", () => {
    const set: ISet = {};

    const body = errorHandler({
      code: "VALIDATION",
      error: new Error("missing email"),
      set,
    });

    expect(set.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fieldErrors).toBeUndefined();
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

  test("VALIDATION never echoes submitted body values into the response", () => {
    /*
     * Elysia surfaces TypeBox validation failures with the full input
     * embedded in the error message — including any submitted password
     * or token field. The handler replaces the framework message with
     * a generic one so no raw input reaches the client.
     */
    const set: ISet = {};
    const leakedSecret = "SUPER_SECRET_PASSWORD_VALUE";
    const elysiaShape = new Error(
      `Expected required property: password\nExpected: string\nReceived: { "email": "u@example.com", "password": "${leakedSecret}" }`
    );

    const body = errorHandler({
      code: "VALIDATION",
      error: elysiaShape,
      set,
    });

    expect(set.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(body)).not.toContain(leakedSecret);
    expect(JSON.stringify(body)).not.toContain("password");
  });

  test("VALIDATION never echoes submitted body values into the log line", () => {
    const set: ISet = {};
    const leakedSecret = "SUPER_SECRET_PASSWORD_VALUE";
    const elysiaShape = new Error(
      `Expected required property: password\nReceived: { "password": "${leakedSecret}" }`
    );

    const warnSpy = spyOn(logger, "warn");

    try {
      errorHandler({ code: "VALIDATION", error: elysiaShape, set });

      const calls = warnSpy.mock.calls;
      const serialized = JSON.stringify(calls);

      expect(serialized).not.toContain(leakedSecret);
    } finally {
      warnSpy.mockRestore();
    }
  });

  test("PARSE never echoes submitted body bytes into the response", () => {
    const set: ISet = {};
    const leakedFragment = "stripeKey=sk_live_LEAKED";
    const elysiaShape = new Error(
      `Unexpected token at position 12: ${leakedFragment}`
    );

    const body = errorHandler({ code: "PARSE", error: elysiaShape, set });

    expect(set.status).toBe(400);
    expect(JSON.stringify(body)).not.toContain(leakedFragment);
    expect(JSON.stringify(body)).not.toContain("sk_live");
  });

  test("ApiError(401) is logged at warn — not error — so anonymous-probe noise doesn't masquerade as server bugs", () => {
    const warnSpy = spyOn(logger, "warn");
    const errorSpy = spyOn(logger, "error");

    try {
      const set: ISet = {};

      errorHandler({
        code: "UNAUTHORIZED",
        error: ApiErrors.unauthorized("Invalid token"),
        set,
      });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  test("ApiError(403) is logged at warn (forbidden is client-driven, not a server bug)", () => {
    const warnSpy = spyOn(logger, "warn");
    const errorSpy = spyOn(logger, "error");

    try {
      const set: ISet = {};

      errorHandler({
        code: "FORBIDDEN",
        error: ApiErrors.forbidden(),
        set,
      });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  test("ApiError(500) still logs at error (a 5xx is a genuine server bug)", () => {
    const warnSpy = spyOn(logger, "warn");
    const errorSpy = spyOn(logger, "error");

    try {
      const set: ISet = {};

      errorHandler({
        code: "INTERNAL_SERVER_ERROR",
        error: new ApiError("INTERNAL_SERVER_ERROR", "boom", 500),
        set,
      });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  /*
   * Invariant: the `statusCode` carried by the warn log payload equals
   * the final response status. Observability tools (Grafana, GlitchTip)
   * read the log value, so any drift between log and wire status would
   * mis-attribute 4xx counts.
   */
  test("log entry's statusCode matches the response status (no stale set.status)", () => {
    const warnSpy = spyOn(logger, "warn");

    try {
      const set: ISet = {};

      errorHandler({
        code: "NOT_FOUND",
        error: ApiErrors.notFound("Ticket"),
        set,
      });

      expect(set.status).toBe(404);
      expect(warnSpy).toHaveBeenCalledTimes(1);

      const [, payload] = warnSpy.mock.calls[0] ?? [];

      expect(readStatusCode(payload)).toBe(404);
    } finally {
      warnSpy.mockRestore();
    }
  });

  test("log entry's statusCode matches response status for Elysia codes", () => {
    const warnSpy = spyOn(logger, "warn");

    try {
      const set: ISet = {};

      errorHandler({
        code: "PARSE",
        error: new Error("Unexpected end of JSON input"),
        set,
      });

      expect(set.status).toBe(400);
      expect(warnSpy).toHaveBeenCalledTimes(1);

      const [, payload] = warnSpy.mock.calls[0] ?? [];

      expect(readStatusCode(payload)).toBe(400);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
