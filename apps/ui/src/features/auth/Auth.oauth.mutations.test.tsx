import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDisconnectOAuth } from "./Auth.oauth.mutations";

const apiMock = vi.hoisted(() => ({
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

beforeEach(() => {
  apiMock.DELETE.mockReset();
});

describe("useDisconnectOAuth", () => {
  it("DELETEs /api/v1/auth/oauth/{provider}", async () => {
    apiMock.DELETE.mockResolvedValueOnce({ data: { success: true } });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDisconnectOAuth(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync({ provider: "google" });
    });

    expect(apiMock.DELETE).toHaveBeenCalledWith(
      "/api/v1/auth/oauth/{provider}",
      {
        params: { path: { provider: "google" } }
      }
    );
  });
});
