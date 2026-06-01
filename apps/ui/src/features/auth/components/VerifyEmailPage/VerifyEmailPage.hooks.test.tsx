import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import type * as ReactRouterDom from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useVerifyEmailPage } from "./VerifyEmailPage.hooks";

const navigateMock = vi.hoisted(() => vi.fn());
const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof ReactRouterDom>("react-router-dom");

  return { ...actual, useNavigate: () => navigateMock };
});

function makeWrapper(initialUrl: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  return { Wrapper };
}

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.POST.mockReset();
  navigateMock.mockReset();
  /*
   * verify-email hook now pre-fetches /me through
   * `syncMeAfterSessionEstablished`. Stub the follow-up call so the
   * helper resolves immediately.
   */
  apiMock.GET.mockResolvedValue({
    data: { user: { id: "u1", email: "u@example.com" } }
  });
});

describe("useVerifyEmailPage", () => {
  it("transitions to 'missing-token' when ?token= is absent", async () => {
    const { Wrapper } = makeWrapper("/verify-email");
    const { result } = renderHook(() => useVerifyEmailPage(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.status).toBe("missing-token");
    });

    expect(apiMock.POST).not.toHaveBeenCalled();
  });

  it("POSTs the token + navigates on a successful verify", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: { success: true } });

    const { Wrapper } = makeWrapper("/verify-email?token=tok-1");

    renderHook(() => useVerifyEmailPage(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/auth/verify-email", {
        body: { token: "tok-1" }
      });
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalled();
    });
  });
});
