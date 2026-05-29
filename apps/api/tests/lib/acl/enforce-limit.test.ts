import { describe, expect, test } from "bun:test";

import { enforceLimit } from "../../../src/lib/acl/enforce-limit";
import { ApiError } from "../../../src/lib/errors";

describe("enforceLimit", () => {
  test("passes when currentCount is strictly below the limit", () => {
    expect(() => {
      enforceLimit("max_seats", 4, 5);
    }).not.toThrow();
  });

  test("throws an ApiError 402 when currentCount equals the limit", () => {
    let caught: unknown = null;

    try {
      enforceLimit("max_seats", 5, 5);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (!(caught instanceof ApiError)) {
      throw new Error("expected an ApiError");
    }

    expect(caught.statusCode).toBe(402);
    expect(caught.code).toBe("LIMIT_EXCEEDED");
  });

  test("throws an ApiError 402 when currentCount is above the limit (defence-in-depth)", () => {
    let caught: unknown = null;

    try {
      enforceLimit("max_seats", 100, 5);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (!(caught instanceof ApiError)) {
      throw new Error("expected an ApiError");
    }

    expect(caught.statusCode).toBe(402);
  });

  test("error carries the feature key and current/limit context", () => {
    let caught: unknown = null;

    try {
      enforceLimit("max_seats", 10, 5);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (!(caught instanceof ApiError)) {
      throw new Error("expected an ApiError");
    }

    expect(caught.field).toBe("max_seats");
    expect(caught.details).toEqual({ current: 10, limit: 5 });
  });

  test("throws when currentCount equals zero and limit is zero", () => {
    let caught: unknown = null;

    try {
      enforceLimit("max_seats", 0, 0);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
  });
});
