import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useRegister,
  useResendVerification,
  useVerifyEmail
} from "./Auth.signup.mutations";

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

describe("useRegister", () => {
  it("POSTs /api/v1/auth/register and resolves with the server message", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { message: "Check your email." } }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRegister(), { wrapper: Wrapper });

    let response = "";

    await act(async () => {
      response = await result.current.mutateAsync({
        email: "x@example.com",
        password: "Hunter2!",
        firstName: "X",
        lastName: "Y"
      });
    });

    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/auth/register", {
      body: {
        email: "x@example.com",
        password: "Hunter2!",
        firstName: "X",
        lastName: "Y"
      }
    });
    expect(response).toBe("Check your email.");
  });

  it("resolves with an empty string when the server omits message", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: {} }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRegister(), { wrapper: Wrapper });

    let response = "default";

    await act(async () => {
      response = await result.current.mutateAsync({
        email: "x@example.com",
        password: "Hunter2!",
        firstName: "",
        lastName: ""
      });
    });

    expect(response).toBe("");
  });

  it("throws when the server returns no data envelope", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: null });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRegister(), { wrapper: Wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({
          email: "x@example.com",
          password: "Hunter2!",
          firstName: "",
          lastName: ""
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe("useVerifyEmail", () => {
  it("POSTs the token and resolves without surfacing a body", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: { success: true } });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useVerifyEmail(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ token: "verify-token-xyz" });
    });

    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/auth/verify-email", {
      body: { token: "verify-token-xyz" }
    });
  });
});

describe("useResendVerification", () => {
  it("POSTs /api/v1/auth/resend-verification with the supplied email", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: { success: true } });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useResendVerification(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync({ email: "x@example.com" });
    });

    expect(apiMock.POST).toHaveBeenCalledWith(
      "/api/v1/auth/resend-verification",
      { body: { email: "x@example.com" } }
    );
  });
});
