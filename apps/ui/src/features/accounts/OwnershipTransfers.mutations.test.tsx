import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useAcceptOwnershipTransfer,
  useDeclineOwnershipTransfer
} from "./OwnershipTransfers.mutations";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { Wrapper };
}

const transfer = {
  id: "ot1",
  accountId: "acc-1",
  fromUserId: "u-old",
  toUserId: "u-new",
  expiresAt: "2026-06-08T00:00:00Z",
  acceptedAt: "2026-06-01T00:00:00Z",
  declinedAt: null,
  cancelledAt: null,
  createdAt: "2026-05-31T00:00:00Z"
};

beforeEach(() => {
  apiMock.POST.mockReset();
});

describe("useAcceptOwnershipTransfer", () => {
  it("POSTs the accept endpoint with the token", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: transfer, timestamp: "t" }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAcceptOwnershipTransfer(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync({ token: "tok" });
    });

    expect(apiMock.POST).toHaveBeenCalledWith(
      "/api/v1/invitations/ownership-transfer/accept",
      { body: { token: "tok" } }
    );
  });
});

describe("useDeclineOwnershipTransfer", () => {
  it("POSTs the decline endpoint with the token", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          ...transfer,
          acceptedAt: null,
          declinedAt: "2026-06-01T00:00:00Z"
        },
        timestamp: "t"
      }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeclineOwnershipTransfer(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync({ token: "tok" });
    });

    expect(apiMock.POST).toHaveBeenCalledWith(
      "/api/v1/invitations/ownership-transfer/decline",
      { body: { token: "tok" } }
    );
  });
});
