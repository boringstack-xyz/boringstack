import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCapabilities } from "./useCapabilities";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  apiMock.GET.mockReset();
});

describe("useCapabilities", () => {
  it("loads the public server capabilities once", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        features: {
          notifications: { sse: true, webPush: false },
          billing: { enabled: true },
          ai: { enabled: false }
        },
        oauth: { providers: ["google"] }
      }
    });

    const { result } = renderHook(() => useCapabilities(), {
      wrapper: wrapper()
    });

    await waitFor(() => {
      expect(result.current.data?.oauth.providers).toEqual(["google"]);
    });

    expect(apiMock.GET).toHaveBeenCalledWith("/api/v1/capabilities/");
  });
});
