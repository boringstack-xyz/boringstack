import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOwnershipTransferAcceptPage } from "./OwnershipTransferAcceptPage.hooks";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

function makeWrapper(initialUrl: string) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  return { Wrapper };
}

beforeEach(() => {
  apiMock.POST.mockReset();
});

describe("useOwnershipTransferAcceptPage", () => {
  it("transitions to 'missing-token' when ?token= is absent", async () => {
    const { Wrapper } = makeWrapper("/account/ownership-transfer/accept");
    const { result } = renderHook(() => useOwnershipTransferAcceptPage(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.status).toBe("missing-token");
    });
  });

  it("starts in 'idle' when a token is present and fires Accept on demand", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { id: "ot1" }, timestamp: "t" }
    });

    const { Wrapper } = makeWrapper(
      "/account/ownership-transfer/accept?token=tok"
    );
    const { result } = renderHook(() => useOwnershipTransferAcceptPage(), {
      wrapper: Wrapper
    });

    expect(result.current.status).toBe("idle");

    act(() => {
      result.current.onAccept();
    });

    await waitFor(() => {
      expect(apiMock.POST).toHaveBeenCalledWith(
        "/api/v1/invitations/ownership-transfer/accept",
        { body: { token: "tok" } }
      );
    });
    await waitFor(() => {
      expect(result.current.status).toBe("accepted");
    });
  });

  it("fires Decline when the user picks that path", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { id: "ot1" }, timestamp: "t" }
    });

    const { Wrapper } = makeWrapper(
      "/account/ownership-transfer/accept?token=tok"
    );
    const { result } = renderHook(() => useOwnershipTransferAcceptPage(), {
      wrapper: Wrapper
    });

    act(() => {
      result.current.onDecline();
    });

    await waitFor(() => {
      expect(apiMock.POST).toHaveBeenCalledWith(
        "/api/v1/invitations/ownership-transfer/decline",
        { body: { token: "tok" } }
      );
    });
    await waitFor(() => {
      expect(result.current.status).toBe("declined");
    });
  });
});
