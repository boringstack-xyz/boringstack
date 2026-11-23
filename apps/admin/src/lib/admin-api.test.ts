import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_REQUEST_HEADER,
  AdminApiError,
  AuditFeedResponseSchema,
  adminGet,
} from "./admin-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("adminGet", () => {
  it("sends the dashboard header on every request", async () => {
    const fetchMock = vi.fn<
      (url: string, init?: RequestInit) => Promise<Response>
    >(() =>
      Promise.resolve(
        new Response(JSON.stringify({ entries: [], timestamp: "t" }), {
          status: 200,
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await adminGet("/audit", AuditFeedResponseSchema, { limit: "5" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(url).toBe("/api/v1/admin/audit?limit=5");
    expect(new Headers(init?.headers).get(ADMIN_REQUEST_HEADER)).toBe("1");
  });

  it("throws AdminApiError on a refusal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("{}", { status: 403 })))
    );

    await expect(
      adminGet("/queues", AuditFeedResponseSchema)
    ).rejects.toBeInstanceOf(AdminApiError);
  });

  it("rejects a body that does not match the schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ unexpected: true }), { status: 200 })
        )
      )
    );

    await expect(adminGet("/audit", AuditFeedResponseSchema)).rejects.toThrow();
  });
});
