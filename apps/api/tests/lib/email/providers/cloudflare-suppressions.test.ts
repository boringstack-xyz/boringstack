import { afterEach, describe, expect, test } from "bun:test";

import {
  CloudflareSuppressionsClient,
  parseSuppressionPage,
} from "../../../../src/lib/email/providers/cloudflare-suppressions";

const entry = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  email: `${id}@example.com`,
  created_at: "2026-11-17T14:33:00Z",
  expires_at: "2026-11-18T14:33:00Z",
  read_only: false,
  reason: "soft_bounce",
  scope: { type: "sending_domain", value: "guitarwiring.app" },
  ...extra,
});

const DELETE = "DELETE";
const originalFetch = globalThis.fetch;

const installFetch = (
  respond: (url: string, method: string) => Response
): { calls: { url: string; method: string; auth: string | null }[] } => {
  const calls: { url: string; method: string; auth: string | null }[] = [];

  const fake = (
    input: URL | RequestInfo,
    init?: RequestInit
  ): Promise<Response> => {
    if (typeof input !== "string") {
      throw new Error("test fake expected a string URL");
    }

    const url = input;
    const method = init?.method ?? "GET";

    calls.push({
      url,
      method,
      auth: new Headers(init?.headers).get("authorization"),
    });

    return Promise.resolve(respond(url, method));
  };

  const preconnect: typeof fetch.preconnect = () => undefined;

  globalThis.fetch = Object.assign(fake, { preconnect });

  return { calls };
};

describe("Cloudflare suppressions", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("a page keeps well-formed entries and treats an unstated read_only as not deletable", () => {
    const page = parseSuppressionPage({
      success: true,
      result: [
        entry("a"),
        entry("b", { read_only: undefined }),
        { id: "c" },
        "junk",
      ],
      result_info: { count: 2, next_cursor: "next", per_page: 100 },
    });

    expect(page.entries).toEqual([
      {
        id: "a",
        email: "a@example.com",
        createdAt: "2026-11-17T14:33:00Z",
        readOnly: false,
      },
      {
        id: "b",
        email: "b@example.com",
        createdAt: "2026-11-17T14:33:00Z",
        readOnly: true,
      },
    ]);
    expect(page.nextCursor).toBe("next");
    expect(parseSuppressionPage("nonsense")).toEqual({
      entries: [],
      nextCursor: null,
    });
  });

  test("lists soft bounces across pages and deletes by id", async () => {
    const { calls } = installFetch((url, method) => {
      if (method === DELETE) {
        return Response.json({ success: true, result: { id: "a" } });
      }

      return Response.json(
        url.includes("cursor=next")
          ? { result: [entry("b")], result_info: { next_cursor: null } }
          : { result: [entry("a")], result_info: { next_cursor: "next" } }
      );
    });
    const client = new CloudflareSuppressionsClient("acct", "token");
    const found = await client.listSoftBounces();

    await client.remove("a");

    expect(found.map((item) => item.id)).toEqual(["a", "b"]);
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "GET https://api.cloudflare.com/client/v4/accounts/acct/email/sending/suppressions?reason=soft_bounce&per_page=100",
      "GET https://api.cloudflare.com/client/v4/accounts/acct/email/sending/suppressions?reason=soft_bounce&per_page=100&cursor=next",
      "DELETE https://api.cloudflare.com/client/v4/accounts/acct/email/sending/suppressions/a",
    ]);
    expect(calls.every((call) => call.auth === "Bearer token")).toBe(true);
  });

  test("a refused request throws", () => {
    installFetch(() => new Response("no", { status: 403 }));

    const client = new CloudflareSuppressionsClient("acct", "token");

    expect(client.listSoftBounces()).rejects.toThrow("HTTP 403");
  });
});
