import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/ApiError";

import { fetchCurrentMe } from "./fetchMe";

const apiMock = vi.hoisted(() => ({ GET: vi.fn() }));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

const AUTHED = {
  user: {
    id: "u1",
    email: "u@example.com",
    firstName: "U",
    lastName: "Ser",
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }
};

beforeEach(() => {
  apiMock.GET.mockReset();
});

describe("fetchCurrentMe", () => {
  it("returns the session payload for an authenticated response", async () => {
    apiMock.GET.mockResolvedValueOnce({ data: AUTHED, response: {} });

    await expect(fetchCurrentMe()).resolves.toEqual(AUTHED);
  });

  it("returns null for the anonymous 200 shape", async () => {
    apiMock.GET.mockResolvedValueOnce({ data: { user: null }, response: {} });

    await expect(fetchCurrentMe()).resolves.toBeNull();
  });

  it("returns null when /me is still 401 after the refresh middleware gave up", async () => {
    apiMock.GET.mockRejectedValueOnce(
      new ApiError(401, { message: "Unauthorized" })
    );

    await expect(fetchCurrentMe()).resolves.toBeNull();
    expect(apiMock.GET).toHaveBeenCalledTimes(1);
  });

  it("rethrows non-auth failures so the offline fallback can show", async () => {
    const outage = new ApiError(503, { message: "down" });

    apiMock.GET.mockRejectedValueOnce(outage);

    await expect(fetchCurrentMe()).rejects.toBe(outage);
  });
});
