import { describe, expect, test } from "bun:test";

import { ApiError } from "../../../src/lib/errors";
import {
  buildRedirectURI,
  fetchJson,
  getCredentials,
  isRecord,
  readBoolean,
  readString,
  splitDisplayName,
} from "../../../src/lib/oauth/oauth.utils";
import { isValidOAuthProvider } from "../../../src/lib/oauth";

describe("isValidOAuthProvider", () => {
  test("accepts each known provider", () => {
    expect(isValidOAuthProvider("google")).toBe(true);
    expect(isValidOAuthProvider("github")).toBe(true);
    expect(isValidOAuthProvider("linkedin")).toBe(true);
  });

  test("rejects anything not in the manifest", () => {
    expect(isValidOAuthProvider("facebook")).toBe(false);
    expect(isValidOAuthProvider("")).toBe(false);
    expect(isValidOAuthProvider("Google")).toBe(false);
  });
});

describe("isRecord", () => {
  test("true for plain object", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  test("false for null, primitives, and arrays-as-records is true (typeof object)", () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord("string")).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
  });
});

describe("readString", () => {
  test("returns the string when the key exists and the value is a string", () => {
    expect(readString({ name: "Ada" }, "name")).toBe("Ada");
  });

  test("returns empty string when the value is not a string", () => {
    expect(readString({ age: 42 }, "age")).toBe("");
    expect(readString({ flag: true }, "flag")).toBe("");
    expect(readString({ nested: { a: 1 } }, "nested")).toBe("");
  });

  test("returns empty string when the key is missing or input is not an object", () => {
    expect(readString({ name: "Ada" }, "email")).toBe("");
    expect(readString(null, "email")).toBe("");
    expect(readString("scalar", "anything")).toBe("");
  });
});

describe("readBoolean", () => {
  test("returns true only for strict boolean true", () => {
    expect(readBoolean({ verified: true }, "verified")).toBe(true);
    expect(readBoolean({ verified: "true" }, "verified")).toBe(false);
    expect(readBoolean({ verified: 1 }, "verified")).toBe(false);
    expect(readBoolean({ verified: false }, "verified")).toBe(false);
  });

  test("returns false when the key is missing or input is not an object", () => {
    expect(readBoolean({}, "verified")).toBe(false);
    expect(readBoolean(null, "verified")).toBe(false);
  });
});

describe("splitDisplayName", () => {
  test("empty input returns empty fields", () => {
    expect(splitDisplayName("")).toEqual({ firstName: "", lastName: "" });
    expect(splitDisplayName("   ")).toEqual({ firstName: "", lastName: "" });
  });

  test("single token becomes the first name only", () => {
    expect(splitDisplayName("Cher")).toEqual({
      firstName: "Cher",
      lastName: "",
    });
  });

  test("two tokens split first / last", () => {
    expect(splitDisplayName("Ada Lovelace")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
    });
  });

  test("three-plus tokens: first stays first, rest join into last", () => {
    expect(splitDisplayName("Lady Ada Lovelace")).toEqual({
      firstName: "Lady",
      lastName: "Ada Lovelace",
    });
  });

  test("collapses runs of whitespace and trims", () => {
    expect(splitDisplayName("  Ada    Lovelace  ")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
    });
  });
});

describe("buildRedirectURI", () => {
  test("appends the standard callback path under /api/v1/auth/oauth/<provider>/callback", () => {
    const url = buildRedirectURI("google");

    expect(url).toMatch(
      /^https?:\/\/[^/]+\/api\/v1\/auth\/oauth\/google\/callback$/u
    );
  });

  test("emits one path per provider", () => {
    const google = buildRedirectURI("google");
    const github = buildRedirectURI("github");

    expect(google).not.toBe(github);
    expect(google.endsWith("/auth/oauth/google/callback")).toBe(true);
    expect(github.endsWith("/auth/oauth/github/callback")).toBe(true);
  });
});

describe("getCredentials", () => {
  test("throws notFound when both clientId and clientSecret are unset (test env default)", () => {
    let caught: unknown;

    try {
      getCredentials("google");
    } catch (error: unknown) {
      caught = error;
    }

    if (!(caught instanceof ApiError)) {
      throw new Error("expected ApiError");
    }

    expect(caught.statusCode).toBe(404);
  });
});

function withMockedFetch<T>(
  response: Response,
  fn: () => Promise<T>
): Promise<T> {
  const original = globalThis.fetch;
  const stub = (): Promise<Response> => Promise.resolve(response);

  Object.assign(globalThis, { fetch: stub });

  return fn().finally(() => {
    Object.assign(globalThis, { fetch: original });
  });
}

describe("fetchJson", () => {
  test("returns the parsed JSON body on 2xx", async () => {
    const result = await withMockedFetch(
      new Response(JSON.stringify({ ok: true, value: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      () => fetchJson("http://example.test", {})
    );

    expect(result).toEqual({ ok: true, value: 1 });
  });

  test("throws an externalService ApiError on non-2xx and includes the upstream body", async () => {
    let caught: unknown;

    await withMockedFetch(
      new Response("upstream is angry", { status: 502 }),
      async () => {
        try {
          await fetchJson("http://example.test", {});
        } catch (error: unknown) {
          caught = error;
        }
      }
    );

    if (!(caught instanceof ApiError)) {
      throw new Error("expected ApiError");
    }

    expect(caught.message).toContain("HTTP 502");
    expect(caught.message).toContain("upstream is angry");
  });
});
