import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { syncMeAfterSessionEstablished } from "./Auth.session.sync";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

const buildAuthedResponse = () => ({
  data: {
    user: {
      id: "u1",
      email: "u@example.com",
      firstName: "U",
      lastName: "Ser",
      emailVerified: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z"
    },
    account: { id: "acc-1", name: "Personal" },
    role: "owner",
    memberships: [
      { accountId: "acc-1", accountName: "Personal", role: "owner" }
    ],
    features: { can_export: true, can_invite_team: true, max_seats: 10 },
    capabilities: {
      billing: false,
      notificationsSse: false,
      webPush: false
    },
    authProviders: ["email"],
    hasPasswordLogin: true
  }
});

const anonymousResponse = { data: { user: null } };

beforeEach(() => {
  apiMock.GET.mockReset();
});

describe("syncMeAfterSessionEstablished", () => {
  it("returns the authed me on the first call when /me already sees the cookie", async () => {
    apiMock.GET.mockResolvedValueOnce(buildAuthedResponse());
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    const result = await syncMeAfterSessionEstablished(qc);

    expect(result).not.toBeNull();
    expect(result?.user.id).toBe("u1");
    expect(apiMock.GET).toHaveBeenCalledTimes(1);
  });

  it("retries until /me returns authed (cookie commit lag closed)", async () => {
    apiMock.GET.mockResolvedValueOnce(anonymousResponse)
      .mockResolvedValueOnce(anonymousResponse)
      .mockResolvedValueOnce(buildAuthedResponse());
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    const result = await syncMeAfterSessionEstablished(qc);

    expect(result).not.toBeNull();
    expect(apiMock.GET).toHaveBeenCalledTimes(3);
  });

  it("returns null after exhausting retries if /me persistently reports anonymous", async () => {
    apiMock.GET.mockResolvedValue(anonymousResponse);
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    const result = await syncMeAfterSessionEstablished(qc);

    expect(result).toBeNull();
    expect(apiMock.GET).toHaveBeenCalledTimes(5);
  });

  it("populates the me cache so a downstream useMe sees authed data without a fresh fetch", async () => {
    apiMock.GET.mockResolvedValueOnce(buildAuthedResponse());
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    await syncMeAfterSessionEstablished(qc);

    const cached = qc.getQueryData(["auth", "me"]);

    expect(cached).not.toBeNull();
    expect(cached).toMatchObject({ user: { id: "u1" } });
  });
});
