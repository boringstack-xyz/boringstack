import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the openapi-fetch client wiring:
 *   - `tokenRefresh`   — silent retry on 401 with refresh dedup
 *   - `throwOnError`   — body parsing + ApiError construction
 *
 * The module has module-level state (`inFlightRefresh`) that needs to be a
 * fresh slate between tests. `vi.resetModules()` + dynamic `import` gives
 * each test its own instance, so refresh state never leaks across cases.
 */

vi.mock("@/lib/env", () => ({
  env: {
    /*
     * Absolute URL so openapi-fetch resolves paths through the URL
     * constructor; jsdom's fetch rejects relative URLs in tests.
     */
    VITE_API_URL: "http://test.local"
  }
}));

const loggerInfo = vi.fn();
const loggerWarn = vi.fn();

vi.mock("@/lib/logger/logger", () => ({
  logger: {
    info: (...args: unknown[]): void => {
      loggerInfo(...args);
    },
    warn: (...args: unknown[]): void => {
      loggerWarn(...args);
    },
    error: vi.fn(),
    debug: vi.fn()
  }
}));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  loggerInfo.mockClear();
  loggerWarn.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain" }
  });
}

async function importClient() {
  const mod = await import("./openapi");

  return mod.openapi;
}

describe("apiClient — happy path", () => {
  it("returns parsed data for a 2xx response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const client = await importClient();

    /*
     * We don't have a typed path that returns `{ok: true}`, so cast through
     * unknown to exercise the wire layer without lying about the schema.
     */
    const { data } = (await (
      client as unknown as {
        GET: (path: string) => Promise<{ data: unknown }>;
      }
    ).GET("/api/v1/users/me")) as { data: { ok: boolean } };

    expect(data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("tokenRefresh middleware", () => {
  it("silently retries the original request after a successful refresh", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: "expired" })) // original
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            user: {
              id: "u1",
              email: "u@example.com",
              firstName: "U",
              lastName: "Ser",
              emailVerified: true
            }
          },
          timestamp: "2026-06-01T00:00:00.000Z"
        })
      ) // refresh — real session refresh returns the user envelope
      .mockResolvedValueOnce(jsonResponse(200, { id: "u1" })); // retry
    const client = await importClient();

    const result = (await (
      client as unknown as {
        GET: (path: string) => Promise<{ data: unknown }>;
      }
    ).GET("/api/v1/users/me")) as { data: { id: string } };

    expect(result.data).toEqual({ id: "u1" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const calls = fetchMock.mock.calls.map(([req]) =>
      typeof req === "string" ? req : (req as Request).url
    );

    expect(calls[1]).toContain("/api/v1/auth/refresh");
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ event: "auth.refresh_attempt", success: true })
    );
  });

  it("does not retry when refresh responds 200 with { data: { user: null } } (anonymous probe)", async () => {
    /*
     * `/auth/refresh` returns 200 + `{ data: { user: null } }` for callers
     * without a refresh cookie. The middleware must read the body and gate
     * retry on a non-null user id; relying on `response.ok` alone would loop
     * indefinitely after logout.
     */
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: "expired" })) // original
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { user: null },
          timestamp: "2026-06-01T00:00:00.000Z"
        })
      ); // anon refresh
    const client = await importClient();

    await expect(
      (
        client as unknown as {
          GET: (path: string) => Promise<unknown>;
        }
      ).GET("/api/v1/users/me")
    ).rejects.toMatchObject({ name: "ApiError", status: 401 });

    // Original + refresh; no retry because refresh reported anonymous.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ event: "auth.refresh_attempt", success: false })
    );
  });

  it("does not retry and surfaces the 401 when the refresh itself fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: "expired" })) // original
      .mockResolvedValueOnce(jsonResponse(500, { message: "down" })); // refresh fails
    const client = await importClient();

    await expect(
      (
        client as unknown as {
          GET: (path: string) => Promise<unknown>;
        }
      ).GET("/api/v1/users/me")
    ).rejects.toMatchObject({ name: "ApiError", status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ event: "auth.refresh_attempt", success: false })
    );
  });

  it("does not recurse when /auth/refresh itself returns 401", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: "expired" }));
    const client = await importClient();

    await expect(
      (
        client as unknown as {
          POST: (path: string) => Promise<unknown>;
        }
      ).POST("/api/v1/auth/refresh")
    ).rejects.toMatchObject({ name: "ApiError", status: 401 });

    // Just the one call; the refresh-endpoint guard short-circuits the middleware.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not refresh when /auth/login returns 401", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { message: "bad creds" })
    );
    const client = await importClient();

    await expect(
      (
        client as unknown as {
          POST: (path: string, opts?: unknown) => Promise<unknown>;
        }
      ).POST("/api/v1/auth/login", { body: { email: "x", password: "y" } })
    ).rejects.toMatchObject({ name: "ApiError", status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent refreshes — parallel 401s share one in-flight refresh", async () => {
    fetchMock
      // Two parallel originals both 401:
      .mockResolvedValueOnce(jsonResponse(401, { message: "expired" }))
      .mockResolvedValueOnce(jsonResponse(401, { message: "expired" }))
      // One refresh call:
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            user: {
              id: "u1",
              email: "u@example.com",
              firstName: "U",
              lastName: "Ser",
              emailVerified: true
            }
          },
          timestamp: "2026-06-01T00:00:00.000Z"
        })
      )
      // Two retries:
      .mockResolvedValueOnce(jsonResponse(200, { id: "a" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "b" }));
    const client = await importClient();

    const [resA, resB] = (await Promise.all([
      (
        client as unknown as {
          GET: (path: string) => Promise<{ data: unknown }>;
        }
      ).GET("/api/v1/users/me"),
      (
        client as unknown as {
          GET: (path: string) => Promise<{ data: unknown }>;
        }
      ).GET("/api/v1/users/me")
    ])) as { data: { id: string } }[];

    // Both calls succeeded, with one shared refresh between them.
    expect(resA?.data.id).toBeDefined();
    expect(resB?.data.id).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const refreshCalls = fetchMock.mock.calls.filter(([req]) => {
      const url = typeof req === "string" ? req : (req as Request).url;

      return url.includes("/auth/refresh");
    });

    expect(refreshCalls).toHaveLength(1);
  });

  it("treats a refresh that throws as a failed refresh and logs warn", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: "expired" })) // original
      .mockRejectedValueOnce(new Error("network down")); // refresh throws
    const client = await importClient();

    await expect(
      (
        client as unknown as {
          GET: (path: string) => Promise<unknown>;
        }
      ).GET("/api/v1/users/me")
    ).rejects.toMatchObject({ name: "ApiError", status: 401 });

    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "auth.refresh_failed" })
    );
  });
});

