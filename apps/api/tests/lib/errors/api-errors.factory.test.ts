import { describe, expect, test } from "bun:test";

import { ApiError } from "../../../src/lib/errors/api-error";
import { ApiErrors } from "../../../src/lib/errors/api-errors.factory";
import { ErrorCodes } from "../../../src/lib/errors/errors.constants";

describe("ApiErrors factory", () => {
  test("validation → 400 with the supplied field lifted into fieldErrors", () => {
    const err = ApiErrors.validation("bad", "email", { reason: "format" });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(err.statusCode).toBe(400);
    expect(err.fieldErrors).toEqual({ email: "bad" });
    expect(err.details).toEqual({ reason: "format" });
  });

  test("invalidInput → 400 + INVALID_INPUT code + field lifted into fieldErrors", () => {
    const err = ApiErrors.invalidInput("bad", "id");

    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ErrorCodes.INVALID_INPUT);
    expect(err.fieldErrors).toEqual({ id: "bad" });
  });

  test("missingField → 400 + names the field in the message", () => {
    const err = ApiErrors.missingField("token");

    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ErrorCodes.MISSING_REQUIRED_FIELD);
    expect(err.message).toContain("token");
  });

  test("unauthorized → 401", () => {
    expect(ApiErrors.unauthorized().statusCode).toBe(401);
    expect(ApiErrors.unauthorized().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  test("invalidCredentials → 401 + INVALID_CREDENTIALS", () => {
    expect(ApiErrors.invalidCredentials().statusCode).toBe(401);
    expect(ApiErrors.invalidCredentials().code).toBe(
      ErrorCodes.INVALID_CREDENTIALS
    );
  });

  test("emailNotVerified → 403", () => {
    expect(ApiErrors.emailNotVerified().statusCode).toBe(403);
    expect(ApiErrors.emailNotVerified().code).toBe(
      ErrorCodes.EMAIL_NOT_VERIFIED
    );
  });

  test("tokenExpired → 401", () => {
    expect(ApiErrors.tokenExpired().statusCode).toBe(401);
    expect(ApiErrors.tokenExpired().code).toBe(ErrorCodes.TOKEN_EXPIRED);
  });

  test("forbidden → 403", () => {
    expect(ApiErrors.forbidden().statusCode).toBe(403);
    expect(ApiErrors.forbidden().code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("notFound → 404, includes resource name in message", () => {
    const err = ApiErrors.notFound("Ticket");

    expect(err.statusCode).toBe(404);
    expect(err.code).toBe(ErrorCodes.NOT_FOUND);
    expect(err.message).toContain("Ticket");
  });

  test("conflict → 409", () => {
    expect(ApiErrors.conflict("dup").statusCode).toBe(409);
    expect(ApiErrors.conflict("dup").code).toBe(ErrorCodes.CONFLICT);
  });

  test("domainClaimed → 409 + DOMAIN_CLAIMED + carries account context in message", () => {
    const err = ApiErrors.domainClaimed("Acme Inc", {
      accountId: "acc-1",
      domain: "acme.com",
    });

    expect(err.statusCode).toBe(409);
    expect(err.code).toBe(ErrorCodes.DOMAIN_CLAIMED);
    expect(err.message).toContain("Acme Inc");
    expect(err.details).toEqual({ accountId: "acc-1", domain: "acme.com" });
  });

  test("rateLimit → 429", () => {
    expect(ApiErrors.rateLimit().statusCode).toBe(429);
    expect(ApiErrors.rateLimit().code).toBe(ErrorCodes.RATE_LIMIT_EXCEEDED);
  });

  test("limitExceeded → 402 + LIMIT_EXCEEDED + carries current/limit/feature in details (not a field error)", () => {
    const err = ApiErrors.limitExceeded("seats", { current: 10, limit: 5 });

    expect(err.statusCode).toBe(402);
    expect(err.code).toBe(ErrorCodes.LIMIT_EXCEEDED);
    expect(err.fieldErrors).toBeUndefined();
    expect(err.details).toEqual({
      current: 10,
      limit: 5,
      feature: "seats",
    });
  });

  test("internal → 500", () => {
    expect(ApiErrors.internal().statusCode).toBe(500);
    expect(ApiErrors.internal().code).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);
  });

  test("database → 500 + DATABASE_ERROR", () => {
    expect(ApiErrors.database().statusCode).toBe(500);
    expect(ApiErrors.database().code).toBe(ErrorCodes.DATABASE_ERROR);
  });

  test("externalService → 502 + EXTERNAL_SERVICE_ERROR", () => {
    expect(ApiErrors.externalService().statusCode).toBe(502);
    expect(ApiErrors.externalService().code).toBe(
      ErrorCodes.EXTERNAL_SERVICE_ERROR
    );
  });
});
