import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useForgotPassword, useResetPassword } from "./Auth.password.mutations";

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

beforeEach(() => {
  apiMock.POST.mockReset();
});

describe("useForgotPassword", () => {
  it("POSTs /api/v1/auth/forgot-password with the email", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: { success: true } });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useForgotPassword(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync({ email: "x@example.com" });
    });

    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/auth/forgot-password", {
      body: { email: "x@example.com" }
    });
  });

  it("throws when the server returns success: false", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: { success: false } });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useForgotPassword(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current
        .mutateAsync({ email: "x@example.com" })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe("useResetPassword", () => {
  it("POSTs /api/v1/auth/reset-password with token and password", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: { success: true } });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useResetPassword(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync({
        token: "reset-token",
        password: "NewPass1!"
      });
    });

    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/auth/reset-password", {
      body: { token: "reset-token", password: "NewPass1!" }
    });
  });
});