describe("throwOnError middleware", () => {
  it("throws ApiError with parsed body fields on a non-2xx JSON response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          fieldErrors: { email: "required" }
        }),
        {
          status: 422,
          headers: {
            "content-type": "application/json",
            "x-request-id": "req-42"
          }
        }
      )
    );
    const client = await importClient();

    await expect(
      (
        client as unknown as {
          POST: (path: string, opts?: unknown) => Promise<unknown>;
        }
      ).POST("/api/v1/users", { body: {} })
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      code: "VALIDATION_ERROR",
      fieldErrors: { email: "required" },
      requestId: "req-42"
    });
  });

  it("unwraps the api envelope when error fields are nested under `error`", async () => {
    /*
     * The api ships a `{ success: false, error: { code, message,
     * fieldErrors?, timestamp } }` envelope. The middleware unwraps
     * the nested `error` object so the thrown ApiError carries
     * `code` straight from the payload and downstream guards like
     * `isEmailNotVerified` see the right value.
     */
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "EMAIL_NOT_VERIFIED",
            message:
              "Verify your email before signing in. Check your inbox or request a new link.",
            timestamp: "2026-01-01T00:00:00.000Z"
          }
        }),
        {
          status: 403,
          headers: { "content-type": "application/json" }
        }
      )
    );
    const client = await importClient();

    await expect(
      (
        client as unknown as {
          POST: (path: string, opts?: unknown) => Promise<unknown>;
        }
      ).POST("/api/v1/auth/login", { body: {} })
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
      message:
        "Verify your email before signing in. Check your inbox or request a new link."
    });
  });

  it("falls back to statusText when the body isn't JSON and logs the parse failure", async () => {
    fetchMock.mockResolvedValueOnce(textResponse(503, "Service Unavailable"));
    const client = await importClient();

    await expect(
      (
        client as unknown as {
          GET: (path: string) => Promise<unknown>;
        }
      ).GET("/api/v1/users/me")
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 503
    });

    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "api.error_parse_failed", status: 503 })
    );
  });
});
