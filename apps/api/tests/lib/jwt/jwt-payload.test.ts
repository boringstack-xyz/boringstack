import { describe, expect, test } from "bun:test";

import { parseAuthJWTPayload } from "../../../src/lib/jwt/jwt-payload";

describe("parseAuthJWTPayload", () => {
  test("accepts a well-formed payload and returns typed (id, accountId)", () => {
    const result = parseAuthJWTPayload({
      id: "user-1",
      aid: "acc-1",
      email: "u@example.com",
    });

    expect(result.kind).toBe("ok");

    if (result.kind !== "ok") {
      throw new Error("expected an ok result");
    }

    expect(result.userId).toBe("user-1");
    expect(result.accountId).toBe("acc-1");
  });

  test("rejects `false` (verify failure) with kind=invalid", () => {
    expect(parseAuthJWTPayload(false).kind).toBe("invalid");
  });

  test("rejects non-objects", () => {
    expect(parseAuthJWTPayload(null).kind).toBe("invalid");
    expect(parseAuthJWTPayload("oops").kind).toBe("invalid");
    expect(parseAuthJWTPayload(42).kind).toBe("invalid");
    expect(parseAuthJWTPayload(undefined).kind).toBe("invalid");
  });

  test("rejects payloads missing id", () => {
    expect(parseAuthJWTPayload({ aid: "acc-1" }).kind).toBe("invalid");
  });

  test("rejects payloads missing aid", () => {
    expect(parseAuthJWTPayload({ id: "user-1" }).kind).toBe("invalid");
  });

  test("rejects payloads where id is not a string", () => {
    expect(parseAuthJWTPayload({ id: 42, aid: "acc-1" }).kind).toBe("invalid");
  });

  test("rejects payloads where aid is not a string", () => {
    expect(parseAuthJWTPayload({ id: "user-1", aid: 42 }).kind).toBe("invalid");
  });
});
