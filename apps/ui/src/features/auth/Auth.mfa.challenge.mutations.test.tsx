import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useMfaVerifyLogin,
  useMfaVerifyRecovery
} from "./Auth.mfa.challenge.mutations";

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

  return { Wrapper, client };
}

beforeEach(() => {
  apiMock.POST.mockReset();
});

describe("useMfaVerifyLogin", () => {
  it("POSTs the challenge + code and unwraps the envelope", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { user: { id: "u1" } } }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useMfaVerifyLogin(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync({
        challengeToken: "tokenxxxxxxxxxxx",
        code: "123456"
      });
    });

    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/auth/mfa/verify-login", {
      body: { challengeToken: "tokenxxxxxxxxxxx", code: "123456" }
    });
  });
});

describe("useMfaVerifyRecovery", () => {
  it("POSTs to the recovery endpoint", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { user: { id: "u1" } } }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useMfaVerifyRecovery(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync({
        challengeToken: "tokenxxxxxxxxxxx",
        code: "8f3b2c91ae"
      });
    });

    expect(apiMock.POST).toHaveBeenCalledWith(
      "/api/v1/auth/mfa/verify-recovery",
      expect.anything()
    );
  });
});
